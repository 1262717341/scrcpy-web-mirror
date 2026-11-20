/**
 * scrcpy 便捷网页版 v3 — 页面层
 * 连接向导 · 设置持久化 · 无线保活 · 舞台快捷条 · 全屏悬浮面板
 */
import {
  AdbMirror,
  isUsbSupported,
  MirrorError,
} from "../src/mirror.js";
import {
  enableWirelessViaUsb,
  scanWireless,
  wirelessHelp,
  WirelessError,
} from "../src/wireless.js";
import { bindDevicePanels } from "./device-panel.js";
import { ADB_IME_ID, DeviceTextInput, hasNonAscii } from "./text-input.js";

const SETTINGS_KEY = "pandatest-mirror-settings-v1";
const IME_AUTO_KEY = "pandatest-ime-auto-v1";

function $(id) {
  return document.getElementById(id);
}
function on(id, ev, fn) {
  const el = $(id);
  if (el) el.addEventListener(ev, fn);
  return el;
}
function all(sel) {
  return Array.from(document.querySelectorAll(sel));
}

// —— 按键图标 ——
const ICONS = {
  back: '<path d="M15 18l-6-6 6-6"/>',
  home: '<path d="M3 10.5L12 3l9 7.5"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  recents: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8"/>',
  power: '<path d="M12 3v10"/><path d="M7.5 6.5a8 8 0 1 0 9 0"/>',
  "vol-up": '<path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M18.5 6.5a8 8 0 0 1 0 11"/>',
  "vol-down": '<path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
  "screen-on": '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/>',
  "screen-off": '<path d="M3 3l18 18"/><circle cx="12" cy="12" r="4"/>',
  rotate: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  notify: '<path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  "notify-collapse": '<path d="M6 14s3-1 3-7a6 6 0 0 1 12 0"/><path d="M3 21h18"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/><circle cx="12" cy="12" r="8"/>',
  "phone-shot": '<rect x="3" y="6" width="18" height="13" rx="2"/><circle cx="12" cy="12.5" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/>',
  "pc-shot": '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/><path d="M9 11l2 2 4-4"/>',
  "rot-l": '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12H8"/>',
  "rot-0": '<rect x="7" y="3" width="10" height="18" rx="2"/>',
  "rot-r": '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h6"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  "fs-full": '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
};

function iconSvg(act) {
  const d = ICONS[act];
  if (!d) return "";
  return (
    '<svg class="ui-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    d +
    "</svg>"
  );
}

function decorateIcons() {
  document.querySelectorAll("[data-act]").forEach((el) => {
    const act = el.getAttribute("data-act");
    if (!act || el.dataset.iconed === "1") return;
    const svg = iconSvg(act);
    if (svg) {
      el.classList.add("has-icon");
      const lbl = el.querySelector(".lbl3");
      const text = lbl ? lbl.outerHTML : "<span>" + el.textContent.trim() + "</span>";
      el.innerHTML = svg + text;
    }
    el.dataset.iconed = "1";
  });
}

function toast(title, description = "", opts = {}) {
  const root = $("toast-root");
  if (!root) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML =
    '<div class="toast-body"><p class="toast-title"></p>' +
    (description ? '<p class="toast-desc"></p>' : "") +
    (opts.html || "") +
    "</div>";
  el.querySelector(".toast-title").textContent = title;
  if (description) el.querySelector(".toast-desc").textContent = description;
  root.appendChild(el);
  const ttl = opts.duration || 8000;
  if (ttl > 0) setTimeout(() => el.remove(), ttl);
}

function shotToast(result) {
  const path = result?.path || "";
  const thumb = result?.thumb || "";
  const name = result?.name || path.split(/[\\/]/).pop() || "";
  const html =
    (thumb ? '<img class="shot-thumb" alt="thumb" src="' + thumb + '" />' : "") +
    '<div class="shot-actions"><button type="button" class="btn primary xs-btn" data-open-shot="' +
    String(path).replace(/"/g, "") +
    '">打开文件</button></div>';
  toast("截屏已保存", name, { html, duration: 12000 });
  setTimeout(() => {
    document.querySelectorAll("[data-open-shot]").forEach((b) => {
      b.addEventListener("click", async () => {
        const p = b.getAttribute("data-open-shot");
        try {
          await fetch("/api/open-shot", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: p }),
          });
          toast("已打开文件位置", p);
        } catch (e) {
          toast("打开失败", String(e?.message || e));
        }
      });
    });
  }, 0);
  logLine("ok", "截屏 " + path);
}

function logLine(level, msg) {
  const box = $("log-box");
  const time = new Date().toLocaleTimeString();
  const text = "[" + time + "] " + msg;
  if (!box) {
    console.log(text);
    return;
  }
  const line = document.createElement("div");
  line.className = "log-line " + level;
  line.textContent = text;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
  while (box.childNodes.length > 500) box.removeChild(box.firstChild);
}

/* ---------- 连接向导步骤 ---------- */
function setStepsDone(count) {
  all(".steps").forEach((list) => {
    list.querySelectorAll(".step").forEach((s, i) => {
      s.classList.toggle("done", i < count);
    });
  });
}

/* ---------- settings ---------- */
function numOr(val, fallback) {
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? n : fallback;
}

function collectOptions() {
  // 0 = 原始 / 不限,不能用 || 兜底
  const maxSize = numOr($("opt-res")?.value, 1280);
  const maxFps = numOr($("opt-fps")?.value, 60);
  return {
    maxSize,
    maxFps,
    videoBitRate: Math.round((parseFloat($("opt-bitrate")?.value || "8") || 8) * 1e6),
    stayAwake: !!$("opt-awake")?.checked,
    turnScreenOff: !!$("opt-screen-off-start")?.checked,
    powerOffOnClose: !!$("opt-screen-off-close")?.checked,
    showTouches: !!$("opt-show-touches")?.checked,
    // 三态：both=手机+电脑 / phone=仅手机(不转发) / pc=仅电脑(手机静音)
    audioMode: $("opt-audio-mode")?.value || "both",
    videoSource: $("opt-source")?.value || "display",
  };
}

function saveSettings() {
  try {
    const data = {
      mode,
      host: $("wireless-host")?.value || "",
      device: $("usb-device-select")?.value || "",
      opts: collectOptions(),
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

let savedDeviceSerial = "";

function applySettings(data) {
  if (!data) return;
  if (data.mode === "wifi" || data.mode === "usb") setMode(data.mode, true);
  if (data.host && $("wireless-host")) $("wireless-host").value = data.host;
  savedDeviceSerial = data.device || "";
  const o = data.opts || {};
  const setSel = (id, v) => {
    const el = $(id);
    if (el && v != null && v !== "") el.value = String(v);
  };
  setSel("opt-res", o.maxSize != null ? String(o.maxSize) : "1280");
  setSel("opt-fps", o.maxFps != null ? String(o.maxFps) : "60");
  const mbps = o.videoBitRate ? Math.round(o.videoBitRate / 1e6) : 8;
  setSel("opt-bitrate", mbps);
  setSel("opt-source", o.videoSource || "display");
  const setChk = (id, v, def) => {
    const el = $(id);
    if (el) el.checked = v != null ? !!v : def;
  };
  setChk("opt-awake", o.stayAwake, true);
  setChk("opt-screen-off-start", o.turnScreenOff, false);
  setChk("opt-screen-off-close", o.powerOffOnClose, true);
  setChk("opt-show-touches", o.showTouches, false);
  // 不继承旧版的 audioDup:false —— 那等价于「手机静音」，
  // 多数人是误点才关掉的。升级后默认回到「手机 + 电脑」。
  setSel("opt-audio-mode", o.audioMode || "both");
}

function bindSettingsSaver() {
  const ids = [
    "opt-res",
    "opt-fps",
    "opt-bitrate",
    "opt-source",
    "opt-awake",
    "opt-screen-off-start",
    "opt-screen-off-close",
    "opt-show-touches",
    "opt-audio-mode",
    "wireless-host",
  ];
  ids.forEach((id) => {
    on(id, "change", saveSettings);
    on(id, "input", () => {
      clearTimeout(bindSettingsSaver._t);
      bindSettingsSaver._t = setTimeout(saveSettings, 300);
    });
  });
}

function scheduleUsbReconnect(reason) {
  if (mode !== "usb" || usbManualStop || usbStarting) return;
  if (!usbConnectedAt || Date.now() - usbConnectedAt > 30000) return;
  if (usbAutoRetries >= 1) return;
  usbAutoRetries += 1;
  clearTimeout(usbRetryTimer);
  toast("USB 链路中断", "正在自动重连，无需手动点开始");
  logLine("info", "USB 链路提前中断（" + reason + "），1.5 秒后自动重连 1/1");
  usbRetryTimer = setTimeout(() => {
    if (!usbManualStop) startUsb(true, true);
  }, 1500);
}

let ctrl = null;
let mode = "usb";
let wifiKeepAlive = null;
// v4.2.5：USB 过早掉流的自动恢复状态
let usbManualStop = false;
let usbStarting = false;
let usbConnectedAt = 0;
let usbAutoRetries = 0;
let usbRetryTimer = null;

function setMode(next, silent) {
  mode = next === "wifi" ? "wifi" : "usb";
  all(".mode-card").forEach((b) => {
    b.classList.toggle("active", b.getAttribute("data-mode") === mode);
  });
  // 只显示当前模式对应的向导与操作，避免 USB / 无线两套按钮同时出现
  all(".usb-only").forEach((el) => {
    el.hidden = mode !== "usb";
  });
  all(".wifi-only").forEach((el) => {
    el.hidden = mode !== "wifi";
  });
  if (!silent) {
    logLine("info", "连接模式=" + (mode === "usb" ? "USB" : "无线"));
    saveSettings();
  }
}

function setMuteUi(m) {
  const span = $("btn-mute")?.querySelector("span");
  if (span) span.textContent = m ? "静音中" : "声音";
  if ($("audio-hint")) $("audio-hint").textContent = m ? "声音:静音" : "声音:开";
}

/* ---------- 断线遮罩：画面冻结时给出明确提示 ---------- */
function showOffline(desc) {
  const box = $("stage-offline");
  if (!box) return;
  if (desc && $("stage-offline-desc")) $("stage-offline-desc").textContent = desc;
  box.hidden = false;
  $("stage")?.classList.add("is-offline");
}

function hideOffline() {
  const box = $("stage-offline");
  if (box) box.hidden = true;
  $("stage")?.classList.remove("is-offline");
}

async function toggleFullscreen() {
  const root = $("mirror-layout");
  if (!root) return;
  if (!document.fullscreenElement) {
    await root.requestFullscreen?.();
    root.classList.add("is-fullscreen");
    setFsButtonLabel(true);
    if ($("fs-float")) $("fs-float").hidden = false;
  } else {
    await document.exitFullscreen?.();
    root.classList.remove("is-fullscreen");
    setFsButtonLabel(false);
    if ($("fs-float")) $("fs-float").hidden = true;
  }
  fitCanvas();
}

function setFsButtonLabel(onFs) {
  const label = onFs ? "退出全屏" : "全屏";
  const span = $("btn-fullscreen")?.querySelector("span");
  if (span) span.textContent = label;
  const fsLbl = $("btn-fs-fullscreen")?.querySelector(".lbl3");
  if (fsLbl) fsLbl.textContent = label;
}

function fitCanvas() {
  const canvas = document.querySelector("#stage canvas");
  const stage = $("stage");
  if (!canvas || !stage) return;

  const fs =
    !!document.fullscreenElement ||
    !!$("mirror-layout")?.classList.contains("is-fullscreen");

  // 比例以解码器画布实际帧尺寸为准：横竖屏切换时画布会立即变成新方向，
  // 而 mirror._size 只在配置包更新时才刷新，优先读 _size 会让画面被拉成旧方向。
  let liveSize = null;
  try { liveSize = mirror._size; } catch { liveSize = null; }
  let nw = Number(canvas.width) || Number(canvas.videoWidth) || Number(liveSize?.width) || 0;
  let nh = Number(canvas.height) || Number(canvas.videoHeight) || Number(liveSize?.height) || 0;
  if (!nw || !nh) {
    const res = ($("stat-res")?.textContent || "").match(/(\d+)\s*[x×]\s*(\d+)/i);
    if (res) {
      nw = Number(res[1]);
      nh = Number(res[2]);
    }
  }
  if (!nw || !nh) {
    nw = 16;
    nh = 9;
  }
  const ratio = nw / nh;
  const cs = getComputedStyle(stage);
  const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  // 只留 4px 安全边距；四角读数已移到侧栏，舞台上下不再预留大段净空
  const GAP = 4;
  let maxW, maxH;
  if (fs) {
    maxW = window.innerWidth - GAP * 2;
    maxH = window.innerHeight - padY;
  } else {
    const rect = stage.getBoundingClientRect();
    maxW = Math.max(120, rect.width - padX - GAP * 2);
    maxH = Math.max(120, rect.height - padY - GAP * 2);
  }
  let dw = maxW;
  let dh = dw / ratio;
  if (dh > maxH) {
    dh = maxH;
    dw = dh * ratio;
  }
  const rot = Number(canvas.dataset.rotate || 0);
  // 用精确像素尺寸,避免 contain 黑边导致点位偏差
  canvas.style.width = Math.round(dw) + "px";
  canvas.style.height = Math.round(dh) + "px";
  canvas.style.objectFit = "fill";
  canvas.style.transformOrigin = "center center";
  canvas.style.transform = rot ? "rotate(" + rot + "deg)" : "none";
  positionHud(canvas);
}

/* 让四角读数贴在画面外侧的净空里：左列对齐画面左边、右列对齐画面右边，
 * 上排落在画面上方的留白、下排落在画面下方的留白——任何比例下都不压住画面。 */
function positionHud(canvas) {
  // 读数已收进侧栏底部浮条（#hud-dock）：由 CSS 定位，不再按画面坐标摆放
  if (document.getElementById("hud-dock")) return;
  const layout = document.getElementById("mirror-layout");
  if (!layout || !canvas) return;
  const tl = document.querySelector(".hud-tl");
  const bl = document.querySelector(".hud-bl");
  const tr = document.querySelector(".hud-tr");
  const br = document.querySelector(".hud-br");
  if (!tl || !bl || !tr || !br) return;
  const cr = canvas.getBoundingClientRect();
  const ar = layout.getBoundingClientRect();
  if (!cr.width || !cr.height || !ar.width) return;

  const gap = 6;
  const left = Math.round(cr.left - ar.left);
  const right = Math.round(ar.right - cr.right);
  const top = Math.round(cr.top - ar.top);
  const bottom = Math.round(cr.bottom - ar.top);
  const frameW = Math.round(cr.width);

  // 量一次实际高度（两行读数约 30px，单行约 14px），再据此贴边，换字号也不会越界
  const hOf = (el) => Math.round(el.getBoundingClientRect().height) || 30;
  const clampTop = (value, height) => Math.max(2, Math.min(value, Math.round(ar.height - height - 2)));

  [tl, tr, bl, br].forEach((el) => { el.style.maxWidth = frameW + "px"; });

  tl.style.left = left + "px";
  tl.style.top = clampTop(top - hOf(tl) - gap, hOf(tl)) + "px";
  tr.style.right = right + "px";
  tr.style.top = clampTop(top - hOf(tr) - gap, hOf(tr)) + "px";
  bl.style.left = left + "px";
  bl.style.top = clampTop(bottom + gap, hOf(bl)) + "px";
  br.style.right = right + "px";
  br.style.top = clampTop(bottom + gap, hOf(br)) + "px";
}

function setViewRotate(deg) {
  const canvas = document.querySelector("#stage canvas");
  if (!canvas) return;
  canvas.dataset.rotate = String(deg || 0);
  fitCanvas();
  toast(deg ? "画面旋转 " + deg + "°" : "画面已回正");
}

/** 电脑截屏:截取画面 → 保存到电脑「图片」→ 自动打开文件 */
async function pcShot() {
  const blob = await mirror.snapshot();
  if (!blob) {
    toast("暂无画面");
    return;
  }
  const dataUrl = await new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ""));
    fr.onerror = () => resolve("");
    fr.readAsDataURL(blob);
  });
  const b64 = (dataUrl.split(",")[1] || "").trim();
  if (!b64) throw new Error("截图编码失败");
  const resp = await fetch("/api/save-shot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "pc-shot-" + Date.now() + ".png", data: b64 }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.ok) throw new Error(data.error || "保存到电脑失败");
  try {
    await fetch("/api/open-shot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: data.path }),
    });
  } catch {
    /* 保存成功即可,打开失败不阻断 */
  }
  toast("电脑截屏已保存并打开", data.name || data.path);
  logLine("ok", "pc-shot " + data.path);
}

function runAct(act) {
  const map = {
    back: () => ctrl?.back(),
    home: () => ctrl?.home(),
    recents: () => ctrl?.recents(),
    power: () => ctrl?.power(),
    "vol-up": () => ctrl?.volumeUp(),
    "vol-down": () => ctrl?.volumeDown(),
    "screen-on": () => (ctrl?.wakeUp ? ctrl.wakeUp() : ctrl?.screenOn()),
    "screen-off": () =>
      ctrl?.screenOffKeepMirror ? ctrl.screenOffKeepMirror() : ctrl?.screenOff(),
    rotate: () => ctrl?.rotate(),
    menu: () => ctrl?.menu(),
    notify: () => ctrl?.expandNotifications(),
    "notify-collapse": () => ctrl?.collapseNotifications(),
    settings: () => ctrl?.expandSettings(),
    bs: () => ctrl?.backspace(),
    del: () => ctrl?.deleteKey(),
    "phone-shot": async () => {
      const result = await ctrl?.phoneScreenshot();
      shotToast(result);
    },
    "pc-shot": pcShot,
    "rot-l": () => setViewRotate(270),
    "rot-0": () => setViewRotate(0),
    "rot-r": () => setViewRotate(90),
    stop: () => $("btn-stop")?.click(),
    "fs-full": () => toggleFullscreen(),
  };
  const fn = map[act];
  if (!fn) return;
  if (act !== "rot-l" && act !== "rot-0" && act !== "rot-r" && act !== "stop" && !ctrl) {
    toast("请先连接设备");
    return;
  }
  Promise.resolve(fn())
    .then(() => logLine("ok", "指令 " + act))
    .catch((e) => {
      logLine("error", act + " 失败 " + String(e?.message || e));
      toast("指令失败", String(e?.message || e));
    });
}

// 上一轮绑定挂在 window/document 上的兜底释放函数，重新绑定时先摘掉，避免闭包堆积
let _globalRelease = null;
let _globalVis = null;

/* ---------- 投屏画布键盘：物理键盘 / 中文输入法 ---------- */
function bindKeyboardSink(controller, canvas) {
  const sink = $("key-sink");
  if (!sink) return;

  // 点画面时把焦点交给透明输入槽，后续按键才会进到这里
  canvas.addEventListener(
    "pointerdown",
    () => {
      // 延迟到浏览器默认的“点击失焦”之后，再把焦点交回键盘槽
      setTimeout(() => {
        try {
          sink.focus({ preventScroll: true });
        } catch {
          /* ignore */
        }
      }, 0);
    },
    { passive: true }
  );

  let buf = "";
  let timer = null;
  let composing = false;
  let skipInput = "";

  const flush = () => {
    const text = buf;
    buf = "";
    if (text) sendTypedText(text).catch(() => {});
  };

  async function sendTypedText(text) {
    if (!text) return;
    // 中文、emoji 必须走输入法 commit；纯 ASCII 优先走 scrcpy 文本注入（不破坏游戏按键）
    if (hasNonAscii(text)) {
      await sendTextSmart(text, { interactive: false });
      return;
    }
    try {
      await controller.injectText(text);
    } catch {
      if (textInput?.active) await textInput.send(text);
      else throw new Error("文本注入失败");
    }
  }

  sink.addEventListener("compositionstart", () => {
    composing = true;
    clearTimeout(timer);
  });

  sink.addEventListener("compositionend", (e) => {
    composing = false;
    const text = e.data || "";
    sink.value = "";
    if (text) {
      skipInput = text;
      sendTypedText(text).catch((err) => logLine("error", "IME 上屏失败 " + String(err?.message || err)));
    }
  });

  // insertText / 语音输入等不经过 keydown 的路径
  sink.addEventListener("input", (e) => {
    if (composing || e.isComposing) return;
    const text = sink.value || "";
    sink.value = "";
    if (!text) return;
    if (skipInput && text === skipInput) {
      skipInput = "";
      return;
    }
    sendTypedText(text).catch((err) => logLine("error", "输入失败 " + String(err?.message || err)));
  });

  sink.addEventListener("keydown", async (e) => {
    if (e.isComposing || composing) return;

    // Ctrl+V：把电脑剪贴板内容送到手机
    if ((e.ctrlKey || e.metaKey) && (e.key === "v" || e.key === "V")) {
      e.preventDefault();
      try {
        const text = await navigator.clipboard.readText();
        if (text) await sendTextSmart(text, { interactive: false });
      } catch (err) {
        logLine("error", "粘贴到手机失败 " + String(err?.message || err));
      }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key.length === 1) {
      e.preventDefault();
      buf += e.key;
      clearTimeout(timer);
      timer = setTimeout(flush, 25);
      return;
    }

    const special = {
      Backspace: () => controller.backspace(),
      Delete: () => controller.deleteKey(),
      Enter: () => controller.enter(),
      Tab: () => controller.tab(),
      Escape: () => controller.escape(),
      ArrowUp: () => controller.tapKey(19),
      ArrowDown: () => controller.tapKey(20),
      ArrowLeft: () => controller.tapKey(21),
      ArrowRight: () => controller.tapKey(22),
      Home: () => controller.tapKey(122),
      End: () => controller.tapKey(123),
      PageUp: () => controller.pageUp(),
      PageDown: () => controller.pageDown(),
    };
    const fn = special[e.key];
    if (!fn) return;
    e.preventDefault();
    clearTimeout(timer);
    flush();
    try {
      await fn();
    } catch (err) {
      logLine("error", "按键失败 " + e.key + " " + String(err?.message || err));
    }
  });
}

function bindControl(controller, canvas) {
  ctrl = controller;
  if (!canvas) return;

  // 重新绑定前释放上一轮残留按压，避免旧指针态卡在设备端
  controller.releaseAllPointers().catch(() => {});

  const pos = (e) => controller.toDevice(e.clientX, e.clientY, canvas);
  // 所有触控事件统一走 Promise 兜底：写入异常打日志，且不抛出未处理 rejection
  const safe = (fn) => (e) => {
    Promise.resolve(fn(e)).catch((err) => {
      logLine("error", "触控事件失败 " + String(err?.message || err));
    });
  };

  canvas.addEventListener("pointerdown", safe(async (e) => {
    e.preventDefault();
    try { canvas.setPointerCapture?.(e.pointerId); } catch { /* 捕获失败不阻断 */ }
    const { x, y } = pos(e);
    await controller.pointerDown(e.pointerId, x, y);
  }));
  canvas.addEventListener("pointermove", safe(async (e) => {
    if (!controller.active.has(e.pointerId)) return;
    e.preventDefault();
    const { x, y } = pos(e);
    await controller.pointerMove(e.pointerId, x, y);
  }));
  const up = safe((e) => controller.pointerUp(e.pointerId));
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", safe((e) => controller.pointerCancel(e.pointerId)));
  canvas.addEventListener("lostpointercapture", up);
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener(
    "wheel",
    safe(async (e) => {
      e.preventDefault();
      const { x, y } = pos(e);
      await controller.scroll(
        x,
        y,
        Math.max(-1, Math.min(1, -e.deltaX / 320)),
        Math.max(-1, Math.min(1, -e.deltaY / 320))
      );
    }),
    { passive: false }
  );

  // 全局兜底：窗口失焦 / 指针在画面外被取消 / 页面切到后台时，释放所有按压。
  // 否则某次 pointerup 丢失后，该指针会一直卡在「已按下」，下次点击被当成 Move，点不出点击。
  if (_globalRelease) {
    window.removeEventListener("blur", _globalRelease);
    document.removeEventListener("pointercancel", _globalRelease);
  }
  if (_globalVis) document.removeEventListener("visibilitychange", _globalVis);
  _globalRelease = () => controller.releaseAllPointers().catch(() => {});
  _globalVis = () => { if (document.hidden) _globalRelease(); };
  window.addEventListener("blur", _globalRelease);
  document.addEventListener("pointercancel", _globalRelease);
  document.addEventListener("visibilitychange", _globalVis);

  bindKeyboardSink(controller, canvas);
  fitCanvas();
}

let devicePanels = null;
let textInput = null;
const mirror = new AdbMirror({
  stage: $("stage"),
  status: $("status"),
  onStatus(text) {
    const pill = $("status");
    if (pill) {
      pill.textContent = text;
      const down =
        text === "已断开" || text === "投屏已结束" || text.indexOf("链路已断开") >= 0;
      pill.classList.toggle("offline", down || text === "未连接");
      pill.classList.toggle("dropped", down);
    }
    const mirroring = text === "投屏中";
    document.body.classList.toggle("mirroring", mirroring);
    if (mirroring) {
      usbStarting = false;
      if (mode === "usb") usbConnectedAt = Date.now();
      setStepsDone(3);
      hideOffline();
      if ($("placeholder")) $("placeholder").style.display = "none";
      devicePanels?.notifyConnected();
      if (mirror.adb) {
        textInput = new DeviceTextInput(mirror.adb, mirror.serialKey);
        refreshImeStatus();
        setTimeout(refreshImeStatus, 900);
        setTimeout(autoProvisionIme, 1200);
      }
    }
    if (text === "已断开" || text === "投屏已结束") {
      document.body.classList.remove("mirroring");
      ctrl = null;
      if (textInput) {
        textInput.restore().catch(() => {});
        textInput = null;
        refreshImeStatus();
      }
      devicePanels?.markDisconnected();
      setStepsDone(0);
      // 断开即无画面：清掉舞台内容，恢复占位符（v3.0.17 起不再保留冻结帧）
      if ($("placeholder")) {
        $("placeholder").style.display = "flex";
        if ($("placeholder-text")) {
          $("placeholder-text").textContent =
            text === "投屏已结束" ? "连接已结束，可重新连接" : "连接已断开，可重新连接";
        }
      }
      showOffline(
        text === "投屏已结束"
          ? "连接已结束，可重新连接"
          : mode === "wifi"
            ? "无线已断开：手机端看门狗会自动结束 scrcpy，约 10 秒内恢复手机外放"
            : "连接已断开，可重新连接"
      );
      if ((text === "已断开" || text === "投屏已结束") && mode === "usb") {
        scheduleUsbReconnect(text);
      }
    } else if (text.indexOf("链路已断开") >= 0) {
      showOffline("无线链路已断开，正在尝试恢复手机声音…");
    }
    logLine("info", text);
    if (text === "投屏已结束" || text === "已断开") {
      logLine("error", "投屏连接已断开 / 已结束");
    }
  },
  onError(err) {
    logLine("error", "流错误 " + String(err?.message || err));
    toast("错误", String(err?.message || err));
  },
  onStats(s) {
    // 解码器画布是方向变化的第一现场：横竖屏切换后先用画布尺寸纠正 _size，
    // 再刷新状态栏，避免底部一直显示旧方向的分辨率。
    const liveCanvas = document.querySelector("#stage canvas");
    if (liveCanvas && liveCanvas.width > 0 && liveCanvas.height > 0 && (s.frames ?? 0) > 0) {
      const cw = Number(liveCanvas.width);
      const ch = Number(liveCanvas.height);
      if (cw !== s.width || ch !== s.height) {
        s = { ...s, width: cw, height: ch };
        try { mirror._size = { width: cw, height: ch }; } catch { /* mirror 可能尚未就绪 */ }
      }
    }
    if ($("stat-res")) {
      const sizeTxt = s.width && s.height ? s.width + "×" + s.height : "—";
      const o = collectOptions();
      $("stat-res").textContent =
        o.maxSize > 0 ? sizeTxt + " (限制" + o.maxSize + ")" : sizeTxt + " (原始)";
    }
    if ($("stat-frames")) $("stat-frames").textContent = String(s.frames ?? 0);
    if ($("stat-fps")) $("stat-fps").textContent = s.fps != null ? String(s.fps) : "—";
    if ($("stat-vdrop")) $("stat-vdrop").textContent = String(s.vdrop ?? 0);
    if ($("stat-codec") && s.renderer) $("stat-codec").textContent = "H.264 · " + s.renderer;
    if ($("stat-audio") && s.audio) $("stat-audio").textContent = s.audio;
    if ($("audio-hint") && s.audio) $("audio-hint").textContent = "声音:" + s.audio;
    fitCanvas();
  },
  onFirstFrame() {
    if ($("placeholder")) $("placeholder").style.display = "none";
    fitCanvas();
    toast("已出画面");
    logLine("ok", "首帧已渲染");
  },
  onController(controller, canvas) {
    controller.onError = (err, where) => {
      logLine("error", "控制指令 " + where + " 失败: " + String(err?.message || err));
    };
    bindControl(controller, canvas);
  },
  onLog: (msg) => logLine("log", String(msg)),
  // 关闭 ADB 通道前恢复手机原输入法（此时通道仍可用）；断开回调里的 restore 仅作二次兜底
  onBeforeTeardown: async () => {
    if (textInput) {
      try {
        await textInput.restore();
      } catch (e) {
        logLine("error", "断开前恢复输入法失败 " + String(e?.message || e));
      }
    }
  },
});

devicePanels = bindDevicePanels({
  getMirror: () => mirror,
  toast,
  log: logLine,
});

function showFail(err) {
  console.error(err);
  const baseMsg =
    err instanceof MirrorError || err instanceof WirelessError
      ? err.message
      : String(err?.message || err);
  const serverOutput = Array.isArray(err?.output)
    ? err.output.map((line) => String(line).trim()).filter(Boolean).join("\n")
    : "";
  const msg = baseMsg + (serverOutput ? "\n设备端输出：\n" + serverOutput : "");
  const guide =
    err instanceof MirrorError ? err.guide : err instanceof WirelessError ? wirelessHelp() : "";
  const isBusy = err instanceof MirrorError && err.code === "DEVICE_BUSY";
  toast("失败", guide ? msg + "\n" + guide : msg, {
    duration: isBusy ? 15000 : 8000,
    html: isBusy
      ? '<div class="shot-actions"><button type="button" class="btn primary xs-btn" data-kill-adb="1">清理占用进程 (adb)</button></div>'
      : "",
  });
  if (isBusy) bindKillAdbButtons();
  logLine("error", msg);
  if ($("placeholder")) {
    $("placeholder").style.display = "flex";
    if ($("placeholder-text")) $("placeholder-text").textContent = msg;
  }
}

/* ---------- 心跳 Worker ----------
 * 看门狗只认「心跳」：页面每 5 秒通过现有 ADB 通道写一次，写进去就证明通道还活着。
 * 后台标签页会把主线程定时器压到 1 分钟一次，那样看门狗会误判失联，所以心跳交给 Worker。
 */
let hbWorker = null;
let hbFallback = null;
function startHeartbeatWorker() {
  stopHeartbeatWorker();
  try {
    const code =
      "let t=null;onmessage=function(e){if(e.data==='start'){if(t)clearInterval(t);t=setInterval(function(){postMessage(1)},5000)}else if(e.data==='stop'){if(t)clearInterval(t);t=null}};";
    const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
    hbWorker = new Worker(url);
    hbWorker.onmessage = () => {
      if (mirror.running) mirror.heartbeat();
    };
    hbWorker.postMessage("start");
  } catch (e) {
    // Worker 起不来（CSP 拦了 blob: 等）必须补一个定时器，
    // 否则心跳只在布防时写一次，30 秒后看门狗会把正常投屏当成断线杀掉。
    logLine("log", "心跳 Worker 不可用，改用页面定时器：" + String(e?.message || e));
    hbFallback = setInterval(() => {
      if (mirror.running) mirror.heartbeat();
    }, 6000);
  }
}
function stopHeartbeatWorker() {
  if (hbFallback) {
    clearInterval(hbFallback);
    hbFallback = null;
  }
  if (!hbWorker) return;
  try {
    hbWorker.postMessage("stop");
    hbWorker.terminate();
  } catch {
    /* ignore */
  }
  hbWorker = null;
}

function startWifiKeepAlive(target) {
  stopWifiKeepAlive();
  startHeartbeatWorker();
  let fails = 0;
  let inFlight = false;
  wifiKeepAlive = setInterval(async () => {
    if (!mirror.running || inFlight) return;
    inFlight = true;
    try {
      // 快探测：1.2s 超时的 shell 往返。局域网正常往返 <100ms，
      // 1.2s 是 10 倍以上的余量；连续 2 次失败（≈3~5 秒）才判定断线。
      const ok = await mirror.ping(1200);
      if (ok) {
        fails = 0;
        return;
      }
      // ping 超时 ≠ 断线：若期间视频/音频/ADB 数据仍在流入，说明只是拥塞。
      // 收到过数据是比 ping 回包更强的「链路活着」证据。
      const lastRecv = mirror.linkLastRecv();
      if (lastRecv && Date.now() - lastRecv < 2500) {
        fails = 0;
        return;
      }
      fails += 1;
      logLine("log", "无线心跳失败 " + fails + "/2 · " + target);
      if (fails >= 2) {
        stopWifiKeepAlive();
        logLine("error", "无线链路已断开，正在释放手机端音频");
        toast("无线已断开", "正在尝试恢复手机声音…");
        await mirror.handleLinkLost();
      }
    } finally {
      inFlight = false;
    }
  }, 1200);
  logLine("info", "无线保活已启动(1.2s 探测，约 3~5 秒内感知断线)");
}

function stopWifiKeepAlive() {
  stopHeartbeatWorker();
  if (wifiKeepAlive) {
    clearInterval(wifiKeepAlive);
    wifiKeepAlive = null;
    logLine("info", "无线保活已停止");
  }
}

/* ---------- 手动恢复手机声音 ---------- */
async function fixPhoneAudio() {
  logLine("info", "强力恢复手机声音：结束 scrcpy → 关静音/勿扰 → 重设音量 → 重算音频路由…");
  try {
    // 未连接时先重连一次（保留连接用于下发恢复命令）
    if (!mirror.adb) {
      if (!mirror._wirelessTarget) {
        logLine("error", "当前未连接手机，请先连接后再试");
        toast("无法恢复", "请先连接手机");
        return;
      }
      logLine("info", "未连接，先重连手机…");
      const ok = await mirror.ensureAdbForRepair();
      if (!ok) {
        logLine("error", "重连失败：请确认手机与电脑在同一 Wi-Fi（无线调试已开启）");
        toast("重连失败", "请检查手机网络后重试");
        return;
      }
      logLine("log", "已重连手机，开始恢复…");
    }

    const sdk = await mirror.getAndroidSdk();
    if (sdk) logLine("log", "手机 Android SDK=" + sdk);

    await mirror.forceAudioRestore();

    // 诊断回读：把关键状态打出来，用户直接贴日志即可定位
    const report = await mirror.diagnoseAudio();
    if (report) {
      const remain = /\[scrcpy 进程\]\s*\n?\s*([^\n]*)/.exec(report);
      const vol = report.split("[媒体音量/静音/路由]")[1] || "";
      const volLine = vol.split("\n").filter((l) => /STREAM_MUSIC|streamVolume|muted/i.test(l)).slice(0, 3);
      logLine("log", "恢复后诊断 · scrcpy 进程: " + (remain ? remain[1].trim() : "未知"));
      if (volLine.length) logLine("log", "音量状态: " + volLine.join(" | ").trim());
      const zen = report.split("[勿扰 zen_mode]")[1];
      if (zen && /\n\s*[1-9]/.test(zen)) logLine("warn", "手机仍处于勿扰/静音模式，请手动关闭");
      // 完整诊断以多行日志形式输出，方便用户整体复制
      report.split("\n").filter((l) => l.trim()).slice(0, 30).forEach((l) => logLine("log", "· " + l.trim()));
    }

    logLine("info", "恢复命令已全部下发。若手机仍无声，请：插拔一次手机 / 播放任意视频测试 / 或重启手机");
    toast("已执行强力恢复", "仍无声请查看日志并反馈");
  } catch (e) {
    logLine("error", "恢复失败 " + String(e?.message || e));
    toast("恢复失败", String(e?.message || e));
  }
}

/* ---------- USB 设备选择 ---------- */
async function refreshUsbDevices(silent) {
  const sel = $("usb-device-select");
  if (!sel) return;
  const devices = await mirror.listUsbDevices();
  const current = sel.value || savedDeviceSerial;
  sel.innerHTML =
    '<option value="">自动选择设备</option>' +
    devices
      .map(
        (d) =>
          '<option value="' +
          String(d.serial).replace(/"/g, "") +
          '">' +
          d.name +
          " (" +
          d.serial +
          ")</option>"
      )
      .join("");
  if (current && devices.some((d) => d.serial === current)) {
    sel.value = current;
  }
  if (!silent) {
    logLine("info", "USB 设备列表:" + (devices.length ? devices.length + " 台" : "无已授权设备"));
    if (!devices.length) toast("没有已授权设备", "点「添加」在系统弹窗中选择手机");
  }
}

function bindKillAdbButtons() {
  document.querySelectorAll("[data-kill-adb]").forEach((b) => {
    if (b.dataset.bound === "1") return;
    b.dataset.bound = "1";
    b.addEventListener("click", async () => {
      b.disabled = true;
      b.textContent = "清理中…";
      try {
        const resp = await fetch("/api/kill-adb", { method: "POST" });
        const data = await resp.json().catch(() => ({}));
        logLine("ok", "清理占用 " + JSON.stringify(data.detail || []));
        toast("已清理 adb 占用", "请重新点「开始 USB 投屏」");
      } catch (e) {
        toast("清理失败", String(e?.message || e));
        logLine("error", "kill-adb " + String(e?.message || e));
      }
    });
  });
}

async function waitForUsbAuthorization(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    try {
      const resp = await fetch("/api/adb-usb", { method: "POST" });
      const data = await resp.json();
      if ((data.devices || []).some((d) => d.state === "device")) {
        toast("手机已授权", "正在继续连接");
        return true;
      }
    } catch {
      /* retry */
    }
  }
  return false;
}

async function startUsb(allowAnyMode = false, autoRetry = false) {
  if (!allowAnyMode && mode !== "usb") {
    toast("请先选择 USB 模式", "USB 与无线只能二选一");
    return;
  }
  if (usbStarting) return;
  if (!autoRetry) {
    usbManualStop = false;
    usbAutoRetries = 0;
    clearTimeout(usbRetryTimer);
  }
  usbStarting = true;
  usbConnectedAt = 0;
  hideOffline();
  const opts = collectOptions();
  const preferSerial = $("usb-device-select")?.value || null;
  saveSettings();
  logLine("info", "USB 直连 " + (preferSerial || "auto") + " " + JSON.stringify(opts));
  if ($("btn-start")) $("btn-start").disabled = true;
  if ($("placeholder-text")) $("placeholder-text").textContent = "USB 直连中…";
  setStepsDone(1);
  let adbReleased = false;
  try {
    stopWifiKeepAlive();
    // 只有 adb server 真在运行时才让它退出；空跑 kill-server 会触发 USB 重新枚举
    try {
      const resp = await fetch("/api/kill-adb", { method: "POST" });
      const info = await resp.json().catch(() => ({}));
      adbReleased = info.changed === true;
      logLine("info", "释放本机 adb 占用 " + JSON.stringify(info.detail || []));
    } catch {
      /* 没有占用时忽略 */
    }
    // 即使 adb 没在运行，上一次 WebUSB 句柄释放后 Windows 也需要短暂稳定期。
    // 真正停过 adb server 时等待更久，避免 USB 重新枚举把刚建立的链路重置。
    await new Promise((resolve) => setTimeout(resolve, adbReleased ? 3000 : 1500));
    logLine("info", "检查已授权 USB 设备…");
    try {
      await mirror.start(preferSerial, opts);
    } catch (err) {
      if (err?.code === "DEVICE_BUSY" && !adbReleased) {
        logLine("info", "检测到 adb 在后台抢占了接口，释放后重试");
        try {
          const resp = await fetch("/api/kill-adb", { method: "POST" });
          const info = await resp.json().catch(() => ({}));
          adbReleased = info.changed === true;
        } catch {
          /* ignore */
        }
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await mirror.start(preferSerial, opts);
      } else {
        throw err;
      }
    }
    if (mirror.device?.serial && $("stat-serial")) {
      $("stat-serial").textContent = "设备:" + mirror.device.serial;
    }
    toast("USB 连接成功");
    logLine("ok", "USB 连接成功");
  } catch (err) {
    showFail(err);
  } finally {
    usbStarting = false;
    if ($("btn-start")) $("btn-start").disabled = false;
  }
}

function renderScanList(devices) {
  const list = $("scan-list");
  if (!list) return;
  if (!devices.length) {
    list.innerHTML = '<div class="scan-empty">未发现设备</div>';
    return;
  }
  list.innerHTML = devices
    .map(
      (d, i) =>
        '<label class="scan-item' +
        (i === 0 ? " selected" : "") +
        '"><input type="radio" name="wifi-dev" value="' +
        d.target +
        '"' +
        (i === 0 ? " checked" : "") +
        " /><span>" +
        d.target +
        "</span></label>"
    )
    .join("");
  list.querySelectorAll("input[name=wifi-dev]").forEach((r) => {
    r.addEventListener("change", () => {
      if ($("wireless-host")) $("wireless-host").value = r.value;
      saveSettings();
      list.querySelectorAll(".scan-item").forEach((x) => x.classList.remove("selected"));
      r.closest(".scan-item")?.classList.add("selected");
    });
  });
  if (devices[0] && $("wireless-host")) {
    $("wireless-host").value = devices[0].target;
    saveSettings();
  }
}

async function scanWifi(auto) {
  if ($("btn-scan")) $("btn-scan").disabled = true;
  if ($("scan-status")) $("scan-status").textContent = "正在搜索本地无线设备…";
  if (!auto) toast("正在搜索本地设备 IP…");
  try {
    const devices = await scanWireless(2500);
    logLine("info", "搜索完成,发现 " + devices.length + " 台 " + JSON.stringify(devices));
    renderScanList(devices);
    if ($("scan-status")) {
      $("scan-status").textContent = devices.length
        ? "发现 " + devices.length + " 台,请选中后点「连接」"
        : "未发现设备。请手机开启无线调试,且与电脑同一 Wi-Fi。";
    }
  } catch (err) {
    logLine("error", "搜索失败 " + String(err?.message || err));
    if ($("scan-status")) $("scan-status").textContent = "搜索失败:" + (err?.message || err);
    if (!auto) showFail(err);
  } finally {
    if ($("btn-scan")) $("btn-scan").disabled = false;
  }
}

async function connectWifi() {
  if (mode !== "wifi") {
    toast("请先选择无线模式", "USB 与无线只能二选一");
    return;
  }
  const target = ($("wireless-host")?.value || "").trim();
  if (!target) {
    toast("请选择或填写 IP:端口");
    return;
  }
  const opts = collectOptions();
  saveSettings();
  hideOffline();
  logLine("info", "无线连接 " + target + " " + JSON.stringify(opts));
  if ($("btn-wireless")) $("btn-wireless").disabled = true;
  if ($("placeholder-text")) $("placeholder-text").textContent = "无线连接中…";
  setStepsDone(1);
  try {
    stopWifiKeepAlive();
    if (mirror.running || mirror.adb) {
      try {
        await mirror.stop();
        hideOffline();
      } catch (e) {
        logLine("error", "清理旧连接 " + String(e?.message || e));
      }
    }
    await mirror.startWireless(target, opts);
    if ($("stat-serial")) $("stat-serial").textContent = "设备:" + target;
    toast("无线连接成功", target);
    logLine("ok", "无线连接成功 " + target);
    startWifiKeepAlive(target);
  } catch (err) {
    logLine("error", "无线连接失败 " + String(err?.message || err));
    // 失败后别把状态停在「握手中 / 上传中」：那个旧文案会让人以为还在连
    try {
      mirror.status("连接失败");
    } catch {
      /* ignore */
    }
    showFail(err);
  } finally {
    if ($("btn-wireless")) $("btn-wireless").disabled = false;
  }
}

async function disconnectWifi() {
  try {
    stopWifiKeepAlive();
    await mirror.stop();
    hideOffline();
    if ($("placeholder")) $("placeholder").style.display = "flex";
    if ($("placeholder-text")) $("placeholder-text").textContent = "无线已断开";
    toast("已断开无线");
    logLine("info", "无线已手动断开");
  } catch (err) {
    logLine("error", "断开失败 " + String(err?.message || err));
    showFail(err);
  }
}

/* ---------- 绑定 ---------- */
all(".mode-card").forEach((b) => {
  b.addEventListener("click", () => {
    setMode(b.getAttribute("data-mode"));
    if (mode === "wifi") setTimeout(() => scanWifi(true), 200);
  });
});

on("btn-usb-refresh", "click", () => refreshUsbDevices(false));
on("btn-usb-add", "click", async () => {
  try {
    await mirror.pickUsbDevice();
    await refreshUsbDevices(true);
    const dev = mirror.device;
    if (dev?.serial && $("usb-device-select")) {
      $("usb-device-select").value = dev.serial;
      saveSettings();
    }
    toast("设备已授权", dev?.serial || "");
    logLine("ok", "已授权设备 " + (dev?.serial || "?"));
  } catch (err) {
    if (err?.code === "NO_DEVICE") {
      toast("已取消选择");
    } else {
      showFail(err);
    }
  }
});
on("usb-device-select", "change", saveSettings);
on("btn-start", "click", () => startUsb());
on("btn-start-2", "click", () => (mode === "usb" ? startUsb() : connectWifi()));
on("btn-wifi-enable", "click", async () => {
  try {
    if (mirror.adb && mirror._wirelessTarget) {
      toast("已经是无线连接", "无需重复开启无线调试");
      return;
    }
    if (!mirror.adb) {
      toast("请先用 USB 连接手机", "开启无线调试需要 USB 通道");
      await startUsb(true);
      if (!mirror.adb) return;
    }
    toast("正在开启无线调试…");
    const info = await enableWirelessViaUsb(mirror.adb, 5555);
    logLine("info", "tcpip 5555 => " + (info.target || info.message));
    if (info.target) {
      if ($("wireless-host")) $("wireless-host").value = info.target;
      saveSettings();
      setMode("wifi");
      toast("已开启无线调试", info.target + ",请在无线模式连接");
    }
  } catch (err) {
    logLine("error", "开启无线失败 " + String(err?.message || err));
    showFail(err);
  }
});
on("btn-scan", "click", () => scanWifi(false));
on("btn-wireless", "click", connectWifi);
on("btn-wifi-disconnect", "click", disconnectWifi);

on("btn-stop", "click", async () => {
  usbManualStop = true;
  clearTimeout(usbRetryTimer);
  stopWifiKeepAlive();
  await mirror.stop();
  hideOffline();
  ctrl = null;
  document.body.classList.remove("mirroring");
  setStepsDone(0);
  if ($("placeholder")) $("placeholder").style.display = "flex";
  if ($("placeholder-text")) $("placeholder-text").textContent = "已停止投屏";
  if ($("stat-fps")) $("stat-fps").textContent = "—";
  if ($("fs-float")) $("fs-float").hidden = true;
  logLine("info", "已停止投屏");
});

/* 断线遮罩上的「重新连接」：按当前模式走对应连接流程 */
on("btn-stage-reconnect", "click", async () => {
  hideOffline();
  if (mode === "wifi") {
    const target = ($("wireless-host")?.value || "").trim();
    if (!target) {
      toast("请先填写手机 IP:端口", "或用「自动搜索」发现设备");
      setMode("wifi");
      return;
    }
    await connectWifi();
    return;
  }
  await startUsb();
});

on("btn-fullscreen", "click", toggleFullscreen);
// btn-fs-fullscreen 走 data-act="fs-full" 委托,避免双重绑定
document.addEventListener("fullscreenchange", () => {
  const onFs = !!document.fullscreenElement;
  setFsButtonLabel(onFs);
  $("mirror-layout")?.classList.toggle("is-fullscreen", onFs);
  if ($("fs-float")) $("fs-float").hidden = !onFs;
  fitCanvas();
  requestAnimationFrame(fitCanvas);
  setTimeout(fitCanvas, 120);
});

on("btn-mute", "click", () => {
  mirror.toggleMute();
  setMuteUi(mirror.muted);
  toast(mirror.muted ? "已静音" : "已开启声音");
});
on("btn-fix-audio", "click", async () => {
  await fixPhoneAudio();
});
on("btn-screenshot", "click", async () => {
  try {
    await pcShot();
  } catch (e) {
    toast("截屏失败", String(e?.message || e));
    logLine("error", "pc-shot " + String(e?.message || e));
  }
});
async function shutdownServer() {
  try {
    await fetch("/api/shutdown", { method: "POST", cache: "no-store" });
  } catch {
    /* 进程可能在回包后立刻退出，连接被重置属正常 */
  }
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 250));
    try {
      const r = await fetch("/api/status", { cache: "no-store" });
      if (!r.ok) return true;
    } catch {
      return true; // 连不上了 = 已停
    }
  }
  return false;
}

on("btn-stop-server", "click", async () => {
  if (!confirm("确定停止本地服务?将清理进程并关闭本网页。")) return;
  try {
    stopWifiKeepAlive();
    // 收尾不能拖住关机动作：最多等 3s，adb 卡住也照样去关服务
    await Promise.race([
      mirror.stop().catch(() => {}),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
    logLine("info", "正在停止本地服务…");
    let ok = await shutdownServer();
    if (!ok) {
      await new Promise((r) => setTimeout(r, 600));
      ok = await shutdownServer();
    }
    logLine(ok ? "info" : "error", ok ? "服务已停止" : "服务未能停止,请运行 stop.cmd");
    toast(ok ? "服务已停止" : "服务未停止", ok ? "正在关闭页面…" : "请双击 stop.cmd 清理");
    setTimeout(() => {
      try {
        window.close();
      } catch {
        /* ignore */
      }
      try {
        const msg = ok
          ? ["本地服务已停止", "可关闭此标签页,或重新运行 start.vbs"]
          : ["服务未能自动停止", "请运行目录下的 stop.cmd,或任务管理器结束 python.exe"];
        document.body.innerHTML =
          '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0b0e12;color:#e8ecf1;font:15px/1.6 system-ui,sans-serif;text-align:center;padding:24px"><div><h2 style="margin:0 0 8px">' +
          msg[0] +
          '</h2><p style="color:#8b95a5">' +
          msg[1] +
          "</p></div></div>";
      } catch {
        /* ignore */
      }
    }, 300);
  } catch (err) {
    toast("停止失败", String(err?.message || err));
    logLine("error", "stop server " + String(err?.message || err));
  }
});

on("btn-show-guide", "click", () => {
  const p = $("guide-panel");
  if (p) {
    p.hidden = false;
    logLine("info", "打开使用指南");
  }
});
on("btn-guide-close", "click", () => {
  const p = $("guide-panel");
  if (p) p.hidden = true;
});
(function bindGuideMask() {
  const p = $("guide-panel");
  if (!p) return;
  p.addEventListener("click", (e) => {
    if (e.target === p) p.hidden = true;
  });
})();
on("btn-clear-log", "click", () => {
  const box = $("log-box");
  if (box) box.innerHTML = "";
});

all("[data-act]").forEach((el) => {
  el.addEventListener("click", () => runAct(el.getAttribute("data-act")));
});

/* ---------- 全屏悬浮条:折叠 + 拖动 ---------- */
(function bindFsFloat() {
  const panel = $("fs-float");
  const handle = panel?.querySelector(".drag-handle");
  if (!panel || !handle) return;

  on("fs-toggle", "click", () => {
    panel.classList.toggle("collapsed");
  });

  let drag = null;
  handle.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".fs-toggle")) return;
    const rect = panel.getBoundingClientRect();
    drag = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    handle.setPointerCapture?.(e.pointerId);
  });
  handle.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const x = Math.max(0, Math.min(window.innerWidth - 80, e.clientX - drag.dx));
    const y = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - drag.dy));
    panel.style.left = x + "px";
    panel.style.top = y + "px";
    panel.style.right = "auto";
  });
  const end = () => (drag = null);
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);
})();

/* ---------- 中文输入：ADBKeyboard 输入法插件 ---------- */
function imeAutoOn() {
  const box = $("ime-auto");
  if (box) return box.checked;
  try {
    return localStorage.getItem(IME_AUTO_KEY) !== "0";
  } catch {
    return true;
  }
}

/**
 * 连接成功后自动配置：缺插件就装、没启用就启用、按设置切到 ADB 输入法。
 * 失败只记日志，不影响投屏；文本框发送仍是兜底。
 */
async function autoProvisionIme() {
  if (!textInput) return;
  try {
    let st = await textInput.status();
    if (!st.installed) {
      toast("首次连接：正在安装中文输入插件", "约 18KB，装好后中文可直接上屏");
      const blob = await textInput.fetchBundle();
      await textInput.installFromBundle(blob, (p) => {
        if (p?.total) {
          const pct = Math.round((p.sent / p.total) * 100);
          if (pct === 100) toast("插件已推送", "正在安装…");
        }
      });
      st = await textInput.status();
      if (!st.installed) throw new Error("插件安装后未检测到");
    }
    if (!st.enabled) await textInput.enable();
    if (imeAutoOn()) await textInput.activate();
    await refreshImeStatus();
    logLine("ok", "IME 自动配置完成 installed=" + st.installed + " auto=" + imeAutoOn());
  } catch (e) {
    logLine("error", "IME 自动配置失败 " + String(e?.message || e));
    toast("中文输入自动配置失败", String(e?.message || e) + "，可在文本框里手动启用");
    refreshImeStatus();
  }
}

async function refreshImeStatus() {
  const label = $("ime-status");
  const setup = $("btn-ime-setup");
  const restore = $("btn-ime-restore");
  if (!label) return;
  if (!textInput && mirror.adb) textInput = new DeviceTextInput(mirror.adb, mirror.serialKey);
  if (!textInput) {
    label.textContent = "中文输入：未连接设备";
    if (setup) { setup.disabled = true; setup.hidden = true; }
    if (restore) restore.hidden = true;
    return;
  }
  try {
    const st = await textInput.status();
    const inUse = st.current === ADB_IME_ID;
    if (!st.installed) {
      label.textContent = "中文输入：未安装插件";
      if (setup) { setup.disabled = false; setup.hidden = false; setup.textContent = "安装中文输入插件"; }
    } else if (!st.enabled) {
      label.textContent = "中文输入：插件未启用";
      if (setup) { setup.disabled = false; setup.hidden = false; setup.textContent = "启用插件"; }
    } else if (inUse) {
      label.textContent = "中文输入：使用中（ADB 输入法）";
      if (setup) { setup.disabled = true; setup.hidden = true; }
    } else {
      label.textContent = "中文输入：可用";
      if (setup) { setup.disabled = false; setup.hidden = false; setup.textContent = "切换到 ADB 输入法"; }
    }
    if (restore) restore.hidden = !inUse;
  } catch (e) {
    label.textContent = "中文输入：检测失败";
    if (setup) { setup.disabled = false; setup.hidden = false; setup.textContent = "重试"; }
  }
}

async function ensureChineseInput({ interactive = false } = {}) {
  if (!textInput) throw new Error("请先连接设备");
  let st = await textInput.status();
  if (!st.installed) {
    if (interactive && !confirm("中文输入需要在手机上装一个开源输入法插件 ADBKeyboard（约 18KB，GPL-2.0）。安装并启用？")) {
      throw new Error("已取消安装中文输入插件");
    }
    toast("正在安装中文输入插件", "约 18KB，只会用来把电脑上的字送进手机输入框");
    const blob = await textInput.fetchBundle();
    await textInput.installFromBundle(blob, (p) => {
      if (p?.phase === "install") toast("正在安装插件", "APK 已推送，正在安装…");
      else if (p?.total) {
        const pct = Math.round((p.sent / p.total) * 100);
        if (pct === 100 || pct % 20 === 0) toast("正在推送插件", pct + "%");
      }
    });
    st = await textInput.status();
    if (!st.installed) throw new Error("插件安装后仍未检测到，请重试");
  }
  if (!st.enabled) await textInput.enable();
  await textInput.activate();
  await refreshImeStatus();
  if (textInput.active) {
    toast("中文输入已就绪", "手机已切到 ADB 输入法；不用时点「恢复手机输入法」");
  }
  return true;
}

/** 发送一段文字：ASCII 走 scrcpy 注键，非 ASCII 走 ADBKeyboard */
async function sendTextSmart(text, { interactive = false } = {}) {
  const body = String(text ?? "");
  if (!body || !ctrl) return false;
  if (!hasNonAscii(body)) {
    await ctrl.injectText(body);
    return true;
  }
  try {
    await ensureChineseInput({ interactive });
    await textInput.send(body);
    toast("已上屏", body.length > 20 ? body.slice(0, 20) + "…" : body);
    return true;
  } catch (e) {
    if (!interactive) {
      try {
        await ctrl.setClipboardAndPaste(body);
        toast("中文已尝试走剪贴板", "若没上屏，点「安装中文输入插件」可彻底解决");
        return true;
      } catch {
        /* ignore */
      }
    }
    toast("中文发送失败", String(e?.message || e));
    logLine("error", "chinese send fail " + String(e?.message || e));
    return false;
  }
}

on("btn-ime-setup", "click", async () => {
  try {
    await ensureChineseInput({ interactive: true });
  } catch (e) {
    toast("启用失败", String(e?.message || e));
    logLine("error", "ime setup fail " + String(e?.message || e));
  }
  refreshImeStatus();
});

on("btn-ime-restore", "click", async () => {
  try {
    await textInput?.restore();
    toast("已恢复手机输入法");
  } catch (e) {
    toast("恢复失败", String(e?.message || e));
  }
  refreshImeStatus();
});

/* 连接时自动启用的开关：保存在本机，关掉后只装插件、不切换输入法 */
(function bindImeAuto() {
  const box = $("ime-auto");
  if (!box) return;
  try {
    box.checked = localStorage.getItem(IME_AUTO_KEY) !== "0";
  } catch {
    /* ignore */
  }
  box.addEventListener("change", () => {
    try {
      localStorage.setItem(IME_AUTO_KEY, box.checked ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (box.checked) {
      toast("已开启", "下次连接会自动安装并启用中文输入");
    } else {
      toast("已关闭自动启用", "插件仍会安装，但不会切换手机输入法");
      textInput?.restore().then(refreshImeStatus).catch(() => {});
    }
  });
})();

/* 调试钩子：仅 ?debug 时暴露，供自动化测试直接走页面内 ADB 通道 */
if (location.search.includes("debug")) {
  window.__ime = {
    status: () => (textInput ? textInput.status() : Promise.resolve(null)),
    shell: (argv) => mirror.adb?.subprocess?.noneProtocol?.spawnWaitText(argv),
    activate: () => ensureChineseInput({ interactive: false }),
    restore: () => (textInput ? textInput.restore() : Promise.resolve("")),
  };
  window.__ctrl = () => ctrl;
}

/* ---------- 文本框:输入自动上屏(IME 组合结束后再发) ---------- */
(function bindLiveTextInput() {
  const input = $("clipboard-input");
  if (!input) return;

  let last = "";
  let timer = null;
  let composing = false;

  async function sendAdd(add) {
    if (!ctrl || !add) return;
    try {
      const ok = await sendTextSmart(add, { interactive: false });
      logLine(ok ? "ok" : "error", "auto input: " + add);
    } catch (e) {
      logLine("error", "auto input fail " + String(e?.message || e));
    }
  }

  async function syncValue() {
    const next = String(input.value ?? "");
    if (next === last) return;
    if (next.length > last.length && next.startsWith(last)) {
      await sendAdd(next.slice(last.length));
    } else if (next !== last) {
      await sendAdd(next);
    }
    last = next;
    input.value = "";
    last = "";
  }

  input.addEventListener("compositionstart", () => {
    composing = true;
    clearTimeout(timer);
    logLine("log", "IME composition start");
  });

  input.addEventListener("compositionend", () => {
    composing = false;
    clearTimeout(timer);
    timer = setTimeout(() => {
      syncValue();
    }, 50);
  });

  input.addEventListener("input", (e) => {
    if (composing || e.isComposing) return;
    clearTimeout(timer);
    timer = setTimeout(syncValue, 80);
  });

  input.addEventListener("keydown", async (e) => {
    if (composing || e.isComposing) return;
    if (!ctrl) return;
    if (e.key === "Backspace") {
      try {
        await ctrl.backspace();
        logLine("ok", "auto backspace");
      } catch (err) {
        logLine("error", "backspace " + String(err?.message || err));
      }
      return;
    }
    if (e.key === "Delete") {
      try {
        await ctrl.deleteKey();
        logLine("ok", "auto delete");
      } catch (err) {
        logLine("error", "delete " + String(err?.message || err));
      }
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      try {
        await ctrl.enter();
        logLine("ok", "auto enter");
      } catch (err) {
        logLine("error", "enter " + String(err?.message || err));
      }
    }
  });

  input.addEventListener("blur", () => {
    clearTimeout(timer);
    if (!composing) {
      last = String(input.value ?? "");
    }
  });
})();

on("btn-send-text", "click", async () => {
  const text = String($("clipboard-input")?.value ?? "");
  if (!text || !ctrl) return toast(text ? "请先连接设备" : "请先输入文本");
  try {
    const ok = await sendTextSmart(text, { interactive: true });
    if (ok) {
      logLine("ok", "send text len=" + text.length + (hasNonAscii(text) ? " non-ascii" : ""));
      const box = $("clipboard-input");
      if (box) box.value = "";
    }
  } catch (e) {
    logLine("error", "send text fail " + String(e?.message || e));
    toast("发送失败", String(e?.message || e));
  }
});

on("btn-copy-dev", "click", async () => {
  const text = String($("clipboard-input")?.value ?? "");
  if (!text || !ctrl) return toast(text ? "请先连接设备" : "请先输入文本");
  await ctrl.setClipboard(text);
  toast("已复制到设备剪贴板");
});
on("btn-paste-dev", "click", async () => {
  const text = String($("clipboard-input")?.value ?? "");
  if (!text || !ctrl) return toast(text ? "请先连接设备" : "请先输入文本");
  await ctrl.setClipboardAndPaste(text);
  toast("已发送并粘贴");
});

/* ---------- 剪贴板互通:电脑 ↔ 手机 ---------- */
function clipPreview(text) {
  const t = String(text ?? "");
  return t.length > 40 ? t.slice(0, 40) + "…" : t;
}

on("btn-pc2dev", "click", async () => {
  if (!ctrl) return toast("请先连接设备");
  try {
    const text = await navigator.clipboard.readText();
    if (!text) return toast("电脑剪贴板为空");
    await ctrl.setClipboardAndPaste(text);
    toast("电脑剪贴板已粘贴到手机", clipPreview(text));
    logLine("ok", "clipboard pc→dev len=" + text.length);
  } catch (e) {
    logLine("error", "pc→dev " + String(e?.message || e));
    toast(
      "读取电脑剪贴板失败",
      "浏览器未授权剪贴板读取,可先 Ctrl+C 复制、点网页一次后再试,或粘贴到输入框发送"
    );
  }
});

on("btn-dev2pc", "click", async () => {
  if (!ctrl) return toast("请先连接设备");
  try {
    const text = await ctrl.getDeviceClipboard();
    if (text == null) {
      toast("未读到手机剪贴板", "请先在手机上复制文本,再点此按钮");
      return;
    }
    await navigator.clipboard.writeText(text);
    const box = $("clipboard-input");
    if (box) box.value = text;
    toast("手机剪贴板已复制到电脑", clipPreview(text));
    logLine("ok", "clipboard dev→pc len=" + String(text).length);
  } catch (e) {
    logLine("error", "dev→pc " + String(e?.message || e));
    toast("读取手机剪贴板失败", String(e?.message || e));
  }
});

/* ---------- 全屏悬浮条文本框 ---------- */
(function bindFsInput() {
  const box = $("fs-input");
  if (!box) return;
  let last = "";
  let timer = null;
  let composing = false;

  async function sendAdd(add) {
    if (!ctrl || !add) return;
    try {
      const ok = await sendTextSmart(add, { interactive: false });
      logLine(ok ? "ok" : "error", "fs auto: " + add);
    } catch (e) {
      logLine("error", "fs auto fail " + String(e?.message || e));
    }
  }

  async function syncValue(clear) {
    const next = String(box.value ?? "");
    if (next === last) return;
    if (next.length > last.length && next.startsWith(last)) {
      await sendAdd(next.slice(last.length));
    } else if (next !== last) {
      await sendAdd(next);
    }
    last = clear ? "" : next;
    if (clear) box.value = "";
  }

  box.addEventListener("compositionstart", () => {
    composing = true;
    clearTimeout(timer);
  });
  box.addEventListener("compositionend", () => {
    composing = false;
    clearTimeout(timer);
    timer = setTimeout(() => syncValue(true), 50);
  });
  box.addEventListener("input", (e) => {
    if (composing || e.isComposing) return;
    clearTimeout(timer);
    timer = setTimeout(() => syncValue(true), 120);
  });

  const sendNow = async () => {
    const text = String(box.value ?? "");
    if (!text) return;
    if (!ctrl) {
      toast("请先连接设备");
      return;
    }
    try {
      const ok = await sendTextSmart(text, { interactive: true });
      if (!ok) return;
      box.value = "";
      last = "";
      logLine("ok", "fs send " + text.length);
    } catch (e) {
      logLine("error", "fs send " + String(e?.message || e));
      toast("发送失败", String(e?.message || e));
    }
  };

  box.addEventListener("keydown", async (e) => {
    if (composing || e.isComposing) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await sendNow();
      return;
    }
    if (!ctrl) return;
    if (e.key === "Backspace") {
      try {
        await ctrl.backspace();
      } catch {
        /* ignore */
      }
    }
  });
})();

window.addEventListener("resize", fitCanvas);
window.addEventListener("beforeunload", saveSettings);
// 关闭/刷新页面时释放手机端音频占用，避免手机一直没声音
window.addEventListener("pagehide", () => {
  try {
    textInput?.restore();
  } catch {
    /* ignore */
  }
  try {
    mirror.stop();
  } catch {
    /* ignore */
  }
});

(async () => {
  applySettings(loadSettings());
  bindSettingsSaver();
  try {
    const d = await new AdbMirror({ stage: $("stage") }).diagnose();
    logLine(
      "info",
      "环境 WebUSB=" +
        d.webusb +
        " secure=" +
        d.secure +
        " devices=" +
        d.authorizedDevices +
        " codecs=" +
        d.webcodecs
    );
  } catch {
    /* ignore */
  }
  decorateIcons();
  await refreshUsbDevices(true);
  logLine("info", "页面已就绪 · 设置已加载");
})();

/* ---------- 快捷键:H 全屏 · M 静音 · Shift+Esc 停止 ---------- */
window.addEventListener("keydown", (e) => {
  const tag = (e.target?.tagName || "").toLowerCase();
  const typing = tag === "input" || tag === "textarea" || e.target?.isContentEditable;
  if (e.key === "Escape" && e.shiftKey) {
    $("btn-stop")?.click();
    return;
  }
  if (typing) return;
  if (e.key === "h" || e.key === "H") {
    toggleFullscreen();
  } else if (e.key === "m" || e.key === "M") {
    $("btn-mute")?.click();
  }
});
