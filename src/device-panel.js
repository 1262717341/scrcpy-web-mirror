/**
 * 左侧边栏「应用管理 / 文件管理」面板
 * 依赖 device-tools，把 ADB 能力映射到 DOM。
 */
import {
  DeviceApps,
  DeviceFiles,
  DEFAULT_DIR,
  normalizePath,
  parentPath,
  joinPath,
  formatSize,
  formatTime,
  filterPackages,
} from "./device-tools.js";

const FILE_ICONS = {
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>',
  image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 17l-5-5-9 9"/>',
  video: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M11 9l5 3-5 3z"/>',
  audio: '<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="16" r="2"/>',
  apk: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>',
  archive: '<path d="M4 6h16v14H4z"/><path d="M4 6l2-2h12l2 2"/><path d="M12 9v6M9 12h6"/>',
  text: '<path d="M6 3h9l3 3v15H6z"/><path d="M9 11h6M9 15h6"/>',
  file: '<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v3h3"/>',
};

function iconOf(kind) {
  return (
    '<svg viewBox="0 0 24 24">' + (FILE_ICONS[kind] || FILE_ICONS.file) + "</svg>"
  );
}

function safeFilename(name) {
  return String(name || "download").replace(/[\\/:*?"<>|]/g, "_");
}

export function bindDevicePanels({ getMirror, toast, log }) {
  const $ = (id) => document.getElementById(id);

  let apps = null;
  let appsAdb = null;
  let appsCache = [];
  let appsBusy = false;

  let appMeta = new Map(); // pkg -> { name, iconUrl, state }
  const appQueue = [];
  let appActive = 0;
  let appScrollBody = null;
  let appSelectMode = false;
  let appScope = "all";
  const appSelected = new Set();

  let files = null;
  let filesAdb = null;
  let filesEntries = [];
  let filesPath = DEFAULT_DIR;
  let filesBusy = false;
  let fileSelectMode = false;
  let fileClipboard = []; // { path, name, dir }
  const fileSelected = new Set();

  const appsList = () => $("app-list");
  const filesList = () => $("file-list");

  function appsApi() {
    const adb = getMirror()?.adb;
    if (!adb) throw new Error("请先连接设备");
    if (!apps || appsAdb !== adb) {
      apps = new DeviceApps(adb);
      appsAdb = adb;
      appMeta = new Map();
      appQueue.length = 0;
    }
    return apps;
  }

  function filesApi() {
    const adb = getMirror()?.adb;
    if (!adb) throw new Error("请先连接设备");
    if (!files || filesAdb !== adb) {
      files = new DeviceFiles(adb);
      filesAdb = adb;
    }
    return files;
  }

  function setAppsStatus(text) {
    const el = $("apps-status");
    if (el) el.textContent = text;
  }
  function setFilesStatus(text) {
    const el = $("files-status");
    if (el) el.textContent = text;
  }

  /* ---------------- 应用 ---------------- */

  function appSerial() {
    const serial = getMirror()?.device?.serial;
    if (serial) return String(serial);
    // 无线模式不写 mirror.device，从状态栏读取（页面里显示为“设备:192.168.31.8:5555”）
    const status = document.getElementById("stat-serial")?.textContent || "";
    return status.replace(/^设备\s*[:：]\s*/, "").trim();
  }

  function iconUrlOf(pkg, version) {
    return (
      "/api/app-icon?serial=" +
      encodeURIComponent(appSerial()) +
      "&pkg=" +
      encodeURIComponent(pkg) +
      "&v=" +
      encodeURIComponent(String(version || ""))
    );
  }

  function applyAppMeta(pkg) {
    const meta = appMeta.get(pkg);
    if (!meta) return;
    if (meta.name) {
      const item = appsCache.find((a) => a.pkg === pkg);
      if (item) item.label = meta.name;
    }
    document.querySelectorAll(".dev-row[data-pkg]").forEach((row) => {
      if (row.dataset.pkg !== pkg) return;
      const name = row.querySelector(".dev-name");
      if (name && meta.name) {
        name.textContent = meta.name;
        name.classList.remove("mono");
        name.classList.add("app-name");
      }
      const metaEl = row.querySelector(".dev-meta");
      if (metaEl && meta.name) {
        metaEl.textContent = pkg + (row.dataset.system === "1" ? " · 系统应用" : "");
        metaEl.classList.add("mono");
      }
      const avatar = row.querySelector(".dev-avatar");
      if (avatar && meta.iconUrl && !avatar.dataset.loaded) {
        avatar.dataset.loaded = "1";
        const img = document.createElement("img");
        img.alt = "";
        img.loading = "lazy";
        img.src = meta.iconUrl;
        img.addEventListener("error", () => {
          avatar.removeAttribute("data-loaded");
          img.remove();
        });
        avatar.replaceChildren(img);
      }
    });
  }

  async function fetchAppMeta(pkg) {
    const state = appMeta.get(pkg);
    if (state && (state.state === "loading" || state.state === "done")) return;
    appMeta.set(pkg, { name: "", iconUrl: "", state: "loading" });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(
        "/api/app-meta?serial=" + encodeURIComponent(appSerial()) + "&pkg=" + encodeURIComponent(pkg),
        { signal: controller.signal }
      );
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "读取应用信息失败");
      const meta = {
        name: data.name || pkg,
        iconUrl: data.icon ? iconUrlOf(pkg, data.iconVersion) : "",
        state: "done",
      };
      appMeta.set(pkg, meta);
      applyAppMeta(pkg);
    } catch {
      appMeta.set(pkg, { name: "", iconUrl: "", state: "failed" });
      document.querySelectorAll(".dev-row[data-pkg]").forEach((row) => {
        if (row.dataset.pkg !== pkg) return;
        const metaEl = row.querySelector(".dev-meta");
        if (metaEl && metaEl.textContent === "读取应用信息…") metaEl.textContent = pkg;
      });
    } finally {
      clearTimeout(timer);
    }
  }

  function pumpAppQueue() {
    while (appActive < 5 && appQueue.length) {
      const pkg = appQueue.shift();
      appActive += 1;
      fetchAppMeta(pkg).finally(() => {
        appActive -= 1;
        pumpAppQueue();
      });
    }
  }

  function enqueueAppMeta(pkg) {
    if (appMeta.has(pkg)) return;
    if (appQueue.includes(pkg)) return;
    appQueue.push(pkg);
    pumpAppQueue();
  }

  function loadVisibleAppRows() {
    const list = appsList();
    if (!list) return;
    const body = list.closest(".drawer-body") || list;
    const box = body.getBoundingClientRect();
    list.querySelectorAll(".dev-row[data-pkg]").forEach((row) => {
      const r = row.getBoundingClientRect();
      if (r.bottom > box.top - 200 && r.top < box.bottom + 200) enqueueAppMeta(row.dataset.pkg);
    });
  }

  function observeAppRows() {
    const list = appsList();
    if (!list) return;
    const body = list.closest(".drawer-body") || list;
    if (appScrollBody !== body) {
      if (appScrollBody) appScrollBody.removeEventListener("scroll", loadVisibleAppRows);
      appScrollBody = body;
      body.addEventListener("scroll", loadVisibleAppRows, { passive: true });
    }
    loadVisibleAppRows();
  }

  function renderApps() {
    const list = appsList();
    if (!list) return;
    const kw = $("app-search")?.value || "";
    const items = filterPackages(appsCache, { keyword: kw, scope: appScope });
    list.replaceChildren();
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "list-status";
      empty.textContent = appsCache.length ? "没有匹配的应用" : "暂无应用，点右上角「刷新」";
      list.appendChild(empty);
      return;
    }
    const frag = document.createDocumentFragment();
    for (const item of items) {
      const row = document.createElement("div");
      row.className = "dev-row";
      row.dataset.pkg = item.pkg;
      row.dataset.system = item.system ? "1" : "0";
      row.classList.toggle("is-picked", appSelected.has(item.pkg));

      if (appSelectMode) {
        const pick = document.createElement("span");
        pick.className = "dev-pick";
        pick.textContent = appSelected.has(item.pkg) ? "✓" : "";
        row.appendChild(pick);
      }

      const avatar = document.createElement("span");
      avatar.className = "dev-avatar app-avatar";
      const letter = document.createElement("span");
      letter.textContent = (item.pkg.split(".").pop() || "?").slice(0, 1);
      avatar.appendChild(letter);
      row.appendChild(avatar);

      const main = document.createElement("div");
      main.className = "dev-main";
      const name = document.createElement("span");
      name.className = "dev-name mono";
      name.textContent = item.pkg;
      name.title = "点击查看版本信息";
      name.dataset.appDetail = item.pkg;
      const meta = document.createElement("span");
      meta.className = "dev-meta";
      meta.textContent = item.label ? item.pkg : "读取应用信息…";
      main.append(name, meta);
      row.appendChild(main);

      const actions = document.createElement("div");
      actions.className = "dev-actions";
      const addBtn = (act, label, danger) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "mini-btn" + (danger ? " danger" : "");
        b.dataset.appAct = act;
        b.dataset.pkg = item.pkg;
        b.textContent = label;
        actions.appendChild(b);
      };
      addBtn("start", "启动");
      addBtn("stop", "停止");
      // v4.2.2：系统应用不显示卸载入口，避免用户误以为可以直接卸载系统应用。
      if (!item.system) addBtn("uninstall", "卸载", true);
      row.appendChild(actions);
      frag.appendChild(row);
    }
    list.appendChild(frag);
    appMeta.forEach((meta, pkg) => {
      if (meta.state === "done") applyAppMeta(pkg);
    });
    observeAppRows();
  }

  function updateBatchBar() {
    const bar = $("app-batch");
    if (!bar) return;
    bar.hidden = false;
    const count = $("app-batch-count");
    if (count) count.textContent = "已选 " + appSelected.size + " 项";
    const canAct = appSelected.size > 0 && !appsBusy;
    const hasSystem = [...appSelected].some((pkg) => appsCache.find((a) => a.pkg === pkg)?.system);
    document.querySelectorAll("#app-batch .batch-btn").forEach((btn) => {
      if (btn.dataset.batchAct === "done") return;
      if (btn.dataset.batchAct === "uninstall") {
        btn.disabled = !canAct || hasSystem;
        btn.title = hasSystem ? "系统应用不可卸载" : "";
        return;
      }
      btn.disabled = !canAct;
    });
    const selectAllBtn = $("btn-app-select-all");
    if (selectAllBtn) {
      selectAllBtn.disabled = !appSelectMode || !document.querySelectorAll("#app-list .dev-row").length;
      selectAllBtn.textContent = appSelected.size >= document.querySelectorAll("#app-list .dev-row").length && appSelected.size ? "全不选" : "全选";
    }
  }

  function toggleAppPick(pkg, row) {
    if (appSelected.has(pkg)) appSelected.delete(pkg);
    else appSelected.add(pkg);
    const picked = appSelected.has(pkg);
    row?.classList.toggle("is-picked", picked);
    const pick = row?.querySelector(".dev-pick");
    if (pick) pick.textContent = picked ? "✓" : "";
    updateBatchBar();
  }

  /**
   * v4.0.23：普通模式单击应用行只选中这一个应用，顶部批处理按钮随即可用。
   * 以前必须先进“多选”才能选中，用户会以为“选了一个应用却用不了顶部功能”。
   */
  function selectSingleApp(pkg, row) {
    appSelected.clear();
    appSelected.add(pkg);
    document.querySelectorAll("#app-list .dev-row[data-pkg]").forEach((r) => {
      const on = r === row || r.dataset.pkg === pkg;
      r.classList.toggle("is-picked", on);
      const pick = r.querySelector(".dev-pick");
      if (pick) pick.textContent = on ? "✓" : "";
    });
    updateBatchBar();
  }

  function setAppSelectMode(on) {
    appSelectMode = !!on;
    if (!appSelectMode) appSelected.clear();
    const panel = $("app-list")?.closest(".drawer");
    panel?.classList.toggle("is-selecting", appSelectMode);
    const btn = $("btn-app-select");
    if (btn) {
      btn.textContent = appSelectMode ? "取消" : "多选";
      btn.classList.toggle("primary", appSelectMode);
      btn.classList.toggle("xs-btn", appSelectMode);
      btn.classList.toggle("ghost", !appSelectMode);
    }
    updateBatchBar();
    renderApps();
  }

  function selectAllApps(forceOff) {
    const rows = [...document.querySelectorAll("#app-list .dev-row[data-pkg]")];
    const allOn = rows.length > 0 && rows.every((row) => appSelected.has(row.dataset.pkg));
    const next = forceOff || allOn ? false : true;
    rows.forEach((row) => {
      const pkg = row.dataset.pkg;
      if (next) appSelected.add(pkg);
      else appSelected.delete(pkg);
      row.classList.toggle("is-picked", next);
      const pick = row.querySelector(".dev-pick");
      if (pick) pick.textContent = next ? "✓" : "";
    });
    updateBatchBar();
  }

  async function runAppBatch(action) {
    if (action === "done") {
      setAppSelectMode(false);
      return;
    }
    if (!appSelected.size) return;
    if (appsBusy) return toast("还有操作正在进行", "请稍后再试");
    const pkgs = [...appSelected];
    if (action === "uninstall" && pkgs.some((pkg) => appsCache.find((a) => a.pkg === pkg)?.system)) {
      return toast("系统应用不可卸载", "请先取消勾选系统应用，再批量卸载第三方应用", { duration: 8000 });
    }
    const labelOf = {
      stop: "强行停止",
      disable: "停用",
      enable: "启用",
      clear: "清除数据",
      uninstall: "卸载",
    };
    const label = labelOf[action] || action;
    if (action === "clear" || action === "uninstall") {
      const someSystem = pkgs.some((pkg) => appsCache.find((a) => a.pkg === pkg)?.system);
      const extra = someSystem ? "\n选中项含系统应用，可能导致系统功能异常。" : "";
      const tail = action === "clear" ? "应用数据会全部删除。" : "应用及其数据会被删除。";
      if (!window.confirm("批量" + label + " " + pkgs.length + " 个应用？\n" + tail + extra)) return;
    }
    appsBusy = true;
    updateBatchBar();
    const ok = [];
    const failed = [];
    try {
      const api = appsApi();
      for (let i = 0; i < pkgs.length; i++) {
        const pkg = pkgs[i];
        setAppsStatus("批量" + label + " " + (i + 1) + "/" + pkgs.length + "…");
        try {
          if (action === "stop") await api.forceStop(pkg);
          else if (action === "disable") await api.setEnabled(pkg, false);
          else if (action === "enable") await api.setEnabled(pkg, true);
          else if (action === "clear") await api.clearData(pkg);
          else if (action === "uninstall") await api.uninstall(pkg);
          else throw new Error("未知操作");
          ok.push(pkg);
          if (action === "uninstall") appsCache = appsCache.filter((a) => a.pkg !== pkg);
        } catch (e) {
          failed.push({ pkg, error: String(e?.message || e) });
        }
      }
    } finally {
      appsBusy = false;
      appSelected.clear();
      renderApps();
      updateBatchBar();
      const third = appsCache.filter((a) => !a.system).length;
      setAppsStatus("共 " + appsCache.length + " 个应用（第三方 " + third + " 个）");
    }
    toast(
      label + "完成",
      "成功 " + ok.length + " 个" + (failed.length ? "，失败 " + failed.length + " 个" : ""),
      failed.length ? { duration: 9000 } : undefined
    );
    log("ok", "批量" + label + " 成功 " + ok.length + " 个");
    failed.forEach((f) => log("error", "批量" + label + " 失败 " + f.pkg + "：" + f.error));
    if (failed.length) setAppsStatus("批量" + label + "：" + failed.length + " 个失败，详情见日志");
  }

  async function refreshApps() {
    if (appsBusy) return;
    appsBusy = true;
    setAppsStatus("正在读取应用列表…");
    const refreshBtn = $("btn-app-refresh");
    if (refreshBtn) refreshBtn.disabled = true;
    try {
      const api = appsApi();
      appsCache = await api.list({ includeSystem: true });
      for (const [pkg, meta] of appMeta) if (meta.state === "error" || meta.state === "failed") appMeta.delete(pkg);
      const third = appsCache.filter((a) => !a.system).length;
      setAppsStatus("共 " + appsCache.length + " 个应用（第三方 " + third + " 个）");
      renderApps();
      log("info", "应用列表 " + appsCache.length + " 项");
    } catch (e) {
      appsCache = [];
      renderApps();
      setAppsStatus(String(e?.message || e));
      toast("读取应用失败", String(e?.message || e));
      log("error", "读取应用失败 " + String(e?.message || e));
    } finally {
      appsBusy = false;
      if (refreshBtn) refreshBtn.disabled = false;
    }
  }

  async function runAppAction(action, pkg, button) {
    if (appsBusy) return;
    if (action === "uninstall") {
      const item = appsCache.find((a) => a.pkg === pkg);
      if (item?.system) return toast("系统应用不可卸载", pkg + " 属于系统应用，不提供卸载操作");
      const danger = "";
      if (!window.confirm("卸载 " + pkg + " ？应用数据会一起删除。" + danger)) return;
    }
    appsBusy = true;
    if (button) button.disabled = true;
    try {
      const api = appsApi();
      if (action === "start") {
        await api.start(pkg);
        toast("已启动", pkg);
      } else if (action === "stop") {
        await api.forceStop(pkg);
        toast("已强制停止", pkg);
      } else if (action === "uninstall") {
        await api.uninstall(pkg);
        appsCache = appsCache.filter((a) => a.pkg !== pkg);
        renderApps();
        toast("已卸载", pkg);
      }
      log("ok", "应用 " + action + " " + pkg);
    } catch (e) {
      toast("操作失败", String(e?.message || e));
      log("error", "应用 " + action + " 失败 " + String(e?.message || e));
    } finally {
      appsBusy = false;
      if (button) button.disabled = false;
    }
  }

  async function showAppDetail(pkg) {
    try {
      const lines = await appsApi().detail(pkg);
      toast(pkg, lines.length ? lines.join("\n") : "未读到版本信息", { duration: 10000 });
    } catch (e) {
      toast("读取详情失败", String(e?.message || e));
    }
  }

  // 无锁内核：调用方若已持有其它操作锁（如 uploadFiles 的 filesBusy），直接调用本函数，
  // 避免两把独立锁互相踩踏导致"提示成功却没装"。
  async function doInstallApk(file) {
    if (!file) return false;
    setAppsStatus("正在推送到手机…");
    let installed = false;
    try {
      const api = appsApi();
      log("info", "开始安装 " + file.name + " (" + formatSize(file.size) + ")");
      await api.install(file, (p) => {
        if (p.phase === "push") {
          const pct = p.total ? Math.round((p.sent / p.total) * 100) : 0;
          setAppsStatus("正在推送到手机… " + pct + "%");
        } else {
          setAppsStatus("正在安装，大包可能需要几十秒…");
        }
      });
      installed = true;
      toast("安装成功", file.name);
      log("ok", "安装成功 " + file.name);
    } catch (e) {
      setAppsStatus("安装失败：" + String(e?.message || e));
      toast("安装失败", String(e?.message || e));
      log("error", "安装失败 " + String(e?.message || e));
    }
    if (installed) await refreshApps();
    return installed;
  }

  async function installApk(file) {
    if (!file) return false;
    if (appsBusy) return toast("还有操作正在进行", "请稍后再试"), false;
    appsBusy = true;
    const btn = $("btn-app-install");
    if (btn) btn.disabled = true;
    try {
      return await doInstallApk(file);
    } finally {
      appsBusy = false;
      if (btn) btn.disabled = false;
    }
  }

  /* ---------------- 文件 ---------------- */

  function renderFiles() {
    const list = filesList();
    if (!list) return;
    list.replaceChildren();
    if (!filesEntries.length) {
      const empty = document.createElement("p");
      empty.className = "list-status";
      empty.textContent = "这个目录是空的";
      list.appendChild(empty);
      return;
    }
    const frag = document.createDocumentFragment();
    for (const entry of filesEntries) {
      const row = document.createElement("div");
      row.className = "dev-row" + (entry.dir ? " is-dir" : "");
      row.dataset.name = entry.name;
      row.dataset.path = entry.path;
      row.classList.toggle("is-picked", fileSelected.has(entry.path));

      if (fileSelectMode) {
        const pick = document.createElement("span");
        pick.className = "dev-pick";
        pick.textContent = fileSelected.has(entry.path) ? "✓" : "";
        row.appendChild(pick);
      }

      const avatar = document.createElement("span");
      avatar.className = "dev-avatar";
      avatar.innerHTML = iconOf(entry.dir ? "folder" : entry.kind);
      row.appendChild(avatar);

      const main = document.createElement("div");
      main.className = "dev-main";
      const name = document.createElement("span");
      name.className = "dev-name";
      name.textContent = entry.name + (entry.link ? " ↗" : "");
      name.title = entry.path;
      const meta = document.createElement("span");
      meta.className = "dev-meta";
      meta.textContent = entry.dir ? "文件夹" : formatSize(entry.size) + (entry.mtime ? " · " + formatTime(entry.mtime) : "");
      main.append(name, meta);
      row.appendChild(main);

      const actions = document.createElement("div");
      actions.className = "dev-actions";
      if (!entry.dir && entry.kind === "apk") {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "mini-btn";
        b.dataset.fileAct = "install";
        b.textContent = "安装";
        actions.appendChild(b);
      }
      if (!entry.dir) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "mini-btn";
        b.dataset.fileAct = "download";
        b.textContent = "下载";
        actions.appendChild(b);
      }
      const rename = document.createElement("button");
      rename.type = "button";
      rename.className = "mini-btn";
      rename.dataset.fileAct = "rename";
      rename.textContent = "改名";
      actions.appendChild(rename);
      const del = document.createElement("button");
      del.type = "button";
      del.className = "mini-btn danger";
      del.dataset.fileAct = "delete";
      del.textContent = "删除";
      actions.appendChild(del);
      row.appendChild(actions);
      frag.appendChild(row);
    }
    list.appendChild(frag);
  }

  function fileKindLabel(entry) {
    if (entry.dir) return "文件夹";
    if (entry.link) return "符号链接";
    if (entry.kind === "apk") return "APK 安装包";
    const m = /\.([a-z0-9]{1,8})$/i.exec(entry.name || "");
    return m ? m[1].toUpperCase() + " 文件" : "文件";
  }

  function fileMtimeText(entry) {
    if (!entry.mtime) return "未知";
    const d = new Date(Number(entry.mtime) * 1000);
    if (Number.isNaN(d.getTime())) return "未知";
    return d.toLocaleString("zh-CN", { hour12: false });
  }

  function showFileDetail(entry) {
    const name = entry.name + (entry.link ? " ↗" : "");
    const size = entry.dir
      ? "—（文件夹）"
      : formatSize(entry.size) + "（" + Number(entry.size || 0).toLocaleString("zh-CN") + " 字节）";
    const lines = [
      "名称：" + name,
      "类型：" + fileKindLabel(entry),
      "大小：" + size,
      "修改时间：" + fileMtimeText(entry),
      "路径：" + entry.path,
    ];
    toast("文件详情", lines.join("\n"), { duration: 12000 });
  }

  function updateFileBatchBar() {
    const bar = $("file-batch");
    if (!bar) return;
    bar.hidden = false;
    const count = $("file-batch-count");
    if (count) count.textContent = "已选 " + fileSelected.size + " 项";
    const selected = [...fileSelected];
    const one = selected.length === 1;
    const has = selected.length > 0 && !filesBusy;
    document.querySelectorAll("#file-batch .batch-btn").forEach((btn) => {
      const act = btn.dataset.fileBatchAct;
      if (act === "cancel") {
        btn.disabled = false;
        return;
      }
      if (act === "all") return;
      if (act === "detail") btn.disabled = !one || filesBusy;
      else if (act === "paste") btn.disabled = !fileClipboard.length || filesBusy;
      else btn.disabled = !has;
      if (act === "paste") btn.textContent = fileClipboard.length ? "粘贴 " + fileClipboard.length : "粘贴";
    });
    const selectAll = $("btn-file-select-all");
    if (selectAll) {
      selectAll.disabled = !fileSelectMode || !filesEntries.length;
      selectAll.textContent = fileSelected.size >= filesEntries.length && fileSelected.size ? "全不选" : "全选";
    }
  }

  function setFileSelectMode(on) {
    fileSelectMode = !!on;
    if (!fileSelectMode) fileSelected.clear();
    const panel = $("file-list")?.closest(".drawer");
    panel?.classList.toggle("is-selecting", fileSelectMode);
    const btn = $("btn-file-select");
    if (btn) {
      btn.textContent = fileSelectMode ? "取消" : "多选";
      btn.classList.toggle("primary", fileSelectMode);
      btn.classList.toggle("ghost", !fileSelectMode);
    }
    updateFileBatchBar();
    renderFiles();
  }

  function toggleFilePick(path, row) {
    if (fileSelected.has(path)) fileSelected.delete(path);
    else fileSelected.add(path);
    const picked = fileSelected.has(path);
    row?.classList.toggle("is-picked", picked);
    const pick = row?.querySelector(".dev-pick");
    if (pick) pick.textContent = picked ? "✓" : "";
    updateFileBatchBar();
  }

  function selectSingleFile(entry, row) {
    fileSelected.clear();
    fileSelected.add(entry.path);
    document.querySelectorAll("#file-list .dev-row[data-path]").forEach((r) => {
      const on = r === row || r.dataset.path === entry.path;
      r.classList.toggle("is-picked", on);
      const pick = r.querySelector(".dev-pick");
      if (pick) pick.textContent = on ? "✓" : "";
    });
    updateFileBatchBar();
  }

  function selectAllFiles(forceOff = false) {
    const allOn = filesEntries.length > 0 && filesEntries.every((e) => fileSelected.has(e.path));
    const next = forceOff || allOn ? false : true;
    filesEntries.forEach((e) => {
      if (next) fileSelected.add(e.path);
      else fileSelected.delete(e.path);
    });
    document.querySelectorAll("#file-list .dev-row[data-path]").forEach((r) => {
      r.classList.toggle("is-picked", next);
      const pick = r.querySelector(".dev-pick");
      if (pick) pick.textContent = next ? "✓" : "";
    });
    updateFileBatchBar();
  }

  function uniqueCopyName(name, isDir, used) {
    if (!used.has(String(name).toLowerCase())) return name;
    const m = isDir ? null : /^(.*?)(\.[^.]+)?$/.exec(name);
    const base = m ? m[1] : name;
    const ext = m && m[2] ? m[2] : "";
    let i = 1;
    let candidate = name;
    do {
      candidate = base + (i === 1 ? " - 副本" : " - 副本 (" + i + ")") + ext;
      i += 1;
    } while (used.has(candidate.toLowerCase()));
    return candidate;
  }

  async function copySelectedFiles() {
    if (!fileSelected.size || filesBusy) return;
    const entries = filesEntries.filter((e) => fileSelected.has(e.path));
    fileClipboard = entries.map((e) => ({ path: e.path, name: e.name, dir: !!e.dir }));
    // 复制完自动结束本次选择：清空勾选/高亮并退出多选，剪贴板仍保留，方便直接切目录粘贴。
    setFileSelectMode(false);
    toast("已复制到剪贴板", fileClipboard.map((e) => e.name).join("、") + "\n已结束本次多选，切换到目标文件夹后点「粘贴」", {
      duration: 9000,
    });
    log("info", "文件剪贴板 " + fileClipboard.length + " 项");
  }

  /**
   * v4.2.2：批量条尾部由「完成」改为「取消」。
   * 复制后多选已经自动结束，这里再做一次收尾：清空文件剪贴板、退出多选，避免复制内容一直挂着。
   */
  function cancelFileCopy() {
    const had = fileClipboard.length;
    fileClipboard = [];
    setFileSelectMode(false);
    if (had) {
      toast("已取消复制", "剪贴板已清空，共移除 " + had + " 项");
      log("info", "取消文件复制，清空 " + had + " 项");
    }
  }

  async function pasteClipboard() {
    if (!fileClipboard.length || filesBusy) return;
    const targetDir = filesPath;
    filesBusy = true;
    updateFileBatchBar();
    const ok = [];
    const failed = [];
    const used = new Set(filesEntries.map((e) => String(e.name).toLowerCase()));
    try {
      const api = filesApi();
      for (const item of fileClipboard) {
        const src = item.path;
        if (item.dir && (targetDir === src || targetDir.replace(/\/+$/, "").startsWith(src.replace(/\/+$/, "") + "/"))) {
          failed.push(item.name + "（不能粘贴到自身子目录）");
          continue;
        }
        const next = uniqueCopyName(item.name, item.dir, used);
        const dst = joinPath(targetDir, next);
        setFilesStatus("正在粘贴 " + item.name + " → " + next + " …");
        try {
          await api.copy(src, dst);
          used.add(next.toLowerCase());
          ok.push(next);
        } catch (e) {
          failed.push(item.name + "（" + String(e?.message || e).slice(0, 80) + "）");
        }
      }
      await loadDir(targetDir, { silent: true, force: true });
      if (ok.length) {
        toast("粘贴完成", ok.join("、"), { duration: 7000 });
        log("ok", "粘贴 " + ok.length + " 项到 " + targetDir);
      }
      if (failed.length) {
        toast("部分粘贴失败", failed.join("\n"), { duration: 12000 });
        log("error", "粘贴失败 " + failed.join(" | "));
      }
    } catch (e) {
      toast("粘贴失败", String(e?.message || e));
      log("error", "粘贴失败 " + String(e?.message || e));
    } finally {
      filesBusy = false;
      updateFileBatchBar();
    }
  }

  async function deleteSelectedFiles() {
    if (!fileSelected.size || filesBusy) return;
    const entries = filesEntries.filter((e) => fileSelected.has(e.path));
    if (!entries.length) return;
    const dirs = entries.filter((e) => e.dir).length;
    if (
      !window.confirm(
        "删除选中的 " +
          entries.length +
          " 项？" +
          (dirs ? "\n其中 " + dirs + " 个文件夹会连同内部内容一起删除。" : "") +
          "\n此操作不可恢复。"
      )
    )
      return;
    filesBusy = true;
    updateFileBatchBar();
    const ok = [];
    const failed = [];
    try {
      const api = filesApi();
      for (const entry of entries) {
        setFilesStatus("正在删除 " + entry.name + " …");
        try {
          await api.remove(entry.path, true);
          ok.push(entry.name);
        } catch (e) {
          failed.push(entry.name + "（" + String(e?.message || e).slice(0, 80) + "）");
        }
      }
      fileSelected.clear();
      await loadDir(filesPath, { silent: true, force: true });
      if (failed.length) {
        toast("部分删除失败", failed.join("\n"), { duration: 12000 });
        log("error", "批量删除失败 " + failed.join(" | "));
      } else {
        toast("已删除 " + ok.length + " 项", ok.join("、"), { duration: 7000 });
        log("ok", "批量删除 " + ok.join("、"));
      }
    } finally {
      filesBusy = false;
      updateFileBatchBar();
    }
  }

  async function runFileBatch(action) {
    if (action === "all") {
      selectAllFiles(false);
      return;
    }
    if (action === "cancel") {
      cancelFileCopy();
      return;
    }
    if (action === "detail") {
      const entry = filesEntries.find((e) => e.path === [...fileSelected][0]);
      if (entry) showFileDetail(entry);
      return;
    }
    if (action === "copy") return copySelectedFiles();
    if (action === "paste") return pasteClipboard();
    if (action === "delete") return deleteSelectedFiles();
  }

  function syncQuickChips() {
    document.querySelectorAll("#file-quick button").forEach((b) => {
      b.classList.toggle("active", normalizePath(b.dataset.path) === filesPath);
    });
  }

  async function loadDir(input, { silent = false, force = false } = {}) {
    if (filesBusy && !force) return;
    const target = normalizePath(input || filesPath || DEFAULT_DIR);
    // 切换目录时清掉旧选择，剪贴板跨目录保留（复制完可以「完成」再进目标目录粘贴）。
    if (fileSelectMode) setFileSelectMode(false);
    else fileSelected.clear();
    const prevBusy = filesBusy;
    filesBusy = true;
    setFilesStatus("正在读取 " + target + " …");
    try {
      const api = filesApi();
      const result = await api.list(target);
      filesPath = result.path;
      filesEntries = result.entries;
      const box = $("file-path");
      if (box) box.value = filesPath;
      renderFiles();
      updateFileBatchBar();
      syncQuickChips();
      setFilesStatus(filesEntries.length ? filesPath + " · " + filesEntries.length + " 项" : filesPath + " · 空目录");
      if (!silent) log("info", "文件目录 " + filesPath + " (" + filesEntries.length + " 项)");
    } catch (e) {
      setFilesStatus("读取失败：" + String(e?.message || e));
      if (!silent) toast("打开目录失败", String(e?.message || e));
      log("error", "读取目录失败 " + String(e?.message || e));
    } finally {
      filesBusy = prevBusy;
      updateFileBatchBar();
    }
  }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = safeFilename(name);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
  }

  async function downloadFile(entry) {
    if (filesBusy) return;
    filesBusy = true;
    setFilesStatus("正在下载 " + entry.name + " …");
    try {
      const api = filesApi();
      const blob = await api.readBlob(entry.path, (n) => {
        if (entry.size) {
          setFilesStatus("正在下载 " + entry.name + " … " + Math.round((n / entry.size) * 100) + "%");
        }
      });
      downloadBlob(blob, entry.name);
      toast("已下载到电脑", entry.name + " · " + formatSize(blob.size));
      log("ok", "下载 " + entry.path + " (" + formatSize(blob.size) + ")");
      setFilesStatus(filesPath + " · " + filesEntries.length + " 项");
    } catch (e) {
      setFilesStatus("下载失败：" + String(e?.message || e));
      toast("下载失败", String(e?.message || e));
      log("error", "下载失败 " + String(e?.message || e));
    } finally {
      filesBusy = false;
    }
  }

  async function uploadFiles(fileList) {
    const items = Array.from(fileList || []);
    if (!items.length || filesBusy) return;
    filesBusy = true;
    try {
      const api = filesApi();
      for (const file of items) {
        if (/\.apk$/i.test(file.name)) {
          setFilesStatus("检测到 APK，转去安装：" + file.name);
          const ok = await doInstallApk(file);
          if (!ok) throw new Error("APK 安装失败：" + file.name);
          continue;
        }
        const target = joinPath(filesPath, file.name);
        setFilesStatus("正在上传 " + file.name + " …");
        await api.writeBlob(target, file, (sent, total) => {
          const pct = total ? Math.round((sent / total) * 100) : 0;
          setFilesStatus("正在上传 " + file.name + " … " + pct + "%");
        });
        await api.mediaScan(target);
        log("ok", "上传 " + target + " (" + formatSize(file.size) + ")");
      }
      toast("上传完成", items.map((f) => f.name).join("、"));
      await loadDir(filesPath, { silent: true, force: true });
    } catch (e) {
      setFilesStatus("上传失败：" + String(e?.message || e));
      toast("上传失败", String(e?.message || e));
      log("error", "上传失败 " + String(e?.message || e));
    } finally {
      filesBusy = false;
    }
  }

  async function removeEntry(entry) {
    if (filesBusy) return;
    if (!window.confirm("删除" + (entry.dir ? "文件夹" : "文件") + " " + entry.name + " ？此操作不可恢复。")) return;
    filesBusy = true;
    try {
      await filesApi().remove(entry.path, true);
      toast("已删除", entry.name);
      log("ok", "删除 " + entry.path);
      await loadDir(filesPath, { silent: true, force: true });
    } catch (e) {
      toast("删除失败", String(e?.message || e));
      log("error", "删除失败 " + String(e?.message || e));
    } finally {
      filesBusy = false;
    }
  }

  async function renameEntry(entry) {
    if (filesBusy) return;
    const next = window.prompt("重命名为（只填名称）", entry.name);
    if (!next || next === entry.name) return;
    if (next.includes("/")) return toast("名称不能包含 /");
    filesBusy = true;
    try {
      await filesApi().rename(entry.path, joinPath(filesPath, next));
      toast("已重命名", next);
      log("ok", "重命名 " + entry.path + " → " + next);
      await loadDir(filesPath, { silent: true, force: true });
    } catch (e) {
      toast("重命名失败", String(e?.message || e));
      log("error", "重命名失败 " + String(e?.message || e));
    } finally {
      filesBusy = false;
    }
  }

  async function installFromDevice(entry) {
    if (filesBusy) return;
    if (!window.confirm("在手机上安装 " + entry.name + " ？")) return;
    filesBusy = true;
    setFilesStatus("正在安装 " + entry.name + " …");
    try {
      await appsApi().installRemote(entry.path);
      toast("安装成功", entry.name);
      log("ok", "安装设备内 APK " + entry.path);
      setFilesStatus(filesPath + " · " + filesEntries.length + " 项");
    } catch (e) {
      toast("安装失败", String(e?.message || e));
      setFilesStatus("安装失败：" + String(e?.message || e));
      log("error", "安装设备内 APK 失败 " + String(e?.message || e));
    } finally {
      filesBusy = false;
    }
  }

  async function mkdirHere() {
    if (filesBusy) return;
    const name = window.prompt("新建文件夹名称", "新建文件夹");
    if (!name) return;
    if (name.includes("/")) return toast("名称不能包含 /");
    try {
      await filesApi().mkdir(joinPath(filesPath, name));
      toast("已创建", name);
      await loadDir(filesPath, { silent: true, force: true });
    } catch (e) {
      toast("创建失败", String(e?.message || e));
    }
  }

  /* ---------------- 绑定 ---------------- */

  const list = appsList();
  if (list) {
    list.addEventListener("click", (e) => {
      if (appSelectMode) {
        const row = e.target.closest(".dev-row[data-pkg]");
        if (row) {
          e.preventDefault();
          toggleAppPick(row.dataset.pkg, row);
        }
        return;
      }
      const btn = e.target.closest("button[data-app-act]");
      if (btn) {
        e.preventDefault();
        runAppAction(btn.dataset.appAct, btn.dataset.pkg, btn);
        return;
      }
      const row = e.target.closest(".dev-row[data-pkg]");
      if (row) {
        e.preventDefault();
        selectSingleApp(row.dataset.pkg, row);
      }
      const name = e.target.closest("[data-app-detail]");
      if (name) showAppDetail(name.dataset.appDetail);
    });
  }
  $("btn-app-select")?.addEventListener("click", () => setAppSelectMode(!appSelectMode));
  $("btn-app-select-all")?.addEventListener("click", () => selectAllApps(false));
  $("app-batch")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-batch-act]");
    if (btn) runAppBatch(btn.dataset.batchAct);
  });
  $("app-search")?.addEventListener("input", renderApps);
  document.querySelectorAll("#app-scope .scope-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      appScope = btn.dataset.scope || "all";
      appSelected.clear();
      document.querySelectorAll("#app-scope .scope-btn").forEach((b) => {
        b.classList.toggle("active", b === btn);
        b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      });
      updateBatchBar();
      renderApps();
    });
  });
  $("btn-app-refresh")?.addEventListener("click", () => refreshApps());
  $("btn-app-install")?.addEventListener("click", () => $("app-apk-input")?.click());

  const apkInput = $("app-apk-input");
  apkInput?.addEventListener("change", async () => {
    const file = apkInput.files?.[0];
    apkInput.value = "";
    await installApk(file);
  });

  const filesBox = filesList();
  if (filesBox) {
    filesBox.addEventListener("click", async (e) => {
      const row = e.target.closest(".dev-row[data-path]");
      if (!row) return;
      const entry = filesEntries.find((item) => item.path === row.dataset.path);
      if (!entry) return;
      if (fileSelectMode) {
        e.preventDefault();
        toggleFilePick(entry.path, row);
        return;
      }
      const btn = e.target.closest("button[data-file-act]");
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        const act = btn.dataset.fileAct;
        if (act === "download") await downloadFile(entry);
        else if (act === "delete") await removeEntry(entry);
        else if (act === "rename") await renameEntry(entry);
        else if (act === "install") await installFromDevice(entry);
        return;
      }
      if (entry.dir) {
        await loadDir(entry.path);
        return;
      }
      // v4.0.23：普通模式点单个文件 = 选中它 + 打开详情，顶部批处理条随即可用。
      selectSingleFile(entry, row);
      showFileDetail(entry);
    });
  }

  $("btn-file-select")?.addEventListener("click", () => setFileSelectMode(!fileSelectMode));
  $("file-batch")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-file-batch-act]");
    if (btn) runFileBatch(btn.dataset.fileBatchAct);
  });

  $("btn-file-refresh")?.addEventListener("click", () => loadDir(filesPath));
  $("btn-file-up")?.addEventListener("click", () => loadDir(parentPath(filesPath)));
  $("btn-file-go")?.addEventListener("click", () => loadDir($("file-path")?.value || DEFAULT_DIR));
  $("file-path")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      loadDir($("file-path")?.value || DEFAULT_DIR);
    }
  });
  $("btn-file-upload")?.addEventListener("click", () => {
    if (!getMirror()?.adb) return toast("请先连接设备");
    $("file-upload")?.click();
  });
  $("btn-file-newdir")?.addEventListener("click", mkdirHere);

  const uploadInput = $("file-upload");
  uploadInput?.addEventListener("change", async () => {
    const picked = Array.from(uploadInput.files || []);
    uploadInput.value = "";
    await uploadFiles(picked);
  });

  document.querySelectorAll("#file-quick button").forEach((btn) => {
    btn.addEventListener("click", () => loadDir(btn.dataset.path));
  });

  // 拖拽：文件面板上传；应用面板只接 APK
  const filesPanel = document.querySelector('[data-panel="files"]');
  if (filesPanel) {
    const over = (e) => {
      e.preventDefault();
      filesPanel.classList.add("is-drop");
    };
    const leave = () => filesPanel.classList.remove("is-drop");
    filesPanel.addEventListener("dragover", over);
    filesPanel.addEventListener("dragleave", leave);
    filesPanel.addEventListener("drop", async (e) => {
      e.preventDefault();
      leave();
      const dropped = Array.from(e.dataTransfer?.files || []);
      if (!dropped.length) return;
      await uploadFiles(dropped);
    });
  }
  const appsPanel = document.querySelector('[data-panel="apps"]');
  if (appsPanel) {
    const over = (e) => {
      e.preventDefault();
      appsPanel.classList.add("is-drop");
    };
    const leave = () => appsPanel.classList.remove("is-drop");
    appsPanel.addEventListener("dragover", over);
    appsPanel.addEventListener("dragleave", leave);
    appsPanel.addEventListener("drop", async (e) => {
      e.preventDefault();
      leave();
      const dropped = Array.from(e.dataTransfer?.files || []);
      const apk = dropped.find((f) => /\.apk$/i.test(f.name));
      if (apk) await installApk(apk);
      else if (dropped.length) toast("这里只接收 APK", "其他文件请拖到「文件」面板上传");
    });
  }

  // 打开面板时按需加载
  document.querySelectorAll('[data-drawer="apps"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!appsCache.length) refreshApps();
    });
  });
  document.querySelectorAll('[data-drawer="files"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!getMirror()?.adb) return setFilesStatus("请先连接设备");
      if (!filesEntries.length) loadDir(filesPath);
    });
  });

  setAppsStatus("连接设备后加载");
  setFilesStatus("连接设备后加载");
  if ($("file-path")) $("file-path").value = filesPath;
  if (location.search.includes("debug")) {
    window.__filesApi = filesApi;
    window.__appsApi = appsApi;
  }

  return {
    markDisconnected() {
      apps = null;
      appsAdb = null;
      appsCache = [];
      // 清空元数据请求队列与并发计数，否则残留的 appActive 会让重连后的 pumpAppQueue 永久停摆
      appQueue.length = 0;
      appActive = 0;
      if (appScrollBody) {
        appScrollBody.removeEventListener("scroll", loadVisibleAppRows);
        appScrollBody = null;
      }
      files = null;
      filesAdb = null;
      filesEntries = [];
      if (appsList()) appsList().replaceChildren();
      if (filesList()) filesList().replaceChildren();
      setAppsStatus("设备已断开，重新连接后点「刷新」");
      setFilesStatus("设备已断开，重新连接后点「刷新」");
    },
    notifyConnected() {
      setAppsStatus("已连接，点「刷新」读取应用");
      setFilesStatus("已连接，点「刷新」读取文件");
    },
  };
}

