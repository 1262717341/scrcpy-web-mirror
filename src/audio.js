/**
 * scrcpy 音频
 * 优先 raw PCM（最稳），否则 Opus/AAC + WebCodecs
 */
export class AudioMirror {
  constructor() {
    this.ctx = null;
    this.gain = null;
    this.decoder = null;
    this.playing = false;
    this.muted = false;
    this._nextTime = 0;
    this._codec = "";
    this._rate = 48000;
    this._ch = 2;
    this._packets = 0;
    this._framesOut = 0;
    this._lastErr = "";
    this._rms = 0;
    this._sources = new Set();
    this._dropped = 0;
  }

  get stats() {
    return {
      codec: this._codec || "—",
      packets: this._packets,
      frames: this._framesOut,
      playing: this.playing,
      muted: this.muted,
      rms: this._rms || 0,
      dropped: this._dropped || 0,
      err: this._lastErr || "—",
    };
  }

  async ensureContext() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error("AudioContext 不可用");
      this.ctx = new AC({ latencyHint: "playback", sampleRate: 48000 });
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 1;
      this.gain.connect(this.ctx.destination);
      this._nextTime = 0;
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
    return this.ctx;
  }

  async start(meta) {
    await this.ensureContext();

    if (!meta) {
      this._lastErr = "无音频元数据";
      return { ok: false, reason: this._lastErr };
    }
    if (meta.type === "disabled") {
      this._lastErr = "设备未开启音频转发";
      return { ok: false, reason: this._lastErr };
    }
    if (meta.type === "errored") {
      this._lastErr = "设备音频错误";
      return { ok: false, reason: this._lastErr };
    }
    if (!meta.stream) {
      this._lastErr = "无音频流";
      return { ok: false, reason: this._lastErr };
    }

    const optionValue = String(meta.codec?.optionValue || "").toLowerCase();
    const webId = String(meta.codec?.webCodecId || "").toLowerCase();
    const mime = String(meta.codec?.mimeType || "").toLowerCase();
    this._codec = optionValue || webId || mime || "audio";

    // ---- PCM 最稳 ----
    if (optionValue === "raw" || mime.includes("raw") || mime.includes("pcm")) {
      this._codec = "raw-pcm";
      this._startPcmLoop(meta.stream);
      this.playing = true;
      return { ok: true, mode: "pcm", codec: this._codec };
    }

    // ---- WebCodecs Opus / AAC ----
    if (typeof AudioDecoder === "undefined") {
      this._lastErr = "无 AudioDecoder，请用 Chrome/Edge";
      return { ok: false, reason: this._lastErr };
    }

    const isAac = /aac|mp4a/.test(this._codec + mime);
    const rate = 48000;
    const ch = 2;
    this._rate = rate;
    this._ch = ch;

    const codecCandidates = isAac
      ? ["mp4a.40.2", "aac"]
      : ["opus", webId || "opus"];

    let config = null;
    for (const codec of codecCandidates) {
      try {
        const cfg = { codec, sampleRate: rate, numberOfChannels: ch };
        const s = await AudioDecoder.isConfigSupported(cfg);
        if (s?.supported) {
          config = cfg;
          break;
        }
      } catch {
        /* next */
      }
    }
    if (!config) {
      config = { codec: codecCandidates[0], sampleRate: rate, numberOfChannels: ch };
    }

    try {
      this.decoder = new AudioDecoder({
        output: (data) => this._playAudioData(data),
        error: (e) => {
          this._lastErr = String(e?.message || e);
          console.warn("[audio] decoder", e);
        },
      });
      this.decoder.configure(config);
    } catch (e) {
      this._lastErr = String(e?.message || e);
      return { ok: false, reason: this._lastErr };
    }

    this.playing = true;
    this._nextTime = 0;

    (async () => {
      const reader = meta.stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value?.data) continue;
        this._packets += 1;
        if (this.muted) continue;
        try {
          if (value.type === "configuration" && value.data && !this._gotConfig) {
            this._gotConfig = true;
            try {
              this.decoder.configure({
                codec: config.codec,
                sampleRate: rate,
                numberOfChannels: ch,
                description: value.data,
              });
            } catch (e) {
              /* keep previous */
            }
            continue;
          }
          if (this.decoder.state === "closed") break;
          this.decoder.decode(
            new EncodedAudioChunk({
              type: "key",
              timestamp: this._packets * 20000,
              data: value.data,
            })
          );
        } catch (e) {
          this._lastErr = String(e?.message || e);
        }
      }
    })().catch((e) => {
      this._lastErr = String(e?.message || e);
    });

    return { ok: true, mode: "webcodecs:" + config.codec, codec: config.codec };
  }

  _startPcmLoop(stream) {
    (async () => {
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value?.data) continue;
        this._packets += 1;
        if (this.muted) continue;
        // int16 interleaved stereo
        const bytes = value.data;
        const samples = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength >> 1);
        const frames = samples.length >> 1;
        if (frames < 1) continue;
        const buffer = this.ctx.createBuffer(2, frames, this._rate);
        const L = buffer.getChannelData(0);
        const R = buffer.getChannelData(1);
        for (let i = 0; i < frames; i++) {
          L[i] = samples[i * 2] / 32768;
          R[i] = samples[i * 2 + 1] / 32768;
        }
        this._framesOut += frames;
        this._schedule(buffer);
      }
    })().catch((e) => {
      this._lastErr = String(e?.message || e);
    });
  }

  _playAudioData(audioData) {
    try {
      const frames = audioData.numberOfFrames;
      const ch = audioData.numberOfChannels || 2;
      const rate = audioData.sampleRate || 48000;
      if (frames <= 0) {
        audioData.close();
        return;
      }
      this._rate = rate;
      this._ch = ch;
      this._framesOut += frames;

      const buffer = this.ctx.createBuffer(ch, frames, rate);
      // 逐声道
      let ok = false;
      for (let c = 0; c < ch; c++) {
        const plane = new Float32Array(frames);
        try {
          audioData.copyTo(plane, { planeIndex: c, format: "f32" });
          buffer.getChannelData(c).set(plane);
          ok = true;
        } catch {
          ok = false;
          break;
        }
      }
      if (!ok) {
        const all = new Float32Array(frames * ch);
        audioData.copyTo(all, { format: "f32" });
        for (let c = 0; c < ch; c++) {
          const out = buffer.getChannelData(c);
          for (let i = 0; i < frames; i++) out[i] = all[i * ch + c];
        }
      }
      audioData.close();
      try {
        let sum = 0, n = 0;
        for (let c = 0; c < buffer.numberOfChannels; c++) {
          const d = buffer.getChannelData(c);
          for (let i = 0; i < d.length; i += 8) { sum += d[i] * d[i]; n++; }
        }
        this._rms = n ? Math.sqrt(sum / n) : 0;
      } catch (e) { /* ignore */ }
      this._schedule(buffer);
    } catch (e) {
      this._lastErr = String(e?.message || e);
      try {
        audioData.close();
      } catch {
        /* ignore */
      }
    }
  }

  /**
   * 把还没播/正在播的旧音源全部停掉。
   * 网络抖动后必须这么干：只重置 _nextTime 而不停旧源的话，
   * 旧 buffer 和新 buffer 会叠在一起放，听起来就是「加速 + 叠音 + 卡顿」。
   */
  _flushSources() {
    if (!this._sources) return;
    for (const s of this._sources) {
      try {
        s.onended = null;
        s.stop();
      } catch {
        /* 已经播完 */
      }
      try {
        s.disconnect();
      } catch {
        /* ignore */
      }
    }
    this._sources.clear();
  }

  _schedule(buffer) {
    if (!this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      // 排程落后（卡顿后追帧）或超前太多（抖动后积压）都直接重排
      if (!this._nextTime || this._nextTime < now - 0.05 || this._nextTime > now + 0.6) {
        this._flushSources();
        this._nextTime = now + 0.06;
      }
      // 已经积压超过 250ms：这一帧直接丢掉，不再往后排。
      // 宁可丢音也不要加速追帧，否则越追越乱。
      if (this._nextTime - now > 0.25) {
        this._dropped += 1;
        return;
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(this.gain);
      src.onended = () => {
        this._sources.delete(src);
        try {
          src.disconnect();
        } catch {
          /* ignore */
        }
      };
      this._sources.add(src);
      src.start(this._nextTime);
      this._nextTime += buffer.duration;
    } catch (e) {
      this._lastErr = String(e?.message || e);
    }
  }

  setMuted(muted) {
    this.muted = !!muted;
    if (this.gain) this.gain.gain.value = this.muted ? 0 : 1;
    return this.muted;
  }

  async stop() {
    this.playing = false;
    this._flushSources();
    this._nextTime = 0;
    try {
      if (this.decoder && this.decoder.state !== "closed") this.decoder.close();
    } catch {
      /* ignore */
    }
    this.decoder = null;
    try {
      await this.ctx?.close();
    } catch {
      /* ignore */
    }
    this.ctx = null;
    this.gain = null;
  }
}
