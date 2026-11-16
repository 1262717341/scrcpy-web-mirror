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

/** 手机端看门狗的脚本与日志位置 */
const AUDIO_GUARD_PATH = "/data/local/tmp/panda_guard.sh";
const AUDIO_GUARD_LOG = "/data/local/tmp/panda_guard.log";
const AUDIO_GUARD_HB = "/data/local/tmp/panda_hb";
const AUDIO_GUARD_RUN = "/data/local/tmp/panda_run";

/**
 * pkill 的模式用「方括号」写法：[c]om.foo 能匹配 com.foo，
 * 但不会匹配到「命令行里写着 [c]om.foo」的 pkill 自己及其父 shell，
 * 否则清理命令会把自己先杀掉。
 */
const KILL_SCRCPY = 'pkill -9 -f "[c]om.genymobile.scrcpy" 2>/dev/null; pkill -9 -f "[a]pp_process.*scrcpy" 2>/dev/null; true';

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
    NO_SERVER: "请用 http://127.0.0.1:8765/control.html 打开页面，不要用 file://；并确认 device-local/assets/scrcpy-server.jar 存在。",
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
  constructor(inner, maxFps) {
    this.inner = inner;
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
    // 1ms 容差：吸收定时器与浮点舍入抖动，稳态不误丢
    if (now < this._next - 1) {
      // 到得比渲染节奏还快 = 积压追赶，丢弃保持实时
      this.dropped += 1;
      return;
    }
    this._next = Math.max(this._next, now) + this.interval;
    this.rendered += 1;
    return this.inner.draw(frame);
  }
}

export class AdbMirror {
  constructor({ stage, status, onStatus, onError, onStats, onFirstFrame, onController, onLog }) {
    this.stage = stage;
    this.statusEl = status;
    this.onStatus = onStatus || (() => {});
    this.onError = onError || (() => {});
    this.onStats = onStats || (() => {});
    this.onFirstFrame = onFirstFrame || (() => {});
    this.onController = onController || (() => {});
    this.onLog = onLog || (() => {});
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
  }

  status(text) {
    if (this.statusEl) this.statusEl.textContent = text;
    this.onStatus(text);
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

  async requestDevice(preferSerial) {
    if (!isUsbSupported()) {
      throw new MirrorError("当前浏览器不支持 WebUSB", "NO_WEBUSB");
    }
    const manager = AdbDaemonWebUsbDeviceManager.BROWSER;
    if (!manager) {
      throw new MirrorError("WebUSB 设备管理器不可用", "NO_MANAGER");
    }

    // 1) 已授权设备直接用
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
      /* fall through */
    }

    // 2) 弹窗选择（默认 ADB 接口过滤）
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
              await this.requestDevice(this._preferSerial || this.device?.serial || "");
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
      try {
        transport = await AdbDaemonTransport.authenticate({
          serial: this.device.serial,
          connection,
          credentialStore: this.credentialStore,
        });
      } catch (err) {
        const msg = String(err?.message || err);
        const transient =
          /closed unexpectedly|readable ended|ExactReadable|NetworkError|disconnected|connection.*closed/i.test(
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
            await this.requestDevice(this._preferSerial || this.device?.serial || "");
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
   */
  async killScrcpyServerOnDevice(rounds = 3) {
    if (!this.adb) return false;
    let pids = await this.listScrcpyPids();
    if (!pids.length) return true;
    for (let i = 0; i < rounds; i += 1) {
      await this.deviceShell(KILL_SCRCPY, 6000);
      // 补刀：部分 ROM 上 pkill -f 匹配不全，直接按 pid 再杀一次
      if (pids.length) {
        await this.deviceShell("kill -9 " + pids.join(" ") + " 2>/dev/null; true", 5000);
      }
      await new Promise((resolve) => setTimeout(resolve, 350));
      pids = await this.listScrcpyPids();
      if (!pids.length) return true;
    }
    this.onLog("手机端 scrcpy 仍在运行（pid " + pids.join(",") + "），音频可能仍被占用");
    return false;
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
    await this.deviceShell(
      "v=$(media volume --stream 3 --get 2>/dev/null | tr -d ' ' | sed -n 's/.*:\\([0-9]*\\)\\/.*/\\1/p' | head -n 1); " +
      'case "$v" in ""|*[!0-9]*) v="";; esac; ' +
      'if [ -n "$v" ]; then ' +
      "media volume --stream 3 --set $((v+1)) >/dev/null 2>&1; " +
      'media volume --stream 3 --set $v >/dev/null 2>&1; fi; true',
      15000
    );
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
      'echo "[看门狗日志]"; tail -n 8 ' + AUDIO_GUARD_LOG + ' 2>/dev/null || echo "无"';
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

  /** 无线连接的端口（十六进制，/proc/net/tcp 里的写法） */
  _guardPortHex() {
    const m = String(this._wirelessTarget || "").match(/:(\d{2,5})$/);
    if (!m) return "";
    const port = parseInt(m[1], 10);
    if (!Number.isFinite(port) || port <= 0 || port > 65535) return "";
    return port.toString(16).toUpperCase().padStart(4, "0");
  }

  /**
   * 手机端看门狗：无线投屏期间由手机自己盯着与电脑的链路，
   * 一旦断开就把 scrcpy 结束掉，把音频还给扬声器。
   *
   * 为什么必须由手机自己动手：手机主动关 Wi-Fi 时电脑根本连不上手机，
   * 任何远程清理都会失败。而断网后手机的 adbd / scrcpy socket 仍会保持
   * ESTABLISHED（内核要重传十几分钟才放弃），scrcpy 写视频流时被内核阻塞，
   * 进程**不会自己退出**，音频采集一直被占着 —— 这就是断网后手机长期没声音的根因。
   *
   * 判据（任一命中即动手）：
   *  a) 手机 ping 自己的 Wi-Fi 网关连续 3 次失败（每 2 秒一次 ≈ 6 秒内命中）。
   *     主判据。Wi-Fi 一关，默认路由立刻消失，ping 立即失败，完全不用电脑配合，
   *     也比「电脑写心跳文件」快十几倍。
   *  b) 与电脑的连接（本地端口 5555）从 ESTABLISHED 变成消失，连续 2 次。
   *  c) 电脑心跳文件超过 90 秒没更新。兜底判据；阈值放宽是因为后台标签页的
   *     定时器会被浏览器节流到 1 分钟一次，阈值太小会把正常投屏误杀。
   */
  async deployAudioGuard() {
    const portHex = this._guardPortHex();
    if (!portHex || !this.adb) return false;
    await this.stopAudioGuard();

    const gw = await this.getWifiGateway();
    // 探测结果打出来：下次日志能直接看到 ip route / 接口地址的真实回显，
    // 网关取不到时不再靠猜
    const probe = String(
      (await this.deviceShell(
        "ip route 2>/dev/null | head -n 2; " +
        "ip -4 addr show wlan0 2>/dev/null | grep 'inet ' | head -n 1",
        8000
      )) || ""
    ).replace(/\s*\n\s*/g, " | ").trim();
    if (probe) this.onLog("手机网络探测：" + probe);
    const body = this._guardScript(portHex, gw);

    // 用 base64 落盘，不用 heredoc：heredoc 在 shell,v2 / pty 各家 ROM 上的
    // 换行处理不一致，一旦没写成功，后面启动的是个不存在的文件，
    // 页面只会看到「看门狗未能启动」却没有任何线索。
    const bytes = new TextEncoder().encode(body);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
    const b64 = btoa(bin);
    const write =
      "rm -f " + AUDIO_GUARD_LOG + " " + AUDIO_GUARD_HB + " " + AUDIO_GUARD_RUN + "; " +
      "echo '" + b64 + "' | base64 -d > " + AUDIO_GUARD_PATH + "; " +
      "chmod 755 " + AUDIO_GUARD_PATH + " 2>/dev/null; " +
      "ls -l " + AUDIO_GUARD_PATH + " 2>&1; " +
      "sh -n " + AUDIO_GUARD_PATH + " 2>&1 && echo SYNTAX_OK";
    const writeOut = String((await this.deviceShell(write, 12000)) || "").trim();
    if (!/SYNTAX_OK/.test(writeOut)) {
      this.onLog("看门狗脚本写入/校验失败：" + (writeOut || "无输出（base64 可能不可用）"));
      return false;
    }

    // 先喂一次心跳，避免看门狗刚起来时误判
    await this.heartbeat();

    // 后台启动并立即回显：nohup 忽略 SIGHUP，stdio 全重定向到 /dev/null，
    // 避免 adb 断连时写 EPIPE 把脚本带走。子 shell 包裹 + echo 让命令立刻返回。
    this.onLog("启用手机端看门狗：断网后由手机自己结束 scrcpy、恢复声音");
    const start =
      "( nohup sh " + AUDIO_GUARD_PATH + " </dev/null >/dev/null 2>&1 & ); " +
      "sleep 1.2; echo LAUNCHED; " +
      "cat " + AUDIO_GUARD_LOG + " 2>/dev/null";
    const startOut = String((await this.deviceShell(start, 10000)) || "").trim();

    let alive = await this.isAudioGuardAlive();
    if (!alive) {
      // nohup 没起来：先杀掉可能半死的实例（避免双份），再试 setsid（脱离会话，部分 ROM 更稳）
      await this.stopAudioGuard();
      await this.deviceShell(
        "( setsid sh " + AUDIO_GUARD_PATH + " </dev/null >/dev/null 2>&1 & ); sleep 1.2; true",
        8000
      );
      alive = await this.isAudioGuardAlive();
    }
    const tail = (await this.readAudioGuardLog(4)).replace(/\s*\n\s*/g, " | ");
    if (alive) {
      this.onLog(
        "看门狗已就绪" +
          (gw ? "（守 Wi-Fi 网关 " + gw + "，断网约 6 秒内出手）" : "（守 Wi-Fi 默认路由，断网约 6 秒内出手）") +
          (tail ? "；手机日志 " + tail : "")
      );
    } else {
      // 把启动时的原始回显带出来：是进程没起来、还是 ps 检测不到，一眼能分清
      this.onLog(
        "看门狗未能启动。诊断回显：" + (startOut.replace(/\s*\n\s*/g, " | ") || "无输出") +
          (tail ? "；手机日志 " + tail : "")
      );
    }
    return alive;
  }

  /** 手机 Wi-Fi 的默认网关，看门狗用它判断 Wi-Fi 是否还连着 */
  async getWifiGateway() {
    if (!this.adb) return "";
    // 首选 ip route 的默认路由行（实测 Android 17 小米：/proc/net/route 主表里
    // 没有 wlan 默认路由，默认路由在每网络独立表里，ip route 才能看到）。
    const route = String((await this.deviceShell("ip route 2>/dev/null", 5000)) || "");
    for (const line of route.split(/\n/)) {
      const m = /^default\s+via\s+(\d{1,3}(?:\.\d{1,3}){3})\s+dev\s+wlan/.exec(line.trim());
      if (m) return m[1];
    }
    // 兜底：内核路由表 /proc/net/route：wlan* 接口上有默认路由（Destination=00000000），
    // Gateway 字段是小端十六进制（192.168.31.1 -> 011FA8C0）。
    const raw = String((await this.deviceShell("cat /proc/net/route 2>/dev/null", 5000)) || "");
    for (const line of raw.split(/\n/).slice(1)) {
      const f = line.trim().split(/\s+/);
      if (f.length > 2 && f[1] === "00000000" && /^wlan/.test(f[0])) {
        const hex = String(f[2] || "").toUpperCase();
        if (/^[0-9A-F]{8}$/.test(hex)) {
          const bytes = hex.match(/../g).reverse().map((h) => parseInt(h, 16));
          if (bytes.every((b) => b >= 0 && b <= 255)) return bytes.join(".");
        }
        break;
      }
    }
    return "";
  }

  /** 看门狗脚本正文（单独抽出来，方便本地仿真验证） */
  _guardScript(portHex, gw) {
    const lines = [
      "#!/system/bin/sh",
      "PORT_HEX=" + portHex,
      "GW='" + (gw || "") + "'",
      "LOG=" + AUDIO_GUARD_LOG,
      "HB=" + AUDIO_GUARD_HB,
      'log() { echo "[$(date +%H:%M:%S)] $*" >> "$LOG"; }',
      'log "guard start port=$PORT_HEX gw=${GW:-none}"',
      "RUN=" + AUDIO_GUARD_RUN,
      // 无线接口名：默认 wlan0，用 ip link 探测实际名字（部分双频设备是别的）
      "IFACE=$(ip link 2>/dev/null | sed -n 's/^[0-9]*: \\(wlan[^:]*\\):.*/\\1/p' | head -n 1)",
      'if [ -z "$IFACE" ]; then IFACE=wlan0; fi',
      'log "iface=$IFACE"',
      // GW 兜底解析（一）：ip route 的默认路由行，不用 awk（部分 toybox 没有）
      "if [ -z \"$GW\" ]; then GW=$(ip route 2>/dev/null | sed -n 's/^default via \\([0-9]*\\.[0-9]*\\.[0-9]*\\.[0-9]*\\) dev wlan.*/\\1/p' | head -n 1); fi",
      // GW 兜底解析（二）：读 /proc/net/route，wlan* 上有默认路由 -> Gateway 字段是小端十六进制
      'if [ -z "$GW" ]; then',
      '  gwhex=""; while read -r rif rdest rgw _; do',
      '    [ "$rdest" = "00000000" ] || continue',
      '    case "$rif" in wlan*) gwhex="$rgw"; break ;; esac',
      "  done < /proc/net/route",
      '  if [ "${#gwhex}" -eq 8 ]; then GW="$((0x${gwhex:6:2})).$((0x${gwhex:4:2})).$((0x${gwhex:2:2})).$((0x${gwhex:0:2}))"; fi',
      "fi",
      'if [ -n "$GW" ]; then log "gateway=$GW"; fi',
      "n=0; seen=0; hbSeen=0; t=0; netfail=0; neton=0; rseen=0; pfc=0",
      "while true; do",
      "  now=$(date +%s)",
      '  echo "$now" > "$RUN"',
      "  hb=$(cat $HB 2>/dev/null)",
      '  case "$hb" in ""|*[!0-9]*) hb="";; esac',
      '  if [ -n "$hb" ]; then hbSeen=1; fi',
      '  c=$(cat /proc/net/tcp /proc/net/tcp6 2>/dev/null | grep -c -E ":$PORT_HEX [0-9A-F]+:[0-9A-F]+ 01 ")',
      '  if [ "${c:-0}" -gt 0 ]; then',
      '    if [ "$seen" -eq 0 ]; then log "link up"; fi',
      "    seen=1; n=0",
      "  else",
      '    if [ "$seen" -eq 1 ]; then n=$((n+1)); fi',
      "  fi",
      // 网络判据（主判据，三路探测任一为真即算在线）：
      // a) wlan 接口有 IPv4 地址 —— Wi-Fi 一关/一断 DHCP 地址立即回收，最快最可靠；
      // b) ip route 主表有 wlan 默认路由；
      // c) /proc/net/route 主表有 wlan 默认路由（老设备兜底）。
      // 只有见过在线（rseen=1）之后掉线才计数，避免探测全失效的手机被误杀。
      // 另有网关 ping（路由在但网关死，比如路由器断电）：从未 ping 通过的不计数（pfc），
      // 累计 5 次判定 ICMP 被屏蔽，退回只看在线判据+心跳。
      "  netup=0",
      "  ip -4 addr show \"$IFACE\" 2>/dev/null | grep -q 'inet ' && netup=1",
      '  [ "$netup" -eq 0 ] && ip route 2>/dev/null | grep -q \'^default.*dev wlan\' && netup=1',
      "  [ \"$netup\" -eq 0 ] && grep -q '^wlan[0-9]*[[:space:]]*00000000' /proc/net/route 2>/dev/null && netup=1",
      '  if [ "$netup" -eq 1 ]; then',
      '    rseen=1',
      '    if [ -n "$GW" ]; then',
      '      if ping -c 1 -W 1 "$GW" >/dev/null 2>&1; then netfail=0; neton=1',
      '      elif [ "$neton" -eq 1 ]; then netfail=$((netfail+1)); else pfc=$((pfc+1)); fi',
      "    else",
      '      netfail=0',
      "    fi",
      '  elif [ "$rseen" -eq 1 ]; then',
      '    netfail=$((netfail+1))',
      "  fi",
      '  if [ "$pfc" -ge 5 ] && [ "$neton" -eq 0 ]; then log "gw icmp blocked, fallback"; GW=""; pfc=0; netfail=0; fi',
      '  dead=0; reason=""',
      '  if [ "$netfail" -ge 3 ]; then dead=1; reason="net down (fail x$netfail)"; fi',
      '  if [ "$seen" -eq 1 ] && [ "$n" -ge 2 ]; then dead=1; reason="port gone"; fi',
      '  if [ -n "$hb" ] && [ $((now-hb)) -gt 45 ]; then dead=1; reason="heartbeat $((now-hb))s stale"; fi',
      '  if [ "$dead" -eq 1 ]; then',
      '    log "link dead ($reason) -> release scrcpy"',
      '    pkill -TERM -f "[c]om.genymobile.scrcpy" 2>/dev/null',
      "    sleep 2",
      '    pkill -9 -f "[c]om.genymobile.scrcpy" 2>/dev/null',
      '    pkill -9 -f "[a]pp_process.*scrcpy" 2>/dev/null',
      "    sleep 1",
      // 与网页端「强力恢复」一致的安全序列（不含会搞坏媒体时钟的 audioserver 重启）：
      // 关勿扰 -> 直接设媒体音量(AudioService 重算路由) -> 播放/暂停(音频焦点重申请)。
      // 注意：不按音量键 —— 音量键会弹音量条且可能改变用户音量（用户明确要求去掉）；
      // 音量归零的场景已由 media volume --set 10 覆盖。
      '    settings put global zen_mode 0 >/dev/null 2>&1',
      '    media volume --stream 3 --set 10 >/dev/null 2>&1',
      '    input keyevent 126 >/dev/null 2>&1',
      "    sleep 0.5",
      '    input keyevent 127 >/dev/null 2>&1',
      '    remain=$(ps -A 2>/dev/null | grep -c "[c]om.genymobile.scrcpy")',
      '    log "released, remain=$remain"',
      "    exit 0",
      "  fi",
      "  t=$((t+1))",
      '  if [ "$seen" -eq 0 ] && [ "$hbSeen" -eq 0 ] && [ "$t" -ge 300 ]; then log "no signal 10min, exit"; exit 0; fi',
      "  sleep 2",
      "done",
    ];
    return lines.join("\n");
  }

  async isAudioGuardAlive() {
    if (!this.adb) return false;
    // 不再用 ps -A | grep：Android 的 ps 默认只显示进程名不显示完整参数，
    // panda_guard.sh 永远匹配不到 -> 把活着误判成没启动（v3.0.12 的误报根因）。
    // 改用运行标记：看门狗每轮循环都会把当前时间写进 RUN 文件（tmpfs，无闪存损耗），
    // 12 秒内更新过 = 活着。
    const out = await this.deviceShell(
      "now=$(date +%s); r=$(cat " + AUDIO_GUARD_RUN + " 2>/dev/null); " +
      'r=$(echo "$r" | tr -dc "0-9"); ' +
      'if [ -n "$r" ] && [ $((now-r)) -lt 12 ]; then echo ALIVE; else echo DEAD; fi',
      5000
    );
    return /ALIVE/.test(String(out || "").trim());
  }

  /** 读回手机端看门狗日志（末尾若干行），用于确认它有没有真的跑起来 */
  async readAudioGuardLog(lines = 8) {
    if (!this.adb) return "";
    const out = await this.deviceShell(
      "tail -n " + lines + " " + AUDIO_GUARD_LOG + " 2>/dev/null",
      5000
    );
    return String(out || "").trim();
  }

  /** 给手机端看门狗喂心跳（写入手机本地时间戳） */
  async heartbeat() {
    if (!this.adb) return false;
    try {
      await this.deviceShell("echo $(date +%s) > " + AUDIO_GUARD_HB, 5000);
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

  /** 终止手机端 scrcpy 并刷新音频路由（它会占着音频采集，导致手机一直没声音） */
  async releaseScrcpyOnDevice() {
    if (!this.adb) return false;
    try {
      const ok = await Promise.race([
        this.killScrcpyServerOnDevice(),
        new Promise((resolve) => setTimeout(() => resolve(false), 12000)),
      ]);
      if (ok) await this.refreshAudioRoute();
      return ok === true;
    } catch {
      return false;
    }
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
      const ok = await this.killScrcpyServerOnDevice();
      // 顺便把看门狗也收掉，避免它以后又来杀进程
      await this.stopAudioGuard();
      if (ok) await this.refreshAudioRoute();
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
        const ok = await this.killScrcpyServerOnDevice();
        await this.stopAudioGuard();
        if (ok) await this.refreshAudioRoute();
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
    if (this._cleaned) return;
    this._cleaned = true;
    this.running = false;
    this.onLog("连接中断，开始释放手机端音频：" + reason);
    // 断开就该无画面：立即停解码器、移除画布，不留冻住的最后一帧
    this._teardownRenderer();
    try {
      await this.audio?.stop();
    } catch {
      /* ignore */
    }
    this.audio = new AudioMirror();
    // 链路还活着时直接清；已断则只能靠手机端看门狗/重连后清
    await this.releaseScrcpyOnDevice();
    if (this._wirelessTarget) {
      this.status("无线已断开，正在恢复手机声音…");
      const ok = await this.restoreWirelessAudio();
      if (ok) {
        this.onLog("手机声音已恢复");
      } else {
        this.onLog(
          "手机已离网，无法远程清理：手机端看门狗会在后台结束 scrcpy；重新联网后若仍无声，按一次音量键即可"
        );
        this._scheduleLateCleanup();
      }
    }
    try {
      await this.adb?.close();
    } catch {
      /* ignore */
    }
    this.adb = null;
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
    const url = new URL(SERVER_URL, location.href).href;
    let resp;
    try {
      resp = await fetch(url, { cache: "no-cache" });
    } catch (err) {
      const reason = String(err?.message || err);
      if (/Failed to fetch|NetworkError|ERR_CONNECTION/i.test(reason)) {
        throw new MirrorError(
          `无法下载 scrcpy-server.jar（Failed to fetch）\n请确认本地服务在运行：http://127.0.0.1:8765/control.html\n不要用 file:// 直接打开 HTML。\n目标：${url}`,
          "NO_SERVER",
          err
        );
      }
      throw new MirrorError("下载 scrcpy-server.jar 失败：" + reason, "NO_SERVER", err);
    }
    if (!resp.ok) {
      throw new MirrorError(
        `无法加载 scrcpy-server.jar（HTTP ${resp.status}）\n请检查 device-local/assets/scrcpy-server.jar 是否存在`,
        "NO_SERVER"
      );
    }
    const buf = await resp.arrayBuffer();
    if (!buf.byteLength) {
      throw new MirrorError("scrcpy-server.jar 内容为空", "NO_SERVER");
    }
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
    this.pacedRenderer = new PacedRenderer(renderer, (this._opts || {}).maxFps);
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
    this._cleaned = false;
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
    const sdk = await this.getAndroidSdk();
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

    // 清掉上一轮残留（手机端 scrcpy + 看门狗），再布防本轮的看门狗
    await this.stopAudioGuard();
    await this.killScrcpyServerOnDevice();
    if (this._wirelessTarget) await this.deployAudioGuard();
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
    options.serialize = () => serializeOptions()
      .filter((line) => !line.startsWith("send_codec_meta="))
      .concat("send_stream_meta=false");
    if (isCam) {
      try {
        options.value.cameraId = source === "camera_front" ? "1" : "0";
        options.value.cameraFacing = source === "camera_front" ? "front" : "back";
      } catch { /* ignore */ }
    }
    this.onLog("scrcpy options " + JSON.stringify({
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

    const logSink = (msg) => this.onLog(String(msg));
    this.client.output
      .pipeTo(
        new WritableStream({
          write(chunk) {
            console.debug("[scrcpy]", chunk);
            logSink(chunk);
          },
        })
      )
      .catch(() => {});

    const videoStream = await this.client.videoStream;
    if (!videoStream) throw new MirrorError("scrcpy 未返回视频流", "NO_VIDEO");

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
        const audioMeta = await this.client.audioStream;
        const audioResult = await this.audio.start(audioMeta);
        if (audioResult?.ok) {
          this.onStats({ ...this._stats(), audio: audioResult.mode });
          // 延迟回报一帧统计，便于排查无声
          setTimeout(() => {
            const st = this.audio?.stats;
            this.onStats({
              ...this._stats(),
              audio: `${audioResult.mode} pkt=${st?.packets || 0} drop=${st?.dropped || 0}${st?.err && st.err !== "—" ? " " + st.err : ""}`,
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
              packet.keyframe = true;
              logPacketConfig("已按 IDR NAL 修正关键帧标记");
            }
            controller.enqueue(packet);
          },
        })
      )
      .pipeThrough(
        new InspectStream((packet) => {
          try {
            if (packet?.type === "configuration") {
              const { croppedWidth, croppedHeight } = h264ParseConfiguration(packet.data);
              if (croppedWidth > 0 && croppedHeight > 0) {
                this._size = { width: croppedWidth, height: croppedHeight };
                this.onStats(this._stats());
              }
            } else if (packet?.type === "data") {
              this.frames += 1;
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
          console.error("video pipe", err);
          this.onError(err);
          this.cleanupAfterDrop("视频流中断").catch(() => {});
        }
      });

    this.running = true;
    this.startTs = performance.now();
    this.status("投屏中");
    this.onStats(this._stats());
    this.client.exited.then(() => {
      this.onLog("scrcpy exited stopReq=" + this._stopRequested);
      if (!this._stopRequested) {
        this.running = false;
        this.status("投屏已结束");
        this.cleanupAfterDrop("scrcpy 进程退出").catch(() => {});
      }
    }).catch((e) => {
      this.onLog("scrcpy exited err " + (e && e.message ? e.message : e));
    });
  }

  _stats() {
    const elapsed = (performance.now() - this.startTs) / 1000;
    const fps = elapsed > 0 && this.frames ? (this.frames / elapsed).toFixed(1) : "0";
    return {
      frames: this.frames,
      fps,
      vdrop: this.pacedRenderer ? this.pacedRenderer.dropped : 0,
      width: this._size.width,
      height: this._size.height,
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
    this._cleaned = true;
    this.running = false;
    if (this._lateTimer) {
      clearTimeout(this._lateTimer);
      this._lateTimer = null;
    }
    this._lateActive = false;
    try {
      await this.deviceController?.dispose();
    } catch {
      /* ignore */
    }
    this.deviceController = null;
    try { await this.audio?.stop(); } catch { /* ignore */ }
    this.audio = new AudioMirror();
    try { await this._wirelessDispose?.(); } catch { /* ignore */ }
    this._wirelessDispose = null;
    try {
      await this.client?.close();
    } catch {
      /* ignore */
    }
    this.client = null;
    // 主动停止同样清空舞台画面（与断线路径一致：断开即无画面）
    this._teardownRenderer();
    try {
      await this.stopAudioGuard();
      const ok = await this.killScrcpyServerOnDevice();
      if (ok) await this.refreshAudioRoute();
      // 给手机一点时间释放音频采集，再断开 ADB，避免残留静音
      await new Promise((resolve) => setTimeout(resolve, 300));
      await this.adb?.close();
    } catch {
      /* ignore */
    }
    this.adb = null;
    // 主动停止后一定要把 WebUSB 句柄也还回去，否则下一次点连接会撞自己造成的 DeviceBusy
    try {
      if (this.device?.raw?.opened) await this.device.raw.close();
    } catch {
      /* ignore */
    }
    this.device = null;
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
    try {
      await this.adb?.close();
    } catch {
      /* ignore */
    }
    this.adb = null;
    try {
      if (this.device?.raw?.opened) await this.device.raw.close();
    } catch {
      /* ignore */
    }
    this.device = null;
    try {
      await this.audio?.stop();
    } catch {
      /* ignore */
    }
    this.audio = new AudioMirror();
    this._teardownRenderer();
  }

  /** 一键 USB：选设备 → ADB 认证 → 投屏+控制+声音 */
  async start(preferSerial, opts) {
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
      await this.requestDevice(preferSerial);
      await this.connectAndAuth();
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
    try {
      this._opts = opts || {};
      this._wirelessTarget = target;
      this._wirelessServerUploaded = "";
      this.status("无线上传中…");
      await this.pushServerWireless(target);
      this.status("无线连接中…");
      const { adb, dispose, lastRecv } = await connectWireless(target, (s) => this.status(s));
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
