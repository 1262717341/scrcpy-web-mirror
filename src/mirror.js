/**
 * ADB 连接 + scrcpy 投屏 — 对齐 scrcpy 控制协议
 * WebUSB ADB · scrcpy-server 5.0.1 · WebCodecs · 完整控制
 */
import { Adb, AdbDaemonTransport } from "@yume-chan/adb";
import { AdbDaemonWebUsbDeviceManager } from "@yume-chan/adb-daemon-webusb";
import AdbWebCredentialStore from "@yume-chan/adb-credential-web";
import { AdbScrcpyClient, AdbScrcpyOptions3_3_3 } from "@yume-chan/adb-scrcpy";
import {
  DefaultServerPath,
  ScrcpyVideoCodecId,
  ScrcpyInstanceId,
  ScrcpyCodecOptions,
  ScrcpyAudioCodec,
  h264ParseConfiguration,
} from "@yume-chan/scrcpy";
import {
  WebCodecsVideoDecoder,
  WebGLVideoFrameRenderer,
  BitmapVideoFrameRenderer,
} from "@yume-chan/scrcpy-decoder-webcodecs";
import {
  Consumable,
  ReadableStream,
  InspectStream,
  WritableStream,
  TextDecoderStream,
  ConcatStringStream,
} from "@yume-chan/stream-extra";
import { DeviceController } from "./control.js";
import { AudioMirror } from "./audio.js";
import { createV5AudioMetaParser } from "./audio-v5.js";
import { translateServerLine, summarizeScrcpyOptions } from "./log-i18n.js";
import { connectWireless, connectUsbDirect, prepareUsbServer, WirelessError } from "./wireless.js";

const SERVER_URL = "./assets/scrcpy-server.jar";

/**
 * scrcpy 5.0.1 可能把 SPS/PPS 直接并入首个关键帧，而不再单独发送配置包。
 * 从 Annex-B 关键帧中提取参数集，补成旧解码器需要的配置包。
 */
function extractH264ParameterSets(data) {
  if (!(data instanceof Uint8Array) || data.length < 8) return null;
  const starts = [];
  for (let i = 0; i + 4 <= data.length; i += 1) {
    if (data[i] !== 0 || data[i + 1] !== 0) continue;
    if (data[i + 2] === 1) {
      starts.push({ offset: i, header: i + 3 });
      i += 2;
    } else if (data[i + 2] === 0 && data[i + 3] === 1) {
      starts.push({ offset: i, header: i + 4 });
      i += 3;
    }
  }
  if (!starts.length) return null;
  const parts = [];
  let hasSps = false;
  let hasPps = false;
  for (let index = 0; index < starts.length; index += 1) {
    const { offset, header } = starts[index];
    const end = index + 1 < starts.length ? starts[index + 1].offset : data.length;
    const nalType = data[header] & 0x1f;
    if (nalType === 7) hasSps = true;
    else if (nalType === 8) hasPps = true;
    else continue;
    parts.push(data.subarray(offset, end));
  }
  if (!hasSps || !hasPps) return null;
  const total = parts.reduce((size, part) => size + part.length, 0);
  const config = new Uint8Array(total);
  let cursor = 0;
  for (const part of parts) {
    config.set(part, cursor);
    cursor += part.length;
  }
  return config;
}

/** 判断 Annex-B 数据中是否包含真正的图像切片（IDR 或非 IDR） */
function h264HasSlice(data) {
  if (!(data instanceof Uint8Array)) return false;
  for (let i = 0; i + 3 < data.length; i += 1) {
    const shortStart = data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 1;
    const longStart = data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0 && data[i + 3] === 1;
    if (!shortStart && !longStart) continue;
    const header = i + (shortStart ? 3 : 4);
    const nalType = data[header] & 0x1f;
    if (nalType === 1 || nalType === 5) return true;
  }
  return false;
}

/** 判断 Annex-B 数据中是否包含 IDR 图像切片（NAL 类型 5） */
function h264HasIdr(data) {
  if (!(data instanceof Uint8Array)) return false;
  for (let i = 0; i + 3 < data.length; i += 1) {
    const shortStart = data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 1;
    const longStart = data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0 && data[i + 3] === 1;
    if (!shortStart && !longStart) continue;
    const header = i + (shortStart ? 3 : 4);
    if ((data[header] & 0x1f) === 5) return true;
  }
  return false;
}

/**
 * scrcpy 5.x 音频流兼容（协议细节见 src/audio-v5.js）
 * 关键：send_stream_meta=false 时成功路径是「12 字节帧头 + PCM」，没有 codec id 头；
 * 失败信号只在「流提前结束且只有 4 字节」时才成立 —— 不能拿前 4 字节判断，
 * 因为 PTS 是 µs 级系统时间，超过 2^32 µs（约 71.6 分钟）后高 32 位恰为 0x00000001，
 * 会和 errored 信号撞车（v4.2.11 的假「设备音频错误」就是这么来的）。
 */
function patchV5AudioMeta(options) {
  const codecMap = {
    raw: ScrcpyAudioCodec.Raw,
    opus: ScrcpyAudioCodec.Opus,
    aac: ScrcpyAudioCodec.Aac,
    flac: ScrcpyAudioCodec.Flac,
  };
  const codec = codecMap[String(options.value.audioCodec || "raw").toLowerCase()] || ScrcpyAudioCodec.Raw;
  const makeStream = (pending, reader) =>
    new ReadableStream({
      start(controller) {
        controller.enqueue(pending);
      },
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            return;
          }
          controller.enqueue(value);
        } catch (e) {
          controller.error(e);
        }
      },
      cancel() {
        try {
          reader.cancel();
        } catch {
          /* 已断开 */
        }
      },
    });
  options.parseAudioStreamMetadata = createV5AudioMetaParser(codec, makeStream);
}
/** 手机端看门狗：唯一职责是「无线会话失联后回收 scrcpy」，状态文件都放在 tmp 目录 */
const GUARD_PATH = "/data/local/tmp/panda_guard.sh";
const GUARD_LOG = "/data/local/tmp/panda_guard.log";
const GUARD_HB = "/data/local/tmp/panda_hb";
const GUARD_RUN = "/data/local/tmp/panda_run";

/**
 * 看门狗判据只有两条，够用且不会误杀：
 *  1) 心跳过期：页面每 5 秒通过已建立的 ADB 通道喂一次，30 秒没更新才算死。
 *     写心跳这个动作本身就是链路探活 —— 写得进去说明通道还活着。
 *  2) Wi-Fi 的 IPv4 地址连续 2 次消失（关 Wi-Fi / 掉线）：确定事实，直接动手。
 * 不再 ping 网关、不再数 TCP ESTABLISHED、不再按端口猜状态。
 */
const GUARD_STALE = 30;
/** 从没见过心跳时的自退/回收时间（秒）：布防前一定会先写一次心跳，读不到就是异常，按失联处理 */
const GUARD_IDLE_EXIT = 60;

/** 净音量不变的音频路由刷新：抬一格再原样写回，不改用户音量、不弹 UI */
const AUDIO_ROUTE_CMD =
  "v=$(media volume --stream 3 --get 2>/dev/null | tr -d ' ' | sed -n 's/.*:\\([0-9]*\\)\\/.*/\\1/p' | head -n 1); " +
  'case "$v" in ""|*[!0-9]*) v="";; esac; ' +
  'if [ -n "$v" ]; then ' +
  "media volume --stream 3 --set $((v+1)) >/dev/null 2>&1; " +
  'media volume --stream 3 --set $v >/dev/null 2>&1; fi; true';

/** 每轮无线会话一个短号：看门狗据此判断「自己是否已被新会话替换」，避免旧狗误杀新会话 */
function newGuardSession() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** 心跳 / 运行标记按会话隔离：另一个窗口或上一轮会话写自己的文件，影响不到本轮判断 */
const guardHbPath = (session) => GUARD_HB + "." + session;
const guardRunPath = (session) => GUARD_RUN + "." + session;

/**
 * pkill 的模式用「方括号」写法：[c]om.foo 能匹配 com.foo，
 * 但不会匹配到「命令行里写着 [c]om.foo」的 pkill 自己及其父 shell，
 * 否则清理命令会把自己先杀掉。
 */

export class MirrorError extends Error {
  constructor(message, code = "MIRROR_ERROR", cause) {
    super(message, { cause });
    this.name = "MirrorError";
    this.code = code;
    this.guide = guideFor(code);
  }
}

function guideFor(code) {
  const map = {
    NO_WEBUSB: "请使用 Chrome 或 Edge，并通过 http://localhost 或 https 打开。",
    NO_MANAGER: "浏览器未暴露 WebUSB，请关闭无关扩展后重试。",
    NO_DEVICE: "请在系统弹窗中选择你的 Android 手机。",
    DEVICE_BUSY: "关闭电脑上的 adb / 手机助手 / 其它投屏工具，或执行 adb kill-server 后重试。",
    USB_FAIL: "换根数据线/USB 口，手机选「传输文件」模式，并开启 USB 调试。",
    AUTH_TIMEOUT: "看手机屏幕：勾选「始终允许」并点「确定」。若无弹窗，撤销 USB 调试授权后重插。",
    AUTH_REJECTED: "手机上点了拒绝。请撤销 USB 调试授权后重新连接。",
    NO_DEVICE_FOUND: "系统未找到 ADB 接口。确认已开启 USB 调试；部分电脑需将驱动换成 WinUSB（Zadig）。",
    SCRCPY_FAIL: "scrcpy-server 启动失败，请重新插拔手机后重试。",
    NO_VIDEO: "视频流为空，请重试；仍失败请查看 Console。",
    NO_SERVER: "scrcpy 便捷网页版服务可能已停止。请重新启动服务后刷新页面；若服务仍在运行，请确认通过 http://127.0.0.1:端口/control.html 打开，而不是 file://。",
  };
  return map[code] || "请检查 USB 连接、USB 调试与授权弹窗。";
}

export function isUsbSupported() {
  return typeof navigator !== "undefined" && !!navigator.usb;
}

function createRenderer() {
  if (WebGLVideoFrameRenderer.isSupported) {
    return { renderer: new WebGLVideoFrameRenderer(undefined, true), kind: "webgl" };
  }
  return { renderer: new BitmapVideoFrameRenderer(), kind: "bitmap" };
}

/**
 * 节流渲染器：按目标帧率限速，多出来的帧直接丢（跳帧到最新）。
 *
 * 为什么需要它：底层解码器是「来一帧画一帧」（官方 scrcpy 的低延迟策略）。
 * 网络拥塞恢复后，编码端攒下的帧会在一瞬间涌入，全部立即渲染 = 画面几倍速快进。
 * 限速后这些积压帧会被丢掉，画面直接跳回实时状态 —— 直播播放器的标准做法。
 *
 * 注意：被丢的帧由解码器统一 close()，这里只负责「不画」。
 */
class PacedRenderer {
  constructor(inner, maxFps, hooks) {
    this.inner = inner;
    this.hooks = hooks || {};
    // 目标帧率 30~120；maxFps=0（不限）或未设置时按 120 上限处理
    const fpsIn = Number(maxFps);
    const effective = Number.isFinite(fpsIn) && fpsIn > 0 ? fpsIn : 120;
    const fps = Math.max(30, Math.min(effective, 120));
    this.interval = 1000 / fps;
    this._next = 0;
    this.dropped = 0;
    this.rendered = 0;
  }
  get canvas() {
    return this.inner.canvas;
  }
  setSize(width, height) {
    this.inner.setSize(width, height);
  }
  draw(frame) {
    const now = performance.now();
    // 取走这一帧对应的「视频包到达时刻」，用于统计端到端画面延迟
    const arrived = this.hooks.takeArrival ? this.hooks.takeArrival() : 0;
    // 1ms 容差：吸收定时器与浮点舍入抖动，稳态不误丢
    if (now < this._next - 1) {
      // 到得比渲染节奏还快 = 积压追赶，丢弃保持实时
      this.dropped += 1;
      return;
    }
    this._next = Math.max(this._next, now) + this.interval;
    this.rendered += 1;
    if (arrived && this.hooks.onLatency) {
      this.hooks.onLatency(Date.now() - arrived);
    }
    return this.inner.draw(frame);
  }
}

export class AdbMirror {
  constructor({ stage, status, onStatus, onError, onStats, onFirstFrame, onController, onLog, onBeforeTeardown }) {
    this.stage = stage;
    this.statusEl = status;
    this.onStatus = onStatus || (() => {});
    this.onError = onError || (() => {});
    this.onStats = onStats || (() => {});
    this.onFirstFrame = onFirstFrame || (() => {});
    this.onController = onController || (() => {});
    this.onLog = onLog || (() => {});
    // 关闭 ADB 通道之前的异步收尾钩子（如恢复手机原输入法），带超时兜底，不阻塞断流
    this.onBeforeTeardown = onBeforeTeardown || (() => {});
    this._opts = {};
    this.adb = null;
    this.client = null;
    this.decoder = null;
    this.device = null;
    this.canvas = null;
    this.deviceController = null;
    this.rendererKind = "";
    this.running = false;
    this.frames = 0;
    this.startTs = 0;
    // 实时指标：视频包到达时刻队列 / 端到端画面延迟(EMA) / 滑动窗口帧率
    this._pktArrivals = [];
    this._latencyMs = null;
    this._fpsWinStart = 0;
    this._fpsWinCount = 0;
    this._fps = "0";
    this._size = { width: 0, height: 0 };
    this._stopRequested = false;
    this.credentialStore = new AdbWebCredentialStore("PandaTestLocal");
    this.audio = new AudioMirror();
    this._wirelessDispose = null;
    this._wirelessTarget = "";
    this._sdk = 0;
    this._cleaned = false;
    this._lateTimer = null;
    this._lateActive = false;
    this.muted = false;
    // v4.0.23：无线投屏时 scrcpy 的 stay_awake 依赖“插电常亮”，手机没插电仍会息屏。
    // 这里在投屏期间临时把系统息屏时间拉到最大，停止/断线时恢复，避免把用户设置改坏。
    this._awakeSaved = null;
    this._awakeApplied = false;
    this._dropHandled = false;
    this._usbDisconnectHandler = null;
    this._usbServerBytes = null;
    this._usbServerBytesAt = 0;
    this._serverJarPrefetch = null;
    this._diagLastPacketAt = 0;
    this._diagLastPacketKind = "";
    this._diagLastDecoderError = "";
    this._diagUsbEvent = "";
  }

  _detachUsbDisconnect() {
    if (typeof navigator === "undefined" || !navigator.usb || !this._usbDisconnectHandler) return;
    navigator.usb.removeEventListener("disconnect", this._usbDisconnectHandler);
    this._usbDisconnectHandler = null;
  }

  async _closeUsbHandle() {
    this._detachUsbDisconnect();
    const device = this.device;
    this.device = null;
    this._usbServerUploaded = "";
    if (!device?.raw?.opened) return;
    try {
      await device.raw.close();
    } catch {
      /* 设备已被系统移除或句柄已关闭 */
    }
  }

  /** 息屏时间快照的本地键：按设备序列号区分，页面被关闭后下次连接仍能补恢复 */
  _awakeStoreKey() {
    const id = String(this._wirelessTarget || this.device?.serial || "").trim();
    return id ? "scrcpy-awake-timeout:" + id : "";
  }

  _readAwakeStored() {
    const key = this._awakeStoreKey();
    if (!key) return null;
    try {
      const raw = localStorage.getItem(key);
      const n = Number(raw);
      return raw != null && Number.isFinite(n) && n >= 0 ? n : null;
    } catch {
      return null;
    }
  }

  _writeAwakeStored(value) {
    const key = this._awakeStoreKey();
    if (!key) return;
    try { localStorage.setItem(key, String(value)); } catch { /* 隐私模式忽略 */ }
  }

  _clearAwakeStored() {
    const key = this._awakeStoreKey();
    if (!key) return;
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }

  status(text) {
    if (this.statusEl) this.statusEl.textContent = text;
    this.onStatus(text);
  }

  /** 当前连接的设备标识（无线用 IP:端口，USB 用序列号），供按设备记忆设置 */
  get serialKey() {
    return String(this._wirelessTarget || this.device?.serial || "").trim();
  }

  /** 关闭 ADB 通道前执行收尾钩子，2.5 秒超时兜底，避免断流被卡住 */
  async _runBeforeTeardown() {
    try {
      await Promise.race([
        Promise.resolve(this.onBeforeTeardown()),
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ]);
    } catch (e) {
      this.onLog("before-teardown 钩子失败: " + (e && e.message ? e.message : e));
    }
  }

  /** 连接环境自检 */
  async diagnose() {
    const result = {
      webusb: isUsbSupported(),
      secure: typeof window !== "undefined" && (window.isSecureContext || location.hostname === "localhost" || location.hostname === "127.0.0.1"),
      manager: !!AdbDaemonWebUsbDeviceManager.BROWSER,
      authorizedDevices: 0,
      webcodecs: typeof VideoDecoder !== "undefined",
    };
    try {
      const list = await AdbDaemonWebUsbDeviceManager.BROWSER?.getDevices?.();
      result.authorizedDevices = list?.length || 0;
    } catch {
      /* ignore */
    }
    return result;
  }

  /** 列出已授权的 USB 设备(不弹系统选择器) */
  async listUsbDevices() {
    if (!isUsbSupported()) return [];
    const manager = AdbDaemonWebUsbDeviceManager.BROWSER;
    if (!manager) return [];
    try {
      const list = await manager.getDevices();
      return (list || []).map((d) => ({
        serial: d.serial || d.name || "unknown",
        name: d.name || d.serial || "Android 设备",
      }));
    } catch {
      return [];
    }
  }

  /** 弹出系统选择器让用户授权新设备 */
  async pickUsbDevice() {
    return await this.requestDevice();
  }

  async requestDevice(preferSerial, allowPicker = true, waitMs = 0) {
    if (!isUsbSupported()) {
      throw new MirrorError("当前浏览器不支持 WebUSB", "NO_WEBUSB");
    }
    const manager = AdbDaemonWebUsbDeviceManager.BROWSER;
    if (!manager) {
      throw new MirrorError("WebUSB 设备管理器不可用", "NO_MANAGER");
    }

    // 已授权设备优先。USB 重新枚举期间设备会短暂消失，自动重连只轮询等待，
    // 绝不能掉进系统选择器（后台 / headless 下选择器无法操作，会表现为一直卡住）。
    const deadline = Date.now() + Math.max(0, waitMs);
    for (;;) {
      try {
        const existing = await manager.getDevices();
        if (existing?.length) {
          const hit = preferSerial
            ? existing.find(
                (d) =>
                  d.serial === preferSerial ||
                  d.name === preferSerial ||
                  `${d.raw?.vendorId?.toString(16)}x${d.raw?.productId?.toString(16)}` === preferSerial
              )
            : existing[0];
          if (hit) {
            this.device = hit;
            return hit;
          }
        }
      } catch {
        /* 继续等待或回退到用户手动选择 */
      }
      if (Date.now() >= deadline) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!allowPicker) {
      throw new MirrorError("已授权 USB 设备尚未重新上线", "NO_DEVICE");
    }

    // 只有用户主动发起连接时才允许弹系统选择器。
    let device;
    try {
      device = await manager.requestDevice();
    } catch (err) {
      if (err?.name === "NotFoundError") {
        throw new MirrorError("未选择设备", "NO_DEVICE");
      }
      throw new MirrorError("选择设备失败：" + (err?.message || err), "NO_DEVICE_FOUND", err);
    }
    if (!device) {
      throw new MirrorError("未选择设备 / 未找到 ADB 接口", "NO_DEVICE_FOUND");
    }
    this.device = device;
    return device;
  }

  async connectAndAuth() {
    if (!this.device) throw new MirrorError("尚未选择 USB 设备", "NO_DEVICE");
    this.status("正在连接 ADB…");

    // 无线切 USB 时，本机 adb 刚被结束，Windows 释放 ADB 接口会有延迟；
    // 全新浏览器/服务后的第一次 ADB 握手也可能被设备端直接关闭。
    // 这两种都属于可重试的瞬时故障，关闭句柄、等待后重连，最多 3 轮。
    const acquireConnection = async () => {
      let connection = null;
      for (let attempt = 1; attempt <= 4; attempt += 1) {
        try {
          connection = await this.device.connect();
          return connection;
        } catch (err) {
          const busy =
            err?.name === "DeviceBusyError" ||
            err?.name === "NetworkError" ||
            /busy|in use|another program|NetworkError/i.test(String(err?.message || ""));
          if (busy && attempt < 4) {
            this.onLog("USB 接口尚未释放，等待后重试 " + attempt + "/3");
            this.status("USB 接口释放中，正在重试…");
            try {
              await this.device?.raw?.close?.();
            } catch {
              /* 句柄已关闭 */
            }
            await new Promise((resolve) => setTimeout(resolve, 900));
            try {
              await this.requestDevice(this._preferSerial || this.device?.serial || "", false, 5000);
            } catch {
              /* 沿用一个设备对象再试 */
            }
            continue;
          }
          if (busy) {
            throw new MirrorError(
              "设备正在被其他程序使用（adb / 手机助手 / 其它 WebUSB 页）。",
              "DEVICE_BUSY",
              err
            );
          }
          throw new MirrorError("USB 连接失败：" + (err?.message || err), "USB_FAIL", err);
        }
      }
      throw new MirrorError("USB 接口一直被占用，请稍后重试", "DEVICE_BUSY");
    };

    let transport = null;
    for (let round = 1; round <= 3 && !transport; round += 1) {
      const connection = await acquireConnection();
      this.status("等待设备授权…（请在手机上点「允许 USB 调试」）");
      let authTimer = null;
      try {
        transport = await Promise.race([
          AdbDaemonTransport.authenticate({
            serial: this.device.serial,
            connection,
            credentialStore: this.credentialStore,
          }),
          new Promise((_, reject) => {
            authTimer = setTimeout(() => reject(new Error("ADB authentication timeout")), 15000);
          }),
        ]);
      } catch (err) {
        const msg = String(err?.message || err);
        try { await connection?.close?.(); } catch { /* 连接可能已经断开 */ }
        const transient =
          /closed unexpectedly|readable ended|ExactReadable|NetworkError|disconnected|connection.*closed|timeout/i.test(
            msg
          );
        if (transient && round < 3) {
          this.onLog("USB 握手被关闭，重连 " + round + "/2");
          this.status("USB 连接已关闭，正在重连…");
          try {
            await this.device?.raw?.close?.();
          } catch {
            /* 句柄已关闭 */
          }
          await new Promise((resolve) => setTimeout(resolve, 1200));
          try {
            await this.requestDevice(this._preferSerial || this.device?.serial || "", false, 5000);
          } catch {
            /* 沿用一个设备对象再试 */
          }
          continue;
        }
        if (/timeout|stalled|read time limit/i.test(msg)) {
          throw new MirrorError(
            "设备授权超时。请看手机：勾选「始终允许」并点「确定」",
            "AUTH_TIMEOUT",
            err
          );
        }
        if (/authenticator|rejected|refused/i.test(msg)) {
          throw new MirrorError("设备授权被拒绝。请撤销 USB 调试授权后重新连接", "AUTH_REJECTED", err);
        }
        throw new MirrorError("ADB 认证失败：" + msg, "AUTH_FAIL", err);
      } finally {
        clearTimeout(authTimer);
      }
    }
    if (!transport) {
      throw new MirrorError("ADB 认证失败：USB 连接反复被关闭", "AUTH_FAIL");
    }

    this.adb = new Adb(transport);
    this.status("ADB 已连接");
    return this.adb;
  }

  /**
   * 在手机端执行一条真正的 shell 命令。
   * 关键：exec: 通道(noneProtocol)不经过 sh，引号/管道/; /& 全部失效，
   * 所以清理类命令必须走 shell,v2 或 shell:(pty)，这里的 pkill 才真的会执行。
   */
  async deviceShell(cmd, timeoutMs = 8000) {
    const sub = this.adb?.subprocess;
    if (!sub) return "";
    // 关键：必须传字符串，不能包数组。
    //
    // 历史教训（v3.0.6~v3.0.11 一直踩的坑）：
    // shell,v2 服务收到数组后会用 join(" ") 拼接 —— ["sh","-c",cmd] 会变成
    // `sh -c ( nohup ... & ); ...`。adbd 再把整串交给设备 sh 执行时，
    // `sh -c` 只吞掉第一个词，遇到 `(` 直接语法错误、整行中止，
    // 看门狗的启动命令因此"无输出"地失败了六个版本。
    //
    // 传字符串时库会做 splitCommand（引号感知的分词）再原样拼回，
    // 单引号、; | & ( ) 重定向全部保留，adbd 用 sh -c 执行整串 —— 这才是正确路径。
    const command = String(cmd);
    const withTimeout = (p) =>
      Promise.race([p, new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs))]);
    try {
      if (sub.shellProtocol) {
        const r = await withTimeout(sub.shellProtocol.spawnWaitText(command));
        return String((r && r.stdout) || "");
      }
      const proc = await sub.noneProtocol.pty(command);
      const out = await withTimeout(
        proc.output.pipeThrough(new TextDecoderStream()).pipeThrough(new ConcatStringStream())
      );
      try {
        proc.kill?.();
      } catch {
        /* ignore */
      }
      return String(out || "");
    } catch {
      return "";
    }
  }

  /** 手机端残留的 scrcpy 进程 pid */
  async listScrcpyPids() {
    const out = await this.deviceShell(
      "ps -A -o PID,ARGS 2>/dev/null | grep '[c]om.genymobile.scrcpy' | awk '{print $1}'",
      5000
    );
    return String(out || "")
      .split(/\s+/)
      .filter((s) => /^\d+$/.test(s));
  }

  /**
   * 结束手机端 scrcpy，并且**回读确认真的结束了**。
   * 以前只发一次 pkill、不管结果，日志却写着「已结束」，实际进程还在占音频。
   * 现在整段清理在手机端一次跑完（TERM → 0.4s → KILL → 回读），只占一个 adb 往返。
   */
  async killScrcpyServerOnDevice() {
    if (!this.adb) return true;
    const out = String(
      (await this.deviceShell(
        'pkill -TERM -f "[c]om.genymobile.scrcpy" 2>/dev/null; sleep 0.4; ' +
          'pkill -9 -f "[c]om.genymobile.scrcpy" 2>/dev/null; ' +
          'pkill -9 -f "[a]pp_process.*scrcpy" 2>/dev/null; sleep 0.2; ' +
          'echo "REMAIN=$(ps -A 2>/dev/null | grep -c \'[c]om.genymobile.scrcpy\')"',
        12000
      )) || ""
    );
    const remain = Number((/REMAIN=(\d+)/.exec(out) || [])[1] || 0);
    if (remain) {
      this.onLog("手机端 scrcpy 仍在运行（" + remain + " 个进程），音频可能仍被占用");
      return false;
    }
    return true;
  }

  /**
   * 触发音频路由重算。部分机型 scrcpy 退出后播放路由仍停在被捕获的状态，需要一次刷新才恢复外放。
   *
   * v3.0.16 起不再按音量键（音量键会弹音量条、且会真的改变音量）。
   * 改为无界面等效刷新：读当前媒体音量 -> 抬高一格再原样写回，
   * setStreamVolume 一样会驱动 AudioService 重算路由，但屏幕上什么都不显示、净音量不变。
   */
  async refreshAudioRoute() {
    if (!this.adb) return;
    await this.deviceShell(AUDIO_ROUTE_CMD, 15000);
  }

  /**
   * 读取手机端音频状态。
   * 「杀了进程还是没声」必须靠这个定位：是进程没杀掉、音量被静音、
   * 还是输出路由卡在 remote submix 上，三种情况的处理完全不同。
   */
  async diagnoseAudio() {
    if (!this.adb) return "";
    const cmd =
      'echo "[scrcpy 进程]"; ps -A 2>/dev/null | grep "[c]om.genymobile.scrcpy" || echo "无"; ' +
      'echo "[看门狗进程]"; ps -A 2>/dev/null | grep "[p]anda_guard.sh" || echo "无"; ' +
      'echo "[媒体音量/静音/路由]"; dumpsys audio 2>/dev/null | grep -iE "streamVolume|STREAM_MUSIC|muted|device=" | head -20; ' +
      'echo "[勿扰 zen_mode]"; settings get global zen_mode 2>/dev/null; ' +
      'echo "[看门狗日志]"; tail -n 8 ' + GUARD_LOG + ' 2>/dev/null || echo "无"';
    return String((await this.deviceShell(cmd, 15000)) || "").trim();
  }

  /** 没连着手机时先重连一次，保留连接用于下发恢复命令 */
  async ensureAdbForRepair() {
    if (this.adb) return true;
    if (!this._wirelessTarget) return false;
    try {
      const conn = await connectWireless(this._wirelessTarget, () => {});
      this.adb = conn.adb;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 强力恢复外放。按音量键都没声 = 不是音量归零，而是音频路由被卡住
   * （scrcpy 的 playback 采集把输出切到 remote submix，进程被杀后路由没回来）。
   * 按「能直接驱动 AudioService 重算路由」的力度从弱到强挨个试。
   * 只在用户主动点「恢复声音」时调用，不进自动流程，避免干扰正常投屏。
   */
  async forceAudioRestore() {
    if (!this.adb) return;
    // 0) 先把占着音频采集的进程清掉
    await this.killScrcpyServerOnDevice();
    // 1) 关勿扰 / 退出静音模式（静音模式下路由正常也不出声）
    await this.deviceShell(
      "settings put global zen_mode 0 2>/dev/null; settings put system mode_ringer 2 2>/dev/null; true",
      6000
    );
    // 2) 直接设置媒体音量：走 AudioService.setStreamVolume，比音量键更直接地触发路由重算
    await this.deviceShell("media volume --stream 3 --set 10 2>/dev/null; true", 6000);
    // 3) 媒体播放/暂停键：强制音频焦点重新申请，路由随之重算
    await this.deviceShell(
      "input keyevent 126 >/dev/null 2>&1; sleep 0.4; input keyevent 127 >/dev/null 2>&1; true",
      6000
    );
    // 4) 音量键兜底
    await this.refreshAudioRoute();
    // 注意：这里曾经有一步 `setprop ctl.restart audioserver`（重启系统音频服务），
    // 但实测在部分小米/安卓系统上音频服务重启后媒体时钟会跑快，视频变成几倍速
    // 播放且重启手机前无法恢复 —— 这一步得不偿失，彻底移除。
    // 若走到这里手机仍然无声，唯一可靠的恢复手段是重启手机。
  }

  /**
   * 会话开始前的一次性清理：把上一轮的看门狗、scrcpy 残留一起清掉，顺手读回 SDK 等级。
   * 以前这是 3~4 个 adb 往返 + 两次 sleep；现在整段在手机端跑完，只占一个往返。
   */
  async prepareDevice() {
    if (!this.adb) return { sdk: 0, remain: 0 };
    const out = String(
      (await this.deviceShell(
        'pkill -TERM -f "[p]anda_guard.sh" 2>/dev/null; ' +
          'pkill -9 -f "[p]anda_guard.sh" 2>/dev/null; ' +
          'pkill -TERM -f "[c]om.genymobile.scrcpy" 2>/dev/null; sleep 0.35; ' +
          'pkill -9 -f "[c]om.genymobile.scrcpy" 2>/dev/null; ' +
          'pkill -9 -f "[a]pp_process.*scrcpy" 2>/dev/null; ' +
          'echo "SDK=$(getprop ro.build.version.sdk)"; ' +
          'echo "REMAIN=$(ps -A 2>/dev/null | grep -c \'[c]om.genymobile.scrcpy\')"',
        10000
      )) || ""
    );
    const sdk = Number((/SDK=(\d+)/.exec(out) || [])[1] || 0);
    const remain = Number((/REMAIN=(\d+)/.exec(out) || [])[1] || 0);
    if (sdk > 0) this._sdk = sdk;
    if (remain) this.onLog("手机端仍有 " + remain + " 个 scrcpy 进程未退出，继续启动可能抢占音频");
    return { sdk, remain };
  }

  /**
   * v4.0.23 无线强制常亮。
   *
   * scrcpy 的 stay_awake 只改“插电时常亮”（stay_on_while_plugged_in），
   * 无线投屏时手机没有 AC/USB/Wireless 供电，系统仍按 screen_off_timeout 息屏。
   * 因此投屏期间临时把息屏时间设为最大值，并主动唤醒一次；原值保存在 _awakeSaved，
   * 由 stop / cleanupAfterDrop / _cleanupFailedStart 统一恢复。
   */
  async applyWirelessAwake() {
    if (!this._opts?.stayAwake || this._awakeApplied || !this.adb) return false;
    try {
      const raw = String((await this.deviceShell("settings get system screen_off_timeout", 6000)) || "").trim();
      let original = Number(raw);
      // 上次页面被直接关闭/服务被停止，恢复命令没发出去：下次连接先把快照补回去。
      const stored = this._readAwakeStored();
      if (stored != null) {
        if (Number.isFinite(original) && original >= 2000000000) {
          await this.deviceShell("settings put system screen_off_timeout " + stored, 6000);
          original = stored;
          this.onLog("检测到上次投屏未恢复息屏时间，已先补回 " + Math.round(stored / 1000) + " 秒");
        }
        this._clearAwakeStored();
      }
      if (!Number.isFinite(original) || original < 0 || original >= 2000000000) {
        this._awakeSaved = null;
      } else {
        this._awakeSaved = original;
        this._writeAwakeStored(original);
      }
      this._awakeApplied = true;
      await this.deviceShell(
        "settings put system screen_off_timeout 2147483647; input keyevent 224 2>/dev/null; true",
        8000
      );
      this.onLog(
        this._awakeSaved == null
          ? "已开启投屏强制常亮（原息屏时间未知或已是最大值，停止后无法自动恢复）"
          : "已开启投屏强制常亮（原息屏 " + Math.round(this._awakeSaved / 1000) + " 秒，停止后恢复）"
      );
      return true;
    } catch (e) {
      this.onLog("强制常亮设置失败 " + (e?.message || e));
      return false;
    }
  }

  async restoreWirelessAwake() {
    const saved = this._awakeSaved ?? this._readAwakeStored();
    if (!this._awakeApplied && saved == null) return true;
    if (saved == null || !this.adb) {
      this.onLog(
        saved == null
          ? "未能恢复息屏时间：原值未记录（可能上次页面被直接关闭）"
          : "未能恢复息屏时间：ADB 已断开，快照已保留，下次连接会自动补恢复"
      );
      return false;
    }
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await this.deviceShell("settings put system screen_off_timeout " + saved, 6000);
        await new Promise((resolve) => setTimeout(resolve, 300));
        const nowRaw = String((await this.deviceShell("settings get system screen_off_timeout", 6000)) || "").trim();
        const now = Number(nowRaw);
        if (Number.isFinite(now) && now === saved) {
          this._awakeApplied = false;
          this._awakeSaved = null;
          this._clearAwakeStored();
          this.onLog("已恢复手机息屏时间 " + Math.round(saved / 1000) + " 秒");
          return true;
        }
        this.onLog("恢复息屏时间校验不一致（第 " + attempt + " 次）：期望 " + saved + "，实际 " + (nowRaw || "无回显"));
      } catch (e) {
        this.onLog("恢复息屏时间失败（第 " + attempt + " 次）：" + (e?.message || e));
      }
    }
    this.onLog("息屏时间仍未恢复，已保留快照；下次连接设备时会自动补恢复");
    return false;
  }

  /**
   * 手机端看门狗（v4.0.12 起重新收敛为单一职责）：
   *
   *   无线会话失联  →  结束手机端 scrcpy、释放音频采集  →  自己退出
   *
   * 它不重连、不改用户的勿扰/音量设置、不猜网络状态。
   * 为什么必须由手机自己动手：手机主动关 Wi-Fi 时电脑根本连不上手机，
   * 任何远程清理都会失败；而断网后 scrcpy 的 socket 会被内核挂住十几分钟，
   * 进程不会自己退出、音频采集一直被占着 —— 这就是断网后手机长期没声音的根因。
   *
   * 判据只有两条（见文件顶部 GUARD_STALE 注释）：心跳过期、Wi-Fi 地址消失。
   * 布防只占一个 adb 往返（写脚本 → 语法校验 → 置一次心跳 → 起进程 → 回读运行标记），
   * 并且与 scrcpy 启动并行执行，不再拖慢连接。
   */
  async deployAudioGuard() {
    if (!this.adb) return false;
    const session = this._guardSession || (this._guardSession = newGuardSession());
    const body = this._guardScript(session);
    const bytes = new TextEncoder().encode(body);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
    const b64 = btoa(bin);
    const cmd =
      "echo '" + b64 + "' | base64 -d > " + GUARD_PATH + "; " +
      "chmod 755 " + GUARD_PATH + " 2>/dev/null; " +
      "sh -n " + GUARD_PATH + " 2>/dev/null || { echo GUARD_SYNTAX_FAIL; exit 0; }; " +
      "echo \"$(date +%s) " + session + "\" > " + guardHbPath(session) + "; " +
      "( nohup sh " + GUARD_PATH + " " + session + " </dev/null >/dev/null 2>&1 & ); " +
      // 轮询判活：设备忙时 sh 起来可能要 1 秒多，固定 sleep 会误报「未启动」
      "ok=0; i=0; while [ $i -lt 8 ]; do " +
      "now=$(date +%s); r=$(cat " + guardRunPath(session) + " 2>/dev/null); r=${r%% *}; " +
      'case "$r" in ""|*[!0-9]*) ;; *) if [ $((now-r)) -lt 25 ]; then ok=1; break; fi ;; esac; ' +
      "i=$((i+1)); sleep 0.3; done; " +
      'if [ $ok -eq 1 ]; then echo GUARD_ALIVE; else echo GUARD_DEAD; fi; ' +
      "tail -n 2 " + GUARD_LOG + " 2>/dev/null";

    const out = String((await this.deviceShell(cmd, 12000)) || "").trim();
    if (/GUARD_SYNTAX_FAIL/.test(out)) {
      this.onLog("看门狗脚本语法校验失败，已跳过布防（不影响本轮投屏）");
      return false;
    }
    const alive = /GUARD_ALIVE/.test(out);
    const tail = out
      .split(/\n/)
      .map((l) => l.trim())
      .filter((l) => l.startsWith("["))
      .join(" | ");
    if (alive) {
      this.onLog(
        "看门狗已布防：心跳 5s/次，失联超过 " + GUARD_STALE + "s 自动回收 scrcpy" +
          (tail ? "；手机日志 " + tail : "")
      );
    } else {
      this.onLog("看门狗未能启动。诊断回显：" + (out.replace(/\s*\n\s*/g, " | ") || "无输出"));
    }
    return alive;
  }

  /** 看门狗脚本正文（单独抽出来，方便本地仿真验证） */
  _guardScript(session) {
    const lines = [
      "#!/system/bin/sh",
      "# 单一职责：无线会话失联 -> 结束 scrcpy、释放音频采集 -> 退出。",
      "# 不重连、不改勿扰/音量、不猜网络；判据只有「心跳过期」与「Wi-Fi 地址消失」。",
      'SESSION="' + session + '"',
      "HB=" + guardHbPath(session),
      "RUN=" + guardRunPath(session),
      "LOG=" + GUARD_LOG,
      "STALE=" + String(GUARD_STALE),
      "IDLE=" + String(GUARD_IDLE_EXIT),
      'log() { echo "[$(date +%H:%M:%S)] $*" >> "$LOG"; }',
      'log "guard start session=$SESSION stale=${STALE}s"',
      "IFACE=$(ip link 2>/dev/null | sed -n 's/^[0-9]*: \\(wlan[^:]*\\):.*/\\1/p' | head -n 1)",
      'if [ -z "$IFACE" ]; then IFACE=wlan0; fi',
      "had_ip=0; lost=0; tick=0; hb_seen=0",
      "while :; do",
      "  now=$(date +%s)",
      "  tick=$((tick+1))",
      // 运行标记：第一轮立即写一次（宿主要靠它判断有没有起来），之后每 5 轮（约 10 秒）一次
      '  if [ "$tick" -le 1 ] || [ $((tick % 5)) -eq 0 ]; then echo "$now $SESSION" > "$RUN"; fi',
      '  hb=$(cat "$HB" 2>/dev/null)',
      "  hb_ts=${hb%% *}",
      "  hb_sess=${hb#* }",
      // 新会话接手：立刻退场，绝不动新会话的 scrcpy
      '  if [ -n "$hb_sess" ] && [ "$hb_sess" != "$hb" ] && [ "$hb_sess" != "$SESSION" ]; then',
      '    log "superseded by $hb_sess, exit"; exit 0',
      "  fi",
      '  case "$hb_ts" in ""|*[!0-9]*) hb_ts="";; esac',
      '  if [ -n "$hb_ts" ]; then hb_seen=1; fi',
      // Wi-Fi 地址消失是确定事实：连续 2 次（约 4 秒）即判定，不必等心跳过期
      '  if ip -4 addr show "$IFACE" 2>/dev/null | grep -q "inet "; then',
      "    had_ip=1; lost=0",
      "  else",
      '    [ "$had_ip" -eq 1 ] && lost=$((lost+1))',
      "  fi",
      '  dead=0; why=""',
      '  if [ "$lost" -ge 2 ]; then dead=1; why="wifi ip gone x$lost"; fi',
      '  if [ -n "$hb_ts" ]; then',
      "    age=$((now - hb_ts))",
      '    if [ "$age" -gt "$STALE" ]; then dead=1; why="heartbeat ${age}s stale"; fi',
      "  fi",
      // 布防前一定先写心跳：读不到就是异常（写失败 / 文件被清），按失联处理，别让手机哑着
      '  if [ "$hb_seen" -eq 0 ] && [ "$tick" -ge $((IDLE / 2)) ]; then dead=1; why="no heartbeat in ${IDLE}s"; fi',
      '  if [ "$dead" -eq 1 ]; then',
      '    log "session dead ($why) -> release scrcpy"',
      '    pkill -TERM -f "[c]om.genymobile.scrcpy" 2>/dev/null',
      "    sleep 1",
      '    pkill -9 -f "[c]om.genymobile.scrcpy" 2>/dev/null',
      '    pkill -9 -f "[a]pp_process.*scrcpy" 2>/dev/null',
      // 只做净音量不变的「路由刷新」：不动勿扰、不按键、不改用户音量
      "    " + AUDIO_ROUTE_CMD,
      '    remain=$(ps -A 2>/dev/null | grep -c "[c]om.genymobile.scrcpy")',
      '    log "released remain=$remain"',
      "    exit 0",
      "  fi",
      "  sleep 2",
      "done",
    ];
    return lines.join("\n");
  }

  async isAudioGuardAlive() {
    if (!this.adb || !this._guardSession) return false;
    // 用运行标记判活：ps 在 Android 上只显示进程名、匹配不到脚本参数（v3.0.12 的误报根因）
    const out = await this.deviceShell(
      "now=$(date +%s); r=$(cat " + guardRunPath(this._guardSession) + " 2>/dev/null); r=${r%% *}; " +
        'case "$r" in ""|*[!0-9]*) echo DEAD ;; *) [ $((now-r)) -lt 25 ] && echo ALIVE || echo DEAD ;; esac',
      5000
    );
    return /ALIVE/.test(String(out || "").trim());
  }

  /** 读回手机端看门狗日志（末尾若干行），用于确认它有没有真的跑起来 */
  async readAudioGuardLog(lines = 8) {
    if (!this.adb) return "";
    const out = await this.deviceShell(
      "tail -n " + lines + " " + GUARD_LOG + " 2>/dev/null",
      5000
    );
    return String(out || "").trim();
  }

  /** 给手机端看门狗喂心跳：写入「本地时间戳 + 会话号」，写成功即证明通道还活着 */
  async heartbeat() {
    if (!this.adb || !this._guardSession) return false;
    try {
      await this.deviceShell(
        "echo \"$(date +%s) " + this._guardSession + "\" > " + guardHbPath(this._guardSession),
        5000
      );
      return true;
    } catch {
      return false;
    }
  }

  async stopAudioGuard() {
    if (!this.adb) return;
    await this.deviceShell(
      'pkill -TERM -f "[p]anda_guard.sh" 2>/dev/null; sleep 0.3; ' +
        'pkill -9 -f "[p]anda_guard.sh" 2>/dev/null; true',
      5000
    );
  }

  /**
   * 主动收尾（停止投屏 / 断线后仍能连上手机时）：看门狗退场 + scrcpy 结束 + 路由刷新。
   * 一次 shell 跑完，替换原来 stopAudioGuard → kill（含 2 次 sleep）→ refresh 的串行往返。
   */
  async releaseSessionOnDevice() {
    if (!this.adb) return false;
    this._guardSession = "";
    const out = String(
      (await this.deviceShell(
        'pkill -TERM -f "[p]anda_guard.sh" 2>/dev/null; ' +
          'pkill -TERM -f "[c]om.genymobile.scrcpy" 2>/dev/null; sleep 0.45; ' +
          'pkill -9 -f "[p]anda_guard.sh" 2>/dev/null; ' +
          'pkill -9 -f "[c]om.genymobile.scrcpy" 2>/dev/null; ' +
          'pkill -9 -f "[a]pp_process.*scrcpy" 2>/dev/null; ' +
          AUDIO_ROUTE_CMD + "; " +
          'echo "REMAIN=$(ps -A 2>/dev/null | grep -c \'[c]om.genymobile.scrcpy\')"',
        15000
      )) || ""
    );
    const remain = Number((/REMAIN=(\d+)/.exec(out) || [])[1] || 0);
    if (remain) this.onLog("手机端 scrcpy 仍在运行（" + remain + " 个进程），音频可能仍被占用");
    return remain === 0;
  }

  /** 终止手机端 scrcpy 并刷新音频路由（它会占着音频采集，导致手机一直没声音） */
  async releaseScrcpyOnDevice() {
    if (!this.adb) return false;
    try {
      return await Promise.race([
        this.releaseSessionOnDevice(),
        new Promise((resolve) => setTimeout(() => resolve(false), 12000)),
      ]);
    } catch {
      return false;
    }
  }

  /**
   * 读取设备友好名称（用于状态页顶部展示）。
   * 优先 Xiaomi 的 marketname（如「Xiaomi 17 Pro」），否则「品牌 + 型号」。
   */
  async readDeviceName() {
    if (this._deviceLabel) return this._deviceLabel;
    const np = this.adb?.subprocess?.noneProtocol;
    if (!np) return "";
    const prop = async (key) => {
      try {
        return String(await np.spawnWaitText(["getprop", key]) || "").trim();
      } catch {
        return "";
      }
    };
    const brand = await prop("ro.product.brand");
    const model = await prop("ro.product.model");
    const market = await prop("ro.product.marketname");
    let label = market || [brand, model].filter(Boolean).join(" ");
    if (label && model && !label.toLowerCase().includes(String(model).toLowerCase())) {
      label += " " + model;
    }
    this._deviceLabel = label;
    return label;
  }

  /** 读取 Android API 等级（用于判断是否支持 audio-dup） */
  async getAndroidSdk() {
    if (this._sdk) return this._sdk;
    try {
      const txt = await this.adb.subprocess.noneProtocol.spawnWaitText([
        "getprop",
        "ro.build.version.sdk",
      ]);
      const n = parseInt(String(txt || "").trim(), 10);
      if (Number.isFinite(n) && n > 0) this._sdk = n;
    } catch {
      /* ignore */
    }
    return this._sdk || 0;
  }

  /** 无线意外断线后，短时间重连一次手机，把残留的 scrcpy 进程杀掉，恢复手机声音 */
  async restoreWirelessAudio() {
    const target = this._wirelessTarget;
    if (!target) return false;
    let conn = null;
    try {
      this.onLog("尝试重连手机释放音频…");
      conn = await connectWireless(target, () => {});
      this.adb = conn.adb;
      const glog = await this.readAudioGuardLog(8);
      if (glog) this.onLog("看门狗日志：" + glog.replace(/\n/g, " | "));
      const ok = await this.releaseSessionOnDevice();
      await this.restoreWirelessAwake();
      this.onLog(ok ? "已结束手机端 scrcpy 并刷新音频路由" : "未能结束手机端 scrcpy，音频可能仍被占用");
      return ok;
    } catch (e) {
      this.onLog("恢复尝试失败：" + (e?.message || e));
      return false;
    } finally {
      try {
        await conn?.dispose();
      } catch {
        /* ignore */
      }
      this.adb = null;
    }
  }

  /** 无线链路心跳：真发一条 shell 命令，能立刻发现手机已断开（而不是等 TCP 超时） */
  async ping(timeoutMs = 4000) {
    if (!this.adb?.subprocess?.noneProtocol) return false;
    try {
      return await Promise.race([
        this.adb.subprocess.noneProtocol.spawnWaitText(["true"]).then(() => true),
        new Promise((resolve) => setTimeout(() => resolve(false), timeoutMs)),
      ]);
    } catch {
      return false;
    }
  }

  /** 最近一次从手机收到数据的时间戳（ms）；0 = 无线链路不在/从未收到 */
  linkLastRecv() {
    const fn = this._wirelessLastRecv;
    if (typeof fn !== "function") return 0;
    try {
      const t = fn();
      return Number.isFinite(t) ? t : 0;
    } catch {
      return 0;
    }
  }

  /** 心跳判定链路已断：主动收尾，并尝试杀掉手机端 scrcpy、恢复手机声音 */
  async handleLinkLost() {
    if (this._stopRequested || !this.running) return;
    this._stopRequested = true;
    this._dropHandled = true;
    this.running = false;
    this.status("无线链路已断开");
    try {
      await Promise.race([
        this.client?.close(),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);
    } catch {
      /* ignore */
    }
    this.client = null;
    await this.cleanupAfterDrop("无线心跳超时");
  }

  /** 手机短暂离线时，后台每隔几秒试着重新连上，一连上就清掉残留的 scrcpy */
  _scheduleLateCleanup() {
    const target = this._wirelessTarget;
    if (!target || this._lateActive) return;
    this._lateActive = true;
    let tries = 0;
    const tick = async () => {
      this._lateTimer = null;
      if (!this._lateActive || tries >= 20) {
        this._lateActive = false;
        return;
      }
      tries += 1;
      let conn = null;
      try {
        conn = await connectWireless(target, () => {});
        if (!this._lateActive || this.running) {
          // 期间用户已经重新开了会话，别插手
          this._lateActive = false;
          await conn.dispose();
          return;
        }
        this.adb = conn.adb;
        // 先回读看门狗日志：它到底有没有跑、什么时候动手的，全在这一步见分晓
        const glog = await this.readAudioGuardLog(8);
        if (glog) {
          this.onLog("看门狗日志：" + glog.replace(/\n/g, " | "));
        } else {
          this.onLog("看门狗未留下日志：本轮可能未启动成功（若日志常出现此行请反馈）");
        }
        const ok = await this.releaseSessionOnDevice();
        this._lateActive = false;
        this.onLog(
          ok
            ? "手机已重新上线，已结束残留 scrcpy 并刷新音频路由，声音应已恢复"
            : "手机已上线但未能结束 scrcpy，请点顶栏「恢复声音」"
        );
        return;
      } catch {
        /* 手机还没回到网络 */
      } finally {
        try {
          await conn?.dispose();
        } catch {
          /* ignore */
        }
        this.adb = null;
      }
      if (this._lateActive) this._lateTimer = setTimeout(tick, 6000);
    };
    this._lateTimer = setTimeout(tick, 6000);
  }

  /** 非用户主动停止的断线：停止播放 + 释放手机端音频占用 + 清掉舞台画面 */
  async cleanupAfterDrop(reason) {
    if (this._dropHandled || this._cleaned) return;
    this._dropHandled = true;
    this._cleaned = true;
    this.running = false;
    this.onLog("连接中断原因：" + reason);
    // 断开就该无画面：立即停解码器、移除画布，不留冻住的最后一帧
    this._teardownRenderer();
    try {
      await this.audio?.stop();
    } catch {
      /* ignore */
    }
    this.audio = new AudioMirror();
    // 链路还活着时直接清；已断则只能靠手机端看门狗/重连后清
    await this.restoreWirelessAwake();
    await this.releaseScrcpyOnDevice();
    if (this._wirelessTarget) {
      this.status("无线已断开，正在恢复手机声音…");
      const ok = await this.restoreWirelessAudio();
      // 重连成功后 ADB 又可用，补一次息屏时间恢复（第一次可能因断网失败）
      await this.restoreWirelessAwake();
      if (ok) {
        this.onLog("手机声音已恢复");
      } else {
        this.onLog(
          "手机已离网，无法远程清理：手机端看门狗会在后台结束 scrcpy；重新联网后若仍无声，按一次音量键即可"
        );
        this._scheduleLateCleanup();
      }
    }
    await this._runBeforeTeardown();
    try {
      await this.adb?.close();
    } catch {
      /* ignore */
    }
    this.adb = null;
    await this._closeUsbHandle();
    this.deviceController = null;
    this.status("已断开");
  }

  async pushServerWireless(target) {
    this.onLog("通过本地官方 ADB 上传 scrcpy-server…");
    const response = await fetch("/api/wireless-push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new MirrorError(result.error || "无线 server 上传失败", "SERVER_UPLOAD");
    }
    this._wirelessServerUploaded = target;
    this.onLog("scrcpy-server 无线上传完成");
  }

  hasServerJarCache() {
    return this._usbServerBytes instanceof ArrayBuffer && this._usbServerBytes.byteLength > 0;
  }

  /** 页面就绪时提前缓存 jar，避免「服务先停止、用户再点连接」时没有兜底。 */
  prefetchServerJar() {
    if (this.hasServerJarCache()) return Promise.resolve(this._usbServerBytes);
    if (this._serverJarPrefetch) return this._serverJarPrefetch;
    this._serverJarPrefetch = this._readServerJar()
      .then((buf) => {
        this.onLog(`已预缓存 scrcpy-server.jar（${buf.byteLength} 字节）`);
        return buf;
      })
      .catch(() => null)
      .finally(() => {
        this._serverJarPrefetch = null;
      });
    return this._serverJarPrefetch;
  }

  /**
   * 本地 HTTP 服务只在页面加载和 jar 下载时是强依赖。
   * 首次拿到 scrcpy-server.jar 后保留原字节，断线重连优先用缓存，
   * 避免「页面还活着、8765 已停止」时每次 ADB 认证成功却都卡在 Failed to fetch。
   */
  async _readServerJar() {
    const url = new URL(SERVER_URL, location.href).href;
    try {
      const resp = await fetch(url, { cache: "no-cache" });
      if (!resp.ok) {
        throw new MirrorError(`加载 scrcpy-server.jar 失败（HTTP ${resp.status}）`, "NO_SERVER");
      }
      const buf = await resp.arrayBuffer();
      if (!buf.byteLength) {
        throw new MirrorError("scrcpy-server.jar 内容为空", "NO_SERVER");
      }
      this._usbServerBytes = buf;
      this._usbServerBytesAt = Date.now();
      return buf;
    } catch (err) {
      if (this.hasServerJarCache()) {
        const age = Math.round((Date.now() - this._usbServerBytesAt) / 1000);
        this.onLog(
          `本地服务不可用，改用内存缓存的 scrcpy-server.jar（${this._usbServerBytes.byteLength} 字节，缓存 ${age} 秒）`
        );
        return this._usbServerBytes;
      }
      const reason = String(err?.message || err);
      if (/Failed to fetch|NetworkError|ERR_CONNECTION|HTTP \d+/i.test(reason)) {
        throw new MirrorError(
          `无法下载 scrcpy-server.jar，且当前没有内存缓存。\n本地服务可能已停止，请重新启动 scrcpy 便捷网页版后刷新页面。\n目标：${url}`,
          "NO_SERVER",
          err
        );
      }
      throw new MirrorError("下载 scrcpy-server.jar 失败：" + reason, "NO_SERVER", err);
    }
  }

  async pushServer() {
    if (this._wirelessTarget) {
      if (this._wirelessServerUploaded !== this._wirelessTarget) {
        throw new MirrorError("无线 server 尚未完成预上传", "SERVER_UPLOAD");
      }
      return;
    }
    if (this._usbServerUploaded && this.device?.serial === this._usbServerUploaded) {
      return;
    }
    this.status("上传 scrcpy-server…");
    const buf = await this._readServerJar();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Consumable(new Uint8Array(buf)));
        controller.close();
      },
    });
    await AdbScrcpyClient.pushServer(this.adb, stream);
  }

  _mountRenderer() {
    if (!this.stage) throw new MirrorError("缺少渲染容器", "NO_STAGE");
    // 挂新画布前先清场：上一轮的画布/解码器必须移除，否则重连后两幅画面叠影
    this._teardownRenderer();
    const { renderer, kind } = createRenderer();
    this.rendererKind = kind;
    // 限速包装：丢积压帧，防「几倍加速快进」
    this.pacedRenderer = new PacedRenderer(renderer, (this._opts || {}).maxFps, {
      takeArrival: () => (this._pktArrivals.length ? this._pktArrivals.shift() : 0),
      onLatency: (ms) => {
        if (!Number.isFinite(ms) || ms < 0 || ms > 5000) return;
        // EMA 平滑，避免单帧抖动让读数乱跳
        this._latencyMs = this._latencyMs == null ? ms : this._latencyMs * 0.7 + ms * 0.3;
      },
    });
    this.decoder = new WebCodecsVideoDecoder({
      codec: ScrcpyVideoCodecId.H264,
      renderer: this.pacedRenderer,
    });
    const el = renderer.canvas;
    el.style.display = "block";
    el.style.touchAction = "none";
    el.style.cursor = "default";
    this.stage.appendChild(el);
    this.canvas = el;
  }

  /** 移除舞台上的旧画布并释放旧解码器（幂等，可重复调用） */
  _teardownRenderer() {
    try {
      this.decoder?.dispose();
    } catch {
      /* ignore */
    }
    this.decoder = null;
    this.pacedRenderer = null;
    // 兜底清空舞台上所有 canvas（不只 this.canvas，防止任何路径留下的残留）
    try {
      this.stage.querySelectorAll("canvas").forEach((c) => c.remove());
    } catch {
      /* ignore */
    }
    this.canvas = null;
  }

  async startStream() {
    if (!this.adb) throw new MirrorError("ADB 未连接", "NO_ADB");
    this._stopRequested = false;
    this._dropHandled = false;
    this._cleaned = false;
    this._diagLastPacketAt = 0;
    this._diagLastPacketKind = "";
    this._diagLastDecoderError = "";
    this._diagUsbEvent = "";
    // 防御：上一轮会话若还挂着（例如崩溃后直接点重新连接），先关掉再开新的
    if (this.client) {
      try {
        await Promise.race([
          this.client.close(),
          new Promise((resolve) => setTimeout(resolve, 1200)),
        ]);
      } catch {
        /* ignore */
      }
      this.client = null;
    }
    const o = this._opts || {};

    // 不改动手机的系统设置（锁屏时间 / 屏保），保持用户原样。
    // 需要常亮请用「保持唤醒」(scrcpy stay_awake)，它只在本次会话生效。
    // prepareDevice 一次 shell 完成「清上一轮 scrcpy/看门狗 + 读 SDK」，省掉 3~4 个往返
    let prep = { sdk: 0, remain: 0 };
    try {
      prep = await this.prepareDevice();
    } catch (e) {
      this.onLog("启动前清理异常（不影响继续连接）：" + (e?.message || e));
    }
    const sdk = prep.sdk || (await this.getAndroidSdk());
    const camMode = String(o.videoSource || "display").startsWith("camera");
    // 声音输出三态：both=手机+电脑 / phone=仅手机(不转发) / pc=仅电脑(手机静音)
    const audioMode = o.audioMode || "both";
    const wantDup = audioMode === "both";
    const wantAudio = audioMode !== "phone";
    // audio-dup 需要 Android 13(API33) 的 playback 采集；摄像头模式用的是麦克风，不能叠加
    const audioDup = wantDup && sdk >= 33 && !camMode;
    // Android 12 及以下的 scrcpy 音频没有「同时外放」能力，一转发就会把手机自己静音。
    // 无线断连后进程还残留着，手机就一直哑着 —— 这种情况宁可不转发音频，
    // 保证手机始终有声（电脑侧没有声音，但看画面不受影响）。
    const audioOn = wantAudio && (camMode || audioDup || !wantDup);
    if (audioMode === "phone") {
      this.onLog("声音输出=仅手机：不转发音频，手机保持原样出声，电脑端静音");
    } else if (audioMode === "pc") {
      this.onLog("声音输出=仅电脑：投屏期间手机会静音（scrcpy 音频占用），断开后会自动恢复");
    } else if (wantDup && !camMode && !audioDup && sdk > 0) {
      this.onLog(
        "Android API " + sdk + " 不支持「手机同时外放」(需 Android 13+)；已改为不转发音频，手机声音保持正常"
      );
    }

    // 上一轮的 scrcpy / 看门狗已由 prepareDevice 在一次 shell 里清掉。
    // 无线的看门狗布防改为与 scrcpy 启动并行：原来它是串行 6 个往返 + 2 次 sleep，是连接慢的主因。
    const guardTask = this._wirelessTarget
      ? this.deployAudioGuard().catch((e) => {
          this.onLog("看门狗布防异常（不影响投屏）：" + (e?.message || e));
          return false;
        })
      : Promise.resolve(false);
    await this.pushServer();
    this._mountRenderer();

    this.status("启动投屏…");
    const source = o.videoSource || "display";
    const isCam = String(source).startsWith("camera");
    const options = new AdbScrcpyOptions3_3_3({
      maxSize: Number.isFinite(o.maxSize) ? o.maxSize : 1280, // 0 = 原始分辨率
      videoBitRate: o.videoBitRate || 8_000_000,
      videoCodec: "h264",
      maxFps: Number.isFinite(o.maxFps) ? o.maxFps : 60, // 0 = 不限
      displayId: 0,
      powerOn: true,
      stayAwake: !!o.stayAwake,
      powerOffOnClose: !!o.powerOffOnClose,
      showTouches: !!o.showTouches,
      audio: audioOn,
      audioCodec: "raw",
      audioDup,
      control: true,
      logLevel: "debug",
      scid: ScrcpyInstanceId.random(),
      sendDeviceMeta: false,
      sendDummyByte: false,
      // scrcpy 5.0.1 将会话分辨率从编码器头中拆出；现有解码管线使用帧内 SPS 获取尺寸。
      sendCodecMeta: false,
      sendFrameMeta: true,
      videoCodecOptions: new ScrcpyCodecOptions(),
      tunnelForward: false,
      videoSource: isCam ? "camera" : "display",
    }, {
      // adb-scrcpy 从第二参数读取服务端版本；放错位置会仍按 3.3.3 启动。
      version: "5.0.1",
    });
    const serializeOptions = options.serialize.bind(options);
    // 不能用 @：@ 会锁定连接瞬间的方向，横屏应用启动后会被塞回竖屏并侧转 90°。
    // 传 0 表示不做额外旋转，由 scrcpy server 跟随设备当前方向重新编码。
    options.serialize = () => serializeOptions()
      .filter((line) => !line.startsWith("send_codec_meta="))
      .concat("send_stream_meta=false", "capture_orientation=0");
    if (isCam) {
      try {
        options.value.cameraId = source === "camera_front" ? "1" : "0";
        options.value.cameraFacing = source === "camera_front" ? "front" : "back";
      } catch { /* ignore */ }
    }
    // v4.2.11：scrcpy 5.0.1 + send_stream_meta=false 时音频流没有 codec id 头，
    // 旧客户端解析会把首帧 PTS=0 误判成「音频被禁用」，导致电脑端无声。
    if (audioOn) {
      patchV5AudioMeta(options);
      this.onLog("已应用 scrcpy 5.x 音频流兼容补丁（跳过音频 codec id 预读）");
    }
    this.onLog(summarizeScrcpyOptions({
      serverVersion: options.version,
      maxSize: o.maxSize || 1280,
      fps: o.maxFps || 60,
      bitrate: o.videoBitRate,
      source,
      stayAwake: !!o.stayAwake,
      showTouches: !!o.showTouches,
      powerOffOnClose: !!o.powerOffOnClose,
      audioDup,
      audioOn,
      audioMode,
    }));

    if (o.maxSize === 0 || o.maxFps === 0) {
      this.onLog("提示：原始分辨率 / 不限帧率对解码压力很大，若画面卡顿或异常加速，建议改回 1280 + 60fps + 8Mbps");
    }
    this.client = await AdbScrcpyClient.start(this.adb, DefaultServerPath, options);
    if (!this.client) throw new MirrorError("scrcpy 客户端启动失败", "SCRCPY_FAIL");
    if (this._wirelessTarget) {
      const guardReady = await guardTask;
      this.onLog(guardReady ? "看门狗布防完成（与启动并行，不占连接时间）" : "看门狗未布防，断网时只能靠重连后清理");
    }

    const logSink = (msg) => this.onLog(translateServerLine(String(msg)));
    this.client.output
      .pipeTo(
        new WritableStream({
          write(chunk) {
            console.debug("[scrcpy]", chunk);
            // 服务端可能一次吐多行，逐行翻译后再进日志面板
            String(chunk)
              .split(/\r?\n/)
              .map((l) => l.trim())
              .filter(Boolean)
              .forEach((line) => logSink(line));
          },
        })
      )
      .catch(() => {});

    const videoStream = await this.client.videoStream;
    if (!videoStream) throw new MirrorError("scrcpy 未返回视频流", "NO_VIDEO");

    // v4.0.23：视频流就绪后再改息屏时间，启动失败不会留下被改过的系统设置。
    await this.applyWirelessAwake();

    const { metadata, stream: packetStream } = videoStream;
    this._size = {
      width: metadata?.width || 0,
      height: metadata?.height || 0,
    };

    this.deviceController = new DeviceController(this.client, {
      width: () => this._size.width,
      height: () => this._size.height,
    }, this.adb);
    this.onController(this.deviceController, this.canvas);
    if (this._opts?.turnScreenOff) {
      try {
        await this.deviceController.screenOff();
        this.onLog("启动后已关闭设备屏幕");
      } catch (e) {
        this.onLog("关闭屏幕失败 " + (e?.message || e));
      }
    }

    // audio (v2)
    if (!audioOn) {
      this.onStats({ ...this._stats(), audio: "未转发（手机原样出声）" });
    }
    try {
      if (audioOn && this.client.audioStream) {
        // 音频重同步等事件直接进日志面板，方便对照音画不同步
        this.audio.onLog = (m) => this.onLog(String(m));
        const audioMeta = await this.client.audioStream;
        const audioResult = await this.audio.start(audioMeta);
        const modeZh = (m) => {
          const s = String(m || "");
          if (s.startsWith("pcm")) return "PCM 原始";
          if (s.startsWith("webcodecs:")) return "WebCodecs " + s.slice("webcodecs:".length).toUpperCase();
          return s || "未知";
        };
        if (audioResult?.ok) {
          this.onStats({ ...this._stats(), audio: modeZh(audioResult.mode) });
          // 延迟回报一帧统计，便于排查无声
          setTimeout(() => {
            const st = this.audio?.stats;
            this.onStats({
              ...this._stats(),
              audio: `音频 ${modeZh(audioResult.mode)} · 收包 ${st?.packets || 0} · 缓冲 ${st?.bufferedMs != null ? st.bufferedMs + "ms" : "—"} · 欠载 ${st?.underruns || 0} · 削减 ${st?.dropped || 0}${st?.err && st.err !== "—" ? " · 异常 " + st.err : ""}`,
            });
          }, 1500);
        } else {
          console.warn("[audio] skipped", audioResult?.reason);
          this.onStats({ ...this._stats(), audio: "无音频:" + (audioResult?.reason || "") });
        }
      }
    } catch (e) {
      console.warn("[audio] start failed", e);
    }

    this.onStats(this._stats());

    let first = true;
    let h264ConfigSeen = false;
    const logPacketConfig = (msg) => this.onLog(msg);
    packetStream
      .pipeThrough(
        new TransformStream({
          transform(packet, controller) {
            if (packet?.type === "configuration") {
              h264ConfigSeen = true;
            } else if (!h264ConfigSeen && packet?.type === "data" && packet.keyframe) {
              const config = extractH264ParameterSets(packet.data);
              if (config) {
                controller.enqueue({ type: "configuration", data: config });
                logPacketConfig("已从首个关键帧补出 H.264 配置包");
                h264ConfigSeen = true;
                if (!h264HasSlice(packet.data)) {
                  logPacketConfig("首个纯参数集包已跳过，等待真正的 IDR 帧");
                  return;
                }
              }
            }
            if (packet?.type === "data" && !packet.keyframe && h264HasIdr(packet.data)) {
              // 每 10 秒一个 I 帧都会命中，属于稳态行为，不再写日志刷屏
              packet.keyframe = true;
            }
            controller.enqueue(packet);
          },
        })
      )
      .pipeThrough(
        new InspectStream((packet) => {
          this._diagLastPacketAt = Date.now();
          this._diagLastPacketKind = String(packet?.type || "") + (packet?.keyframe ? "/key" : "");
          try {
            if (packet?.type === "configuration") {
              const { croppedWidth, croppedHeight } = h264ParseConfiguration(packet.data);
              if (croppedWidth > 0 && croppedHeight > 0) {
                this._size = { width: croppedWidth, height: croppedHeight };
                this.onStats(this._stats());
              }
            } else if (packet?.type === "data") {
              this.frames += 1;
              // 记到达时刻给渲染端算延迟；解码器内部丢帧时队列会偏长，做上限保护
              this._pktArrivals.push(Date.now());
              if (this._pktArrivals.length > 150) this._pktArrivals.splice(0, this._pktArrivals.length - 150);
              // 滑动窗口帧率（每 500ms 结算一次），比「全程平均」更能反映当前状态
              if (!this._fpsWinStart) this._fpsWinStart = performance.now();
              this._fpsWinCount += 1;
              const winMs = performance.now() - this._fpsWinStart;
              if (winMs >= 500) {
                this._fps = ((this._fpsWinCount * 1000) / winMs).toFixed(1);
                this._fpsWinStart = performance.now();
                this._fpsWinCount = 0;
              }
              if (first) {
                first = false;
                this.onFirstFrame(this._size);
              }
              if (this.frames % 30 === 0) this.onStats(this._stats());
            }
          } catch (e) {
            console.warn("packet inspect", e);
          }
        })
      )
      .pipeTo(this.decoder.writable)
      .catch((err) => {
        if (!this._stopRequested) {
          this._diagLastDecoderError = String(err?.name || "Error") + ": " + String(err?.message || err);
          console.error("video pipe", err);
          this.onError(err);
          this.cleanupAfterDrop("视频解码管道异常：" + String(err?.message || err)).catch(() => {});
        }
      });

    this.running = true;
    this.startTs = performance.now();
    this.status("投屏中");
    this.onStats(this._stats());
    // 画面静止时收不到新帧，指标会僵住；用 500ms 心跳补齐声音延迟等读数
    if (this._statsTimer) clearInterval(this._statsTimer);
    this._statsTimer = setInterval(() => {
      if (this.running) {
        try { this.onStats(this._stats()); } catch { /* ignore */ }
      }
    }, 500);
    this.client.exited.then(() => {
      const upSec = this.startTs ? Math.round((performance.now() - this.startTs) / 1000) : 0;
      const lastAge = this._diagLastPacketAt ? Math.round((Date.now() - this._diagLastPacketAt) / 1000) : -1;
      this.onLog(
        `控制通道退出 · 主动停止=${this._stopRequested ? "是" : "否"} · 运行 ${upSec}s · 累计 ${this.frames} 帧 · ` +
        `最后一帧视频包 ${lastAge >= 0 ? lastAge + "s 前（" + (this._diagLastPacketKind || "未知") + "）" : "无"} · ` +
        `解码错误 ${this._diagLastDecoderError || "无"} · USB 事件 ${this._diagUsbEvent || "无"}`
      );
      if (!this._stopRequested) {
        this.running = false;
        this.status("投屏已结束");
        this.cleanupAfterDrop("scrcpy 控制通道退出").catch(() => {});
      }
    }).catch((e) => {
      const output = Array.isArray(e?.output) ? e.output.slice(-8).map((l) => translateServerLine(String(l))).join(" | ") : "";
      const reason = "控制通道异常：" + String(e?.name || "错误") + ": " + String(e?.message || e) +
        (output ? "；服务端输出 " + output : "");
      this.onLog(reason);
      if (!this._stopRequested) this.cleanupAfterDrop(reason).catch(() => {});
    });
    // 不能只盯 decoder.pipeTo 的 reject：ReadableStream 正常 close 时 pipeTo 会 resolve，
    // 旧逻辑因此漏掉视频/音频通道关闭，表现为冻屏但仍显示「投屏中」。
    const watchChannel = (stream, channel) => {
      if (!stream?.closed) return;
      stream.closed.then(() => {
        if (!this._stopRequested) this.cleanupAfterDrop(channel + "已关闭").catch(() => {});
      }).catch((e) => {
        const reason = channel + "异常：" + String(e?.message || e);
        this.onLog(reason);
        if (!this._stopRequested) this.cleanupAfterDrop(reason).catch(() => {});
      });
    };
    watchChannel(this.videoStream, "视频通道");
    watchChannel(this.audioStream, "音频通道");
  }

  _stats() {
    const elapsed = (performance.now() - this.startTs) / 1000;
    const avgFps = elapsed > 0 && this.frames ? (this.frames / elapsed).toFixed(1) : "0";
    return {
      frames: this.frames,
      fps: this._fps && this._fps !== "0" ? this._fps : avgFps,
      vdrop: this.pacedRenderer ? this.pacedRenderer.dropped : 0,
      width: this._size.width,
      height: this._size.height,
      latencyMs: this._latencyMs == null ? null : Math.round(this._latencyMs),
      audioLatency: this.audio?.latencyMs ?? null,
      running: this.running,
      renderer: this.rendererKind,
    };
  }

  async snapshot() {
    if (this.decoder?.snapshot) {
      const blob = await this.decoder.snapshot();
      if (blob) return blob;
    }
    if (this.canvas?.toBlob) {
      return await new Promise((resolve) => this.canvas.toBlob((b) => resolve(b), "image/png"));
    }
    return null;
  }

  async stop() {
    this._stopRequested = true;
    this._dropHandled = true;
    this._cleaned = true;
    this.running = false;
    if (this._statsTimer) {
      clearInterval(this._statsTimer);
      this._statsTimer = null;
    }
    if (this._lateTimer) {
      clearTimeout(this._lateTimer);
      this._lateTimer = null;
    }
    this._lateActive = false;
    // v4.2.2：先把息屏时间恢复掉，再去做可能超时的收尾。
    // 旧顺序把它放在最后，「停止服务」只等 3 秒时会被直接截断，手机就停在最大值。
    await this.restoreWirelessAwake();
    // 关闭 ADB 通道前先恢复手机原输入法，否则通道一断恢复命令就发不出去
    await this._runBeforeTeardown();
    try {
      await this.deviceController?.dispose();
    } catch {
      /* ignore */
    }
    this.deviceController = null;
    try { await this.audio?.stop(); } catch { /* ignore */ }
    this.audio = new AudioMirror();
    // 顺序很重要：先让 scrcpy 收尾、再在手机端一次性清理，最后才断 ADB / 无线通道。
    // 旧版先把无线通道 dispose 掉，清理命令发不出去，只能等看门狗兜底。
    try {
      await Promise.race([
        this.client?.close(),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);
    } catch {
      /* ignore */
    }
    this.client = null;
    // 主动停止同样清空舞台画面（与断线路径一致：断开即无画面）
    this._teardownRenderer();
    try {
      if (this.adb) {
        await Promise.race([
          this.releaseSessionOnDevice(),
          new Promise((resolve) => setTimeout(resolve, 6000)),
        ]);
      }
    } catch {
      /* ignore */
    }
    await this.restoreWirelessAwake();
    try {
      await this.adb?.close();
    } catch {
      /* ignore */
    }
    try { await this._wirelessDispose?.(); } catch { /* ignore */ }
    this._wirelessDispose = null;
    this.adb = null;
    await this._closeUsbHandle();
    this.status("已断开");
    this.onStats({ ...this._stats(), running: false });
  }

  /** 启动失败时释放 WebUSB / ADB / 解码器，避免页面自己把接口占住 */
  async _cleanupFailedStart() {
    try {
      await this.client?.close();
    } catch {
      /* ignore */
    }
    this.client = null;
    await this.restoreWirelessAwake();
    try {
      await this.adb?.close();
    } catch {
      /* ignore */
    }
    this.adb = null;
    await this._closeUsbHandle();
    try {
      await this.audio?.stop();
    } catch {
      /* ignore */
    }
    this.audio = new AudioMirror();
    this._teardownRenderer();
  }

  /** 一键 USB：选设备 → ADB 认证 → 投屏+控制+声音 */
  async start(preferSerial, opts, allowPicker = true) {
    if (this._starting) return;
    this._starting = true;
    try {
      this._opts = opts || {};
      this._preferSerial = preferSerial || "";
      // 关键：无线停止后这些标记还留着，会把无线看门狗/无线 server 分支带进 USB 会话，
      // 导致新 scrcpy 被看门狗误杀或走到错误的上传路径。
      this._wirelessTarget = "";
      this._wirelessLastRecv = null;
      this._wirelessServerUploaded = "";
      this._guardSession = "";
      await this.requestDevice(preferSerial, allowPicker, allowPicker ? 0 : 6000);
      await this.connectAndAuth();
      if (!this._wirelessTarget && typeof navigator !== "undefined" && navigator.usb) {
        this._detachUsbDisconnect();
        this._usbDisconnectHandler = (event) => {
          if (event.device !== this.device?.raw) return;
          this._diagUsbEvent = "WebUSB disconnect @" + new Date().toISOString();
          this.onLog("WebUSB 系统事件：设备连接已移除（" + (this.device?.serial || "未知序列号") + "）");
          void this.cleanupAfterDrop("Windows/WebUSB 报告设备连接已移除");
        };
        navigator.usb.addEventListener("disconnect", this._usbDisconnectHandler);
      }
      await this.startStream();
    } catch (err) {
      await this._cleanupFailedStart();
      throw err;
    } finally {
      this._starting = false;
    }
  }

  /** 有线直连：本机官方 ADB → 投屏，浏览器不先弹 WebUSB 选择器 */
  async startUsbDirect(preferSerial, opts) {
    if (this._starting) return;
    this._starting = true;
    try {
      this._opts = opts || {};
      const info = await connectUsbDirect(preferSerial, (s) => this.status(s));
      this.adb = info.adb;
      this.device = {
        serial: info.serial,
        name: info.name || info.serial,
        rawDevice: null,
      };
      this._usbDispose = info.dispose;
      this._wirelessTarget = "";
      this._guardSession = "";
      await prepareUsbServer(info.serial, (s) => this.status(s));
      this._usbServerUploaded = info.serial;
      await this.startStream();
    } finally {
      this._starting = false;
    }
  }

  /** 一键无线：IP:端口 → 本地 WS 桥 → ADB → 投屏 */
  async startWireless(target, opts) {
    if (this._starting) return;
    this._starting = true;
    const t0 = performance.now();
    try {
      this._opts = opts || {};
      this._wirelessTarget = target;
      this._wirelessServerUploaded = "";
      this._guardSession = "";
      this.status("无线上传中…");
      await this.pushServerWireless(target);
      const t1 = performance.now();
      this.status("无线连接中…");
      const { adb, dispose, lastRecv } = await connectWireless(target, (s) => this.status(s));
      const t2 = performance.now();
      this.adb = adb;
      this._wirelessDispose = dispose;
      this._wirelessLastRecv = lastRecv || null;
      this._wirelessTarget = target;
      this.device = {
        serial: target,
        name: `无线 ${target}`,
        rawDevice: null,
      };
      await this.startStream();
      const t3 = performance.now();
      const sec = (from, to) => ((to - from) / 1000).toFixed(1);
      this.onLog(
        `无线连接耗时 ${sec(t0, t3)}s（预上传 ${sec(t0, t1)}s / 握手 ${sec(t1, t2)}s / 启动 ${sec(t2, t3)}s）`
      );
    } finally {
      this._starting = false;
    }
  }

  setMuted(muted) {
    this.muted = !!muted;
    this.audio?.setMuted(this.muted);
    return this.muted;
  }

  toggleMute() {
    return this.setMuted(!this.muted);
  }
}

export { DeviceController };
