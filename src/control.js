/**
 * 手机控制 — 对齐 scrcpy control 协议
 * 触控、滚轮、键盘、系统键、通知栏、剪贴板、旋转、电源
 */
import {
  AndroidKeyCode,
  AndroidKeyEventAction,
  AndroidMotionEventAction,
  AndroidMotionEventButton,
  AndroidScreenPowerMode,
  ScrcpyPointerId as PointerId,
} from "@yume-chan/scrcpy";

const FINGER = PointerId.Finger; // -2n
const MAX_TOUCH = 10;

export class DeviceController {
  /**
   * @param {import("@yume-chan/adb-scrcpy").AdbScrcpyClient} client
   * @param {{ width: () => number, height: () => number }} sizeSource
   */
  constructor(client, sizeSource, adb, hooks = {}) {
    this.client = client;
    this.adb = adb;
    this.sizeSource = sizeSource;
    /** Map<pointerId, { x, y, downAt }> */
    this.active = new Map();
    this._textBuf = "";
    this._textTimer = null;
    this._clipWaiters = [];
    this._clipDrained = false;
    /** 写入异常回调：(err, where) => void，供页面打日志/提示 */
    this.onError = typeof hooks.onError === "function" ? hooks.onError : () => {};
  }

  _report(err, where) {
    try {
      this.onError(err, where);
    } catch {
      /* 回调自身异常不阻断控制流程 */
    }
  }

  /** 控制通道是否还可用（client/controller 已被清理时为 false） */
  get alive() {
    return !!this.controller;
  }

  /**
   * 写入控制指令并加超时竞速：
   * 无线拥塞 / 连接半开时 writer.write 可能永久 pending，
   * 不超时会把后续所有触控排在同一个挂起 Promise 后面，表现为「点不动」。
   */
  async _write(fn, where) {
    const c = this.controller;
    if (!c) throw new Error("控制通道未连接");
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("控制指令发送超时")), 2000);
    });
    try {
      await Promise.race([fn(c), timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  /** 持续排空设备→电脑剪贴板流,记录最新值并唤醒等待者 */
  _ensureClipboardDrain() {
    if (this._clipDrained) return;
    const clip = this.client?.clipboard;
    if (!clip) return;
    this._clipDrained = true;
    (async () => {
      const reader = clip.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (typeof value !== "string") continue;
        const waiters = this._clipWaiters.splice(0);
        for (const w of waiters) w(value);
      }
    })().catch(() => {});
  }

  /** 主动读取手机剪贴板(GET_CLIPBOARD),返回文本;超时返回 null */
  async getDeviceClipboard(timeoutMs = 1500) {
    const c = this.client?.controller;
    if (!c) throw new Error("ADB 未连接");
    this._ensureClipboardDrain();
    if (!this.client?.clipboard) throw new Error("剪贴板流不可用");
    const wait = new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), timeoutMs);
      this._clipWaiters.push((v) => {
        clearTimeout(timer);
        resolve(v);
      });
    });
    // ScrcpyControlMessageType.GetClipboard = 8(3.x 协议,仅 1 字节)
    await c.write(new Uint8Array([8]));
    return await wait;
  }

  get controller() {
    return this.client?.controller ?? null;
  }

  _dims() {
    const w = this.sizeSource?.width?.() || 0;
    const h = this.sizeSource?.height?.() || 0;
    return { w, h };
  }

  /** 画布坐标 → 设备像素坐标 */
  toDevice(clientX, clientY, el) {
    const { w, h } = this._dims();
    if (!w || !h) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 0, y: 0 };

    // 处理 object-fit: contain 的黑边（全屏时常把 canvas 拉满再 contain）
    const videoRatio = w / h;
    const boxRatio = rect.width / rect.height;
    let drawW = rect.width;
    let drawH = rect.height;
    let drawLeft = rect.left;
    let drawTop = rect.top;
    if (boxRatio > videoRatio) {
      // 两侧黑边
      drawW = rect.height * videoRatio;
      drawLeft = rect.left + (rect.width - drawW) / 2;
    } else if (boxRatio < videoRatio) {
      // 上下黑边
      drawH = rect.width / videoRatio;
      drawTop = rect.top + (rect.height - drawH) / 2;
    }

    let nx = (clientX - drawLeft) / drawW;
    let ny = (clientY - drawTop) / drawH;
    nx = Math.min(1, Math.max(0, nx));
    ny = Math.min(1, Math.max(0, ny));
    // 画面旋转时映射回设备坐标
    const rot = Number(el.dataset.rotate || 0);
    if (rot === 90) {
      const t0 = nx;
      nx = 1 - ny;
      ny = t0;
    } else if (rot === 180) {
      nx = 1 - nx;
      ny = 1 - ny;
    } else if (rot === 270) {
      const t0 = nx;
      nx = ny;
      ny = 1 - t0;
    }
    return { x: nx * w, y: ny * h };
  }

  async touch(action, pointerId, x, y, pressure = 1, buttons = AndroidMotionEventButton.Primary) {
    const { w, h } = this._dims();
    await this._write(
      (c) =>
        c.injectTouch({
          action,
          pointerId: BigInt(pointerId) & 0xffffffffffffffffn,
          pointerX: x,
          pointerY: y,
          videoWidth: w,
          videoHeight: h,
          pressure,
          buttons,
        }),
      "touch"
    );
  }

  async pointerDown(pointerId, x, y) {
    // 上一次按压没收到 up（窗口失焦 / 指针移出 / 写入异常残留）：
    // 先补发 Cancel 清掉设备端旧态，再重新 Down，否则会被降级成 Move，点不出点击。
    const stale = this.active.get(pointerId);
    if (stale) {
      this.active.delete(pointerId);
      try {
        await this.touch(AndroidMotionEventAction.Cancel, pointerId, stale.x, stale.y, 0);
      } catch (e) {
        this._report(e, "pointerDown-cancel-stale");
      }
    }
    if (this.active.size >= MAX_TOUCH) return;
    this.active.set(pointerId, { x, y, downAt: Date.now() });
    try {
      await this.touch(AndroidMotionEventAction.Down, pointerId, x, y);
    } catch (e) {
      // 写入失败必须清掉本地按压态，否则该指针会一直卡在「已按下」
      this.active.delete(pointerId);
      this._report(e, "pointerDown");
    }
  }

  async pointerMove(pointerId, x, y) {
    const last = this.active.get(pointerId);
    if (!last) return;
    this.active.set(pointerId, { x, y, downAt: last.downAt });
    try {
      await this.touch(AndroidMotionEventAction.Move, pointerId, x, y);
    } catch (e) {
      this._report(e, "pointerMove");
    }
  }

  async pointerUp(pointerId) {
    const last = this.active.get(pointerId);
    if (!last) return;
    this.active.delete(pointerId);
    try {
      await this.touch(AndroidMotionEventAction.Up, pointerId, last.x, last.y, 0);
    } catch (e) {
      this._report(e, "pointerUp");
    }
  }

  async pointerCancel(pointerId) {
    const last = this.active.get(pointerId);
    if (!last) return;
    this.active.delete(pointerId);
    try {
      await this.touch(AndroidMotionEventAction.Cancel, pointerId, last.x, last.y, 0);
    } catch (e) {
      this._report(e, "pointerCancel");
    }
  }

  /** 释放所有残留按压（窗口失焦 / 断线 / 重新绑定前调用） */
  async releaseAllPointers() {
    for (const id of [...this.active.keys()]) {
      await this.pointerCancel(id).catch(() => {});
    }
    this.active.clear();
  }

  async scroll(x, y, dx, dy) {
    const { w, h } = this._dims();
    try {
      await this._write((c) =>
        c.injectScroll({
          pointerX: x,
          pointerY: y,
          videoWidth: w,
          videoHeight: h,
          scrollX: dx,
          scrollY: dy,
          buttons: 0,
        })
      );
    } catch (e) {
      this._report(e, "scroll");
    }
  }

  async key(action, keyCode, metaState = 0) {
    try {
      await this._write((c) =>
        c.injectKeyCode({ action, keyCode, metaState, repeat: 0 })
      );
    } catch (e) {
      this._report(e, "key");
    }
  }

  async tapKey(keyCode, metaState = 0) {
    await this.key(AndroidKeyEventAction.Down, keyCode, metaState);
    await this.key(AndroidKeyEventAction.Up, keyCode, metaState);
  }

  /** DOM KeyboardEvent.code → AndroidKeyCode */
  /**
   * Keyboard / CJK input:
   * - printable (incl. Chinese) -> injectText
   * - function keys -> injectKeyCode
   */
  async keyFromEvent(e, isDown) {
    const key = e.key || "";
    const code = e.code || "";

    if (e.isComposing || key === "Process" || key === "Unidentified") {
      return;
    }

    const isPrintable =
      key.length === 1 ||
      (key.length > 1 &&
        !/^(Enter|Backspace|Tab|Escape|Delete|Arrow\w+|Home|End|Page\w+|F\d+|Control|Shift|Alt|Meta|CapsLock|ContextMenu|Dead)$/.test(key));

    if (isPrintable) {
      if (isDown) await this.injectText(key);
      return;
    }

    let keyCode = AndroidKeyCode[code];
    if (keyCode == null) {
      const map = {
        Enter: AndroidKeyCode.Enter,
        Backspace: AndroidKeyCode.Backspace,
        Tab: AndroidKeyCode.Tab,
        Space: AndroidKeyCode.Space,
        Escape: AndroidKeyCode.Escape,
        Delete: AndroidKeyCode.Delete,
      };
      keyCode = map[code] ?? map[key];
    }
    if (keyCode == null) return;

    let meta = 0;
    if (e.altKey) meta |= 2 | 16;
    if (e.shiftKey) meta |= 1 | 64;
    if (e.ctrlKey) meta |= 4096 | 8192;
    if (e.metaKey) meta |= 65536 | 131072;

    await this.key(
      isDown ? AndroidKeyEventAction.Down : AndroidKeyEventAction.Up,
      keyCode,
      meta
    );
  }

  async injectComposition(text) {
    if (!text) return;
    await this.injectText(text);
  }

  async injectText(text) {
    const c = this.controller;
    const s = text == null ? "" : String(text);
    if (!c || !s) return;
    try {
      await c.injectText(s);
    } catch (e) {
      await this.setClipboardAndPaste(s);
    }
  }

  /** 缓冲短按键，批量注入文本（中文/粘贴） */
  queueText(chunk) {
    this._textBuf += chunk;
    if (this._textTimer) clearTimeout(this._textTimer);
    this._textTimer = setTimeout(async () => {
      const t = this._textBuf;
      this._textBuf = "";
      if (t) await this.injectText(t).catch(() => {});
    }, 30);
  }

  async back() {
    await this.tapKey(AndroidKeyCode.AndroidBack);
  }
  async home() {
    await this.tapKey(AndroidKeyCode.AndroidHome);
  }
  async recents() {
    await this.tapKey(AndroidKeyCode.AndroidAppSwitch);
  }
  async power() {
    await this.tapKey(AndroidKeyCode.Power);
  }
  async volumeUp() {
    await this.tapKey(AndroidKeyCode.VolumeUp);
  }
  async volumeDown() {
    await this.tapKey(AndroidKeyCode.VolumeDown);
  }
  async menu() {
    await this.tapKey(AndroidKeyCode.ContextMenu);
  }
  async search() {
    await this.tapKey(AndroidKeyCode.AndroidSearch);
  }

  async expandNotifications() {
    await this.controller?.expandNotificationPanel();
  }
  async expandSettings() {
    await this.controller?.expandSettingPanel();
  }
  async collapseNotifications() {
    await this.controller?.collapseNotificationPanel();
  }
  async rotate() {
    await this.controller?.rotateDevice();
  }

  async screenOn() {
    await this.controller?.setScreenPowerMode(AndroidScreenPowerMode.Normal);
  }
  async screenOff() {
    await this.controller?.setScreenPowerMode(AndroidScreenPowerMode.Off);
  }

  async setClipboard(text) {
    const c = this.controller;
    const content = text == null ? "" : String(text);
    if (!c) return;
    // scrcpy 字段名是 content，不是 text
    await c.setClipboard({ content, sequence: 0n, paste: false });
  }

  async setClipboardAndPaste(text) {
    const c = this.controller;
    const content = text == null ? "" : String(text);
    if (!c) return;
    await c.setClipboard({ content, sequence: 0n, paste: true });
  }


  async backspace() {
    await this.tapKey(AndroidKeyCode.Backspace);
  }
  async deleteKey() {
    await this.tapKey(AndroidKeyCode.Delete);
  }
  async enter() {
    await this.tapKey(AndroidKeyCode.Enter);
  }
  async tab() {
    await this.tapKey(AndroidKeyCode.Tab);
  }
  async escape() {
    await this.tapKey(AndroidKeyCode.Escape);
  }
  async pageUp() {
    await this.tapKey(AndroidKeyCode.PageUp);
  }
  async pageDown() {
    await this.tapKey(AndroidKeyCode.PageDown);
  }
  /** 关屏（继续镜像） */
  async screenOffKeepMirror() {
    await this.screenOff();
  }
  /** 亮屏 */
  async wakeUp() {
    await this.screenOn();
  }
  /** 手机快捷键截屏 → 拉到电脑「图片」目录 */
  /** 手机截屏 → 保存到电脑「图片」 */
  /** 手机快捷键截屏 → 拉取同一张图到电脑「图片」 */
  /** 手机快捷键截屏 → 拉取同一张到电脑「图片」 */
  /** 截取当前画面并保存到电脑「图片」 */
  /** 手机相册截屏 + 保存到电脑「图片」，返回路径/缩略图 */
  async phoneScreenshot() {
    const adb = this.adb;
    if (!adb?.subprocess?.noneProtocol) {
      throw new Error("ADB 未连接");
    }
    const run = (argv) =>
      adb.subprocess.noneProtocol.spawnWaitText(argv).then((s) => (s || "").trim());

    // A) 手机系统截屏（尽量进相册）
    try {
      await run(["input", "keyevent", "120"]);
    } catch {
      /* ignore */
    }
    try {
      await run(["input", "keyevent", "KEYCODE_SYSRQ"]);
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 700));

    // B) screencap 当前画面（保证能取到图）
    const fixed = "/sdcard/scrcpy-web-shot.png";
    try {
      await run(["screencap", "-p", fixed]);
    } catch {
      /* ignore */
    }
    // 让系统相册扫描这张图
    try {
      await run([
        "am",
        "broadcast",
        "-a",
        "android.intent.action.MEDIA_SCANNER_SCAN_FILE",
        "-d",
        "file://" + fixed,
      ]);
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 200));

    // C) 优先系统新截图，否则 screencap
    let remote = "";
    const dirs = [
      "/sdcard/Pictures/Screenshots",
      "/sdcard/DCIM/Screenshots",
      "/sdcard/Pictures",
    ];
    for (const dir of dirs) {
      try {
        const name = await run([
          "sh",
          "-c",
          "ls -1t " + dir + " 2>/dev/null | grep -E '\\.(png|jpg)$' | head -1",
        ]);
        const n = (name || "").split("\n").map((s) => s.trim()).filter(Boolean).pop();
        const full = n ? dir + "/" + n : "";
        if (full.startsWith("/sdcard/") && /\.(png|jpg|jpeg)$/i.test(full)) {
          remote = full;
          break;
        }
      } catch {
        /* next */
      }
    }
    if (!remote) remote = fixed;

    // D) 拉到电脑
    const sync = await adb.sync();
    let bytes;
    try {
      const stream = sync.read(remote);
      const chunks = [];
      const reader = stream.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      let total = 0;
      for (const c of chunks) total += c.length;
      bytes = new Uint8Array(total);
      let o = 0;
      for (const c of chunks) {
        bytes.set(c, o);
        o += c.length;
      }
    } finally {
      try {
        await sync.dispose();
      } catch {
        /* ignore */
      }
    }

    if (!bytes || bytes.length < 200) {
      throw new Error("截图数据为空");
    }

    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    const resp = await fetch("/api/save-shot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "scrcpy-shot-" + Date.now() + ".png",
        data: btoa(bin),
        remote,
      }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok) {
      throw new Error(data.error || "保存到电脑失败");
    }
    return {
      path: data.path,
      name: data.name,
      thumb: data.thumb || "",
      remote,
    };
  }

  async dispose() {
    await this.releaseAllPointers();
    if (this._textTimer) clearTimeout(this._textTimer);
  }
}

/** 浏览器键 → 展示用标签 */
export function keyLabel(e) {
  return e.key;
}