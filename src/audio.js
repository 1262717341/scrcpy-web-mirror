/**
 * scrcpy 音频
 * 优先 raw PCM（最稳），否则 Opus/AAC + WebCodecs
 *
 * v4.2.12：raw PCM 改为 AudioWorklet 硬件时钟播放（见 pcm-worklet.js），
 * 不再用 AudioBufferSource 排程 + 追赶，从根上消除「卡一下」的重同步。
 */
import { PCM_PROCESSOR_NAME, pcmWorkletUrl } from "./pcm-worklet.js";
export class AudioMirror {
  constructor(options = {}) {
    this.ctx = null;
    this.gain = null;
    this.decoder = null;
    this.playing = false;
    this.muted = !!options.muted;
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
    this._resync = 0;
    this._syncMsg = "";
    this.onLog = null;
    this.sink = null;
    this._bufferedMs = 0;
    this._underruns = 0;
    this._trimmedTotal = 0;
    this._lastTrimLog = 0;
    this._gotConfig = false;
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
      resync: this._resync || 0,
      bufferedMs: this.sink ? this._bufferedMs : null,
      underruns: this._underruns || 0,
      latencyMs: this.latencyMs,
      err: this._lastErr || "—",
    };
  }

  /** 当前音频缓冲延迟（毫秒）：待播缓冲 + 声卡输出延迟 */
  get latencyMs() {
    if (!this.ctx || !this.playing) return null;
    try {
      const out = (this.ctx.outputLatency || this.ctx.baseLatency || 0) * 1000;
      if (this.sink) return Math.round((this._bufferedMs || 0) + out);
      const ahead = Math.max(0, this._nextTime - this.ctx.currentTime) * 1000;
      return Math.round(ahead + out);
    } catch {
      return null;
    }
  }

  async ensureContext() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error("AudioContext 不可用");
      // interactive：让浏览器用最小的输出缓冲，降低声音延迟；抖动靠 _schedule 的自动重排兜底
      this.ctx = new AC({ latencyHint: "interactive", sampleRate: 48000 });
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

  /**
   * 剥掉 scrcpy 5.x 逐包 12 字节帧头（pts u64 BE + len u32 BE）。
   * 只在该包里「len 恰好等于 总长-12」时剥离，误判概率约 1/2^32，不会破坏正常 PCM。
   */
  _stripPacketHeader(bytes) {
    if (bytes.byteLength < 16) return bytes;
    try {
      const len = new DataView(bytes.buffer, bytes.byteOffset, 12).getUint32(8, false);
      if (len > 0 && len === bytes.byteLength - 12) return bytes.subarray(12);
    } catch {
      /* 保持原样 */
    }
    return bytes;
  }

  _startPcmLoop(stream) {
    if (this.ctx?.audioWorklet && typeof AudioWorkletNode !== "undefined") {
      this._startPcmWorklet(stream).catch((e) => {
        this._lastErr = String(e?.message || e);
        console.warn("[audio] worklet 启动失败，退回排程播放", e);
        try { this.sink?.disconnect(); } catch { /* ignore */ }
        this.sink = null;
        this._startPcmLoopLegacy(stream);
      });
      return;
    }
    this._startPcmLoopLegacy(stream);
  }

  /** 硬件时钟播放：主线程只管灌 PCM，取走由 worklet 按真实采样率完成 */
  async _startPcmWorklet(stream) {
    await this.ctx.audioWorklet.addModule(pcmWorkletUrl());
    const node = new AudioWorkletNode(this.ctx, PCM_PROCESSOR_NAME, {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      processorOptions: {
        sampleRate: this._rate,
        channels: 2,
        primeMs: 45,   // 起播先攒 45ms，避免每个包边界插静音
        maxMs: 150,    // 超过 150ms 才削，正常抖动根本碰不到
        targetMs: 40,
      },
    });
    this.sink = node;
    node.connect(this.gain);
    node.port.onmessage = (e) => {
      const d = e.data || {};
      if (d.type !== "status") return;
      this._bufferedMs = d.bufferedMs || 0;
      this._underruns = d.underruns || 0;
      if (d.trimmedMs >= 15) {
        this._dropped += 1;
        this._trimmedTotal += d.trimmedMs;
        const now = Date.now();
        // 削减是异常事件，10 秒内只报一次，避免刷屏
        if (now - this._lastTrimLog > 10000) {
          this._lastTrimLog = now;
          try {
            this.onLog?.(`声音缓冲削减 ${Math.round(d.trimmedMs)}ms（积压超过 150ms，已削回 40ms）`);
          } catch { /* ignore */ }
        }
      }
    };

    (async () => {
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value?.data) continue;
        this._packets += 1;
        if (this.muted) continue;
        const bytes = this._stripPacketHeader(value.data);
        const pairs = bytes.byteLength >> 2; // 立体声 16bit：4 字节 1 帧
        if (pairs < 1) continue;
        const f32 = new Float32Array(pairs * 2);
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        let sum = 0;
        for (let i = 0; i < pairs * 2; i += 1) {
          const s = view.getInt16(i * 2, true) / 32768;
          f32[i] = s;
          sum += s * s;
        }
        this._framesOut += pairs;
        this._rms = Math.sqrt(sum / (pairs * 2));
        node.port.postMessage({ type: "pcm", samples: f32 }, [f32.buffer]);
      }
    })().catch((e) => {
      this._lastErr = String(e?.message || e);
    });
  }

  _startPcmLoopLegacy(stream) {
    (async () => {
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value?.data) continue;
        this._packets += 1;
        if (this.muted) continue;
        // int16 interleaved stereo；与 Worklet 路径一致，先剥 scrcpy 5.x 帧头
        const bytes = this._stripPacketHeader(value.data);
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
      // v4.2.12：声音延迟从 279ms 压到 50ms 档。
      // 旧逻辑把积压上限设成 250ms、超了只丢单帧，积压就永久钉在 250ms，
      // 结果「画面 17ms、声音 279ms」——音画差 260ms，必然不同步。
      const targetAhead = 0.04; // 起播/重同步后保留的缓冲（≈ 1~2 个包，USB 抖动够用）
      const maxAhead = 0.12;    // 超过就主动压缩，宁可跳一小段也要对齐画面
      const aheadMs = (this._nextTime - now) * 1000;
      if (!this._nextTime || this._nextTime < now - 0.02 || aheadMs > maxAhead * 1000) {
        this._flushSources();
        this._nextTime = now + targetAhead;
        if (aheadMs > 80) {
          this._resync += 1;
          this._syncMsg = "声音重同步：积压 " + Math.round(aheadMs) + "ms → 压缩到 " +
            Math.round(targetAhead * 1000) + "ms（第 " + this._resync + " 次）";
          try { this.onLog?.(this._syncMsg); } catch { /* ignore */ }
        }
        this._dropped += 1;
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
    try {
      this.sink?.port.postMessage({ type: "reset" });
      this.sink?.disconnect();
    } catch { /* ignore */ }
    this.sink = null;
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
    this._gotConfig = false;
  }
}
