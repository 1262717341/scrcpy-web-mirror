/**
 * PCM 播放器（AudioWorklet）——v4.2.12
 *
 * 为什么不用「AudioBufferSource 排程」：
 *   排程法必须自己维护 _nextTime 追赶墙钟，USB 抖动或主线程卡顿导致音频一次性涌进时，
 *   积压只能靠「清源 + 重排」消掉，每次都要丢掉上百毫秒，听起来就是一卡一卡的，
 *   而且短时间会连着触发好几次（截图里一秒 4 次）。
 *
 * 现在把播放交给音频硬件时钟：主线程只管把 PCM 塞进环形缓冲，
 * worklet 每 128 帧按真实采样率取走一批，缓冲深度自然收敛，不需要「重同步」动作。
 * 只保留两件事：
 *   1) 起播先攒 45ms 再出声（抗抖动），断粮则补静音等再次攒够；
 *   2) 缓冲超过 150ms 才削掉多余部分（每 0.5s 上报一次，主线程再去写日志）。
 */

export const PCM_PROCESSOR_NAME = "pcm-sink";

export const PCM_WORKLET_SOURCE = `
class PcmSink extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opt = (options && options.processorOptions) || {};
    this.rate = opt.sampleRate || 48000;
    this.ch = opt.channels || 2;
    this.primeMs = opt.primeMs || 45;
    this.maxMs = opt.maxMs || 150;
    this.targetMs = opt.targetMs || 40;
    this.bufs = [];
    this.head = 0;
    this.len = 0;          // 待播采样点（交织，含所有声道）
    this.primed = false;
    this.trimmedMs = 0;    // 本轮上报周期内被削掉的时长
    this.underruns = 0;
    this.playedFrames = 0;
    this.blocks = 0;
    this.peakMs = 0;
    this.port.onmessage = (e) => {
      const d = e.data || {};
      if (d.type === "pcm" && d.samples) {
        this.bufs.push(d.samples);
        this.len += d.samples.length;
        this._trim();
      } else if (d.type === "reset") {
        this.bufs = [];
        this.head = 0;
        this.len = 0;
        this.primed = false;
      }
    };
  }
  _bufferedFrames() { return this.len / this.ch;
  }
  _trim() {
    const maxLen = Math.floor((this.rate * this.maxMs) / 1000) * this.ch;
    if (this.len <= maxLen) return;
    const targetLen = Math.floor((this.rate * this.targetMs) / 1000) * this.ch;
    while (this.len > targetLen && this.bufs.length) {
      const b = this.bufs[0];
      const drop = Math.min(b.length - this.head, this.len - targetLen);
      this.head += drop;
      this.len -= drop;
      this.trimmedMs += drop / this.ch / this.rate * 1000;
      if (this.head >= b.length) { this.bufs.shift(); this.head = 0; }
    }
  }
  process(inputs, outputs) {
    const out = outputs[0];
    const frames = out[0] ? out[0].length : 128;
    let i = 0;
    // 起播/断粮后先攒够 primeMs 再出声，避免每个包边界都插一段静音
    if (!this.primed) {
      if (this._bufferedFrames() * 1000 / this.rate >= this.primeMs) this.primed = true;
    }
    if (this.primed) {
      while (i < frames && this.len >= this.ch) {
        const b = this.bufs[0];
        for (let c = 0; c < out.length; c++) out[c][i] = b[this.head + Math.min(c, this.ch - 1)];
        this.head += this.ch;
        this.len -= this.ch;
        i += 1;
        if (this.head >= b.length) { this.bufs.shift(); this.head = 0; }
      }
      if (i < frames) {
        // 断粮：补静音，标记欠载，等下次攒够再继续
        for (let c = 0; c < out.length; c++) out[c].fill(0, i);
        this.underruns += 1;
        this.primed = false;
      } else if (this.len < this.ch) {
        // 本块刚好把缓冲播空：同样记为一次欠载，下一块进入重新蓄水
        this.underruns += 1;
        this.primed = false;
      }
    } else {
      for (let c = 0; c < out.length; c++) out[c].fill(0);
    }
    const buffered = this._bufferedFrames();
    if (buffered * 1000 / this.rate > this.peakMs) this.peakMs = buffered * 1000 / this.rate;
    this.playedFrames += frames;
    this.blocks += 1;
    // 每约 0.5 秒上报一次状态（128 帧/块 ≈ 2.67ms）
    if (this.blocks % 188 === 0) {
      this.port.postMessage({
        type: "status",
        bufferedMs: Math.round((buffered * 1000) / this.rate),
        peakMs: Math.round(this.peakMs),
        trimmedMs: Math.round(this.trimmedMs),
        underruns: this.underruns,
        playedSec: this.playedFrames / this.rate,
      });
      this.trimmedMs = 0;
      this.peakMs = 0;
    }
    return true;
  }
}
registerProcessor("${PCM_PROCESSOR_NAME}", PcmSink);
`;

/** 生成可 addModule 的 blob URL（同一页面内复用） */
let _moduleUrl = null;
export function pcmWorkletUrl() {
  if (!_moduleUrl) {
    _moduleUrl = URL.createObjectURL(new Blob([PCM_WORKLET_SOURCE], { type: "application/javascript" }));
  }
  return _moduleUrl;
}
