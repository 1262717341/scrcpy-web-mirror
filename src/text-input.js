/**
 * 中文文本注入：ADBKeyboard 输入法插件
 *
 * 背景：安卓的 `input text` 只能送 ASCII；scrcpy 的 SET_CLIPBOARD(paste=true)
 * 在 Android 13+ / HyperOS 上经常被系统拦掉。ADBKeyboard（GPL-2.0，senzhk）
 * 是一个不显示界面的输入法，收到 `ADB_INPUT_B64` 广播后用 InputConnection
 * 直接把整段文字 commit 到当前输入框，汉字/emoji 都能过，不依赖剪贴板。
 */
import { AdbShell, DeviceApps, shellQuote } from "./device-tools.js";

export const ADB_IME_PACKAGE = "com.android.adbkeyboard";
export const ADB_IME_ID = "com.android.adbkeyboard/.AdbIME";
export const ADB_IME_LABEL = "ADB 输入法";
export const ADB_APK_URL = "./assets/adbkeyboard/ADBKeyboard.apk";

/** 是否含非 ASCII（中文、emoji 等） */
export function hasNonAscii(text) {
  return /[^\x00-\x7f]/.test(String(text ?? ""));
}

/** UTF-8 → base64（浏览器/Node 通用） */
export function utf8ToBase64(text) {
  const bytes = new TextEncoder().encode(String(text ?? ""));
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** `ime list -s` 输出里是否包含指定输入法 */
export function imeListHas(output, id = ADB_IME_ID) {
  return String(output || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .some((line) => line === id);
}

/** `pm list packages` 输出里是否包含指定包 */
export function packageListHas(output, pkg = ADB_IME_PACKAGE) {
  return String(output || "")
    .split(/\r?\n/)
    .some((line) => line.trim() === "package:" + pkg);
}

/** `settings get secure default_input_method` 的输出清洗 */
export function parseCurrentIme(output) {
  const v = String(output || "").trim();
  if (!v || v === "null") return "";
  return v;
}

const PREV_IME_KEY = "scrcpy-prev-ime";

function _prevKey(serial) {
  return serial ? PREV_IME_KEY + ":" + serial : PREV_IME_KEY;
}

/** 持久化投屏前的原输入法：页面刷新 / 上次未正常恢复时仍能找回来 */
function storePrevIme(serial, ime) {
  try {
    if (ime) localStorage.setItem(_prevKey(serial), ime);
    else localStorage.removeItem(_prevKey(serial));
  } catch {
    /* 隐私模式忽略 */
  }
}

function readPrevIme(serial) {
  try {
    if (serial) {
      const v = localStorage.getItem(_prevKey(serial));
      if (v) return v;
    }
    return localStorage.getItem(PREV_IME_KEY) || "";
  } catch {
    return "";
  }
}

export class DeviceTextInput {
  constructor(adb, serial = "") {
    this.adb = adb || null;
    this.serial = String(serial || "");
    this.shell = new AdbShell(adb);
    this.previousIme = "";
    this.active = false;
  }

  get ready() {
    return this.shell.ready;
  }

  async status() {
    if (!this.ready) throw new Error("ADB 未连接");
    const installedOut = await this.shell.run(["pm", "list", "packages", ADB_IME_PACKAGE], 15000);
    const listedOut = await this.shell.run(["ime", "list", "-s"], 15000);
    const currentOut = await this.shell.run(["settings", "get", "secure", "default_input_method"], 10000);
    const installed = packageListHas(installedOut, ADB_IME_PACKAGE);
    const enabled = imeListHas(listedOut, ADB_IME_ID);
    const current = parseCurrentIme(currentOut);
    return { installed, enabled, current, active: this.active && current === ADB_IME_ID };
  }

  async installFromBundle(blob, onProgress) {
    if (!this.ready) throw new Error("ADB 未连接");
    const apps = new DeviceApps(this.adb);
    return await apps.install(blob, onProgress);
  }

  async fetchBundle() {
    const res = await fetch(ADB_APK_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("读取输入法插件失败：" + res.status);
    return await res.blob();
  }

  async enable() {
    const out = await this.shell.run(["ime", "enable", ADB_IME_ID], 15000);
    if (/Error|Unknown/i.test(out)) throw new Error(out.trim());
    return out.trim();
  }

  /** 切到 ADB 输入法（记住原来的，便于恢复） */
  async activate() {
    if (!this.ready) throw new Error("ADB 未连接");
    const current = parseCurrentIme(
      await this.shell.run(["settings", "get", "secure", "default_input_method"], 10000)
    );
    if (current === ADB_IME_ID) {
      this.active = true;
      if (!this.previousIme) this.previousIme = readPrevIme(this.serial);
      return;
    }
    if (current) {
      this.previousIme = current;
      storePrevIme(this.serial, current);
    } else if (!this.previousIme) {
      this.previousIme = readPrevIme(this.serial);
    }
    const out = await this.shell.run(["ime", "set", ADB_IME_ID], 15000);
    if (/Error|Unknown|not.*found/i.test(out)) throw new Error(out.trim());
    this.active = true;
  }

  /** 从已启用输入法列表里挑第一个非 ADB 输入法作为兜底恢复目标 */
  async pickFallbackIme() {
    const listed = await this.shell.run(["ime", "list", "-s"], 15000);
    const ids = String(listed || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    return ids.find((id) => id !== ADB_IME_ID) || "";
  }

  /** 恢复手机原来的输入法 */
  async restore() {
    if (!this.ready) {
      this.active = false;
      return "";
    }
    // 已经是非 ADB 输入法：无需切换，只清掉记忆
    const current = parseCurrentIme(
      await this.shell.run(["settings", "get", "secure", "default_input_method"], 10000)
    );
    if (current && current !== ADB_IME_ID) {
      this.active = false;
      this.previousIme = "";
      storePrevIme(this.serial, "");
      return "";
    }
    let prev = this.previousIme || readPrevIme(this.serial);
    this.active = false;
    if (!prev || prev === ADB_IME_ID) {
      prev = await this.pickFallbackIme();
    }
    if (!prev) {
      this.previousIme = "";
      storePrevIme(this.serial, "");
      return "";
    }
    // 目标输入法可能处于停用状态，先启用再切换，否则 `ime set` 会失败
    try {
      await this.shell.run(["ime", "enable", prev], 15000);
    } catch {
      /* 已启用时 enable 可能报错，忽略后继续 set */
    }
    const out = await this.shell.run(["ime", "set", prev], 15000);
    if (/Error|Unknown|not.*found/i.test(out)) throw new Error(out.trim());
    this.previousIme = "";
    storePrevIme(this.serial, "");
    return out.trim();
  }

  /** 发送整段文字（需先 activate） */
  async send(text) {
    const body = String(text ?? "");
    if (!body) return;
    if (!this.ready) throw new Error("ADB 未连接");
    if (!this.active) await this.activate();
    const b64 = utf8ToBase64(body);
    const out = await this.shell.run(
      ["am", "broadcast", "-a", "ADB_INPUT_B64", "--es", "msg", b64],
      15000
    );
    if (/Error/i.test(out)) throw new Error(out.trim());
    return out.trim();
  }

  /** 清空当前输入框内容（可选，用于「替换」场景） */
  async clearViaKeyevents(count) {
    const n = Math.max(0, Math.min(200, Number(count) || 0));
    if (!n) return;
    const seq = [];
    for (let i = 0; i < n; i += 1) seq.push("input keyevent 67");
    await this.shell.sh(seq.join("; "), 30000);
  }
}
