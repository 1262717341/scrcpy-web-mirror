/**
 * 设备侧工具 — 应用管理 / 文件管理
 * 只依赖 @yume-chan/adb 实例，不碰页面 DOM，便于单元测试。
 */

export const DEFAULT_DIR = "/sdcard";

/** POSIX shell 单引号转义 */
export function shellQuote(value) {
  return "'" + String(value).replace(/'/g, "'\\''") + "'";
}

/** 规范化设备路径：合并多余斜杠，去掉末尾斜杠（根目录除外） */
export function normalizePath(input, base = DEFAULT_DIR) {
  let path = String(input == null ? "" : input).trim();
  if (!path) path = base;
  if (!path.startsWith("/")) path = (base.replace(/\/+$/, "") || "") + "/" + path;
  path = path.replace(/\/{2,}/g, "/");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  return path || "/";
}

export function joinPath(dir, name) {
  const base = normalizePath(dir);
  const leaf = String(name == null ? "" : name).replace(/^\/+/, "");
  return normalizePath(base === "/" ? "/" + leaf : base + "/" + leaf);
}

export function parentPath(path) {
  const p = normalizePath(path);
  if (p === "/" || p === "") return "/";
  const idx = p.lastIndexOf("/");
  return idx <= 0 ? "/" : p.slice(0, idx);
}

export function formatSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return n + " B";
  const units = ["KB", "MB", "GB", "TB"];
  let value = n / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return (value >= 10 ? value.toFixed(0) : value.toFixed(1)) + " " + units[unit];
}

export function formatTime(seconds) {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return "";
  const d = new Date(n * 1000);
  const pad = (v) => String(v).padStart(2, "0");
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
}

/** 由文件名判断展示类型（仅用于图标） */
export function fileKind(name) {
  const ext = String(name || "").split(".").pop().toLowerCase();
  if (!ext || ext === name) return "file";
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "heic"].includes(ext)) return "image";
  if (["mp4", "mkv", "mov", "avi", "webm", "3gp"].includes(ext)) return "video";
  if (["mp3", "flac", "wav", "ogg", "m4a", "aac"].includes(ext)) return "audio";
  if (["apk", "apks", "xapk"].includes(ext)) return "apk";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "archive";
  if (["txt", "md", "json", "xml", "log", "csv", "js", "html", "css", "py", "ts"].includes(ext)) return "text";
  return "file";
}

/** 解析 `pm list packages` 输出 */
export function parsePackageList(text) {
  const names = new Set();
  String(text || "")
    .split(/\r?\n/)
    .forEach((line) => {
      const m = line.match(/^package:(\S+)\s*$/);
      if (m) names.add(m[1]);
    });
  return [...names].sort((a, b) => a.localeCompare(b));
}

/** 合并全量列表与第三方列表，标记系统应用 */
export function mergePackages(all, thirdParty) {
  const third = new Set(thirdParty || []);
  return (all || [])
    .map((pkg) => ({ pkg, system: !third.has(pkg) }))
    .sort((a, b) => Number(a.system) - Number(b.system) || a.pkg.localeCompare(b.pkg));
}

export function filterPackages(list, { keyword = "", showSystem = false, scope = "" } = {}) {
  const kw = String(keyword || "").trim().toLowerCase();
  const mode = scope || (showSystem ? "all" : "third");
  return (list || []).filter((item) => {
    if (mode === "third" && item.system) return false;
    if (mode === "system" && !item.system) return false;
    if (!kw) return true;
    return item.pkg.toLowerCase().includes(kw) || String(item.label || "").toLowerCase().includes(kw);
  });
}

const withTimeout = (promise, ms, message) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message || "操作超时")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

/** 封装 adb shell，统一超时与输出裁剪 */
export class AdbShell {
  constructor(adb) {
    this.adb = adb || null;
  }

  get ready() {
    return !!this.adb?.subprocess?.noneProtocol;
  }

  async run(argv, timeoutMs = 20000) {
    const sub = this.adb?.subprocess?.noneProtocol;
    if (!sub) throw new Error("ADB 未连接");
    const output = await withTimeout(sub.spawnWaitText(argv), timeoutMs, "设备命令超时：" + (argv || []).join(" "));
    return String(output == null ? "" : output);
  }

  sh(script, timeoutMs) {
    // adb exec 通道不会对参数做转义，整段脚本必须自己包成一个 shell 参数
    return this.run(["sh", "-c", shellQuote(script)], timeoutMs);
  }
}

export class DeviceApps {
  constructor(adb) {
    this.shell = new AdbShell(adb);
  }

  get ready() {
    return this.shell.ready;
  }

  async list({ includeSystem = true } = {}) {
    if (!this.ready) throw new Error("ADB 未连接");
    const [allOut, thirdOut] = await Promise.all([
      this.shell.run(["pm", "list", "packages"], 25000),
      this.shell.run(["pm", "list", "packages", "-3"], 25000),
    ]);
    return mergePackages(parsePackageList(allOut), parsePackageList(thirdOut)).filter(
      (item) => includeSystem || !item.system
    );
  }

  async start(pkg) {
    const out = await this.shell.run(["monkey", "-p", pkg, "-c", "android.intent.category.LAUNCHER", "1"], 15000);
    if (/No activities found|aborted|Error/i.test(out)) {
      throw new Error(out.split(/\r?\n/).filter(Boolean).pop() || "启动失败");
    }
    return out;
  }

  async forceStop(pkg) {
    return await this.shell.run(["am", "force-stop", pkg]);
  }

  async clearData(pkg) {
    const out = await this.shell.run(["pm", "clear", pkg], 20000);
    if (!/success/i.test(out)) throw new Error(out.trim() || "清除失败");
    return out.trim();
  }

  async setEnabled(pkg, enabled = true) {
    const args = enabled
      ? ["pm", "enable", pkg]
      : ["pm", "disable-user", "--user", "0", pkg];
    const out = await this.shell.run(args, 20000);
    if (!/new state:\s*(enabled|disabled)/i.test(out)) {
      throw new Error(out.trim().split(/\r?\n/).filter(Boolean).pop() || "操作失败");
    }
    return out.trim();
  }

  async uninstall(pkg) {
    const out = await this.shell.run(["pm", "uninstall", "--user", "0", shellQuote(pkg)], 30000);
    if (/Success/i.test(out)) return out.trim();
    // 部分 ROM 不支持 --user 0，退回普通卸载
    const fallback = await this.shell.run(["pm", "uninstall", shellQuote(pkg)], 30000);
    if (!/Success/i.test(fallback)) {
      throw new Error((fallback || out || "卸载失败").trim().split(/\r?\n/).pop());
    }
    return fallback.trim();
  }

  async detail(pkg) {
    const out = await this.shell.run(["dumpsys", "package", pkg], 25000);
    const lines = out.split(/\r?\n/);
    const picked = [];
    const keys = [/versionName=/i, /versionCode=/i, /firstInstallTime=/i, /lastUpdateTime=/i, /targetSdk=/i, /minSdk=/i];
    for (const line of lines) {
      if (keys.some((re) => re.test(line))) picked.push(line.trim());
      if (picked.length >= 8) break;
    }
    return picked;
  }

  async install(file, onProgress) {
    return await this.installToPath(file, onProgress);
  }

  /** 先推到 /data/local/tmp 再 pm install */
  async installToPath(file, onProgress, options = {}) {
    const adb = this.shell.adb;
    if (!adb?.sync) throw new Error("ADB 未连接");
    const remote = "/data/local/tmp/scrcpy-web-" + Date.now() + ".apk";
    const sync = await adb.sync();
    let sent = 0;
    try {
      const stream = file.stream().pipeThrough(
        new TransformStream({
          transform(chunk, controller) {
            sent += chunk.length;
            if (onProgress) onProgress({ phase: "push", sent, total: file.size });
            controller.enqueue(chunk);
          },
        })
      );
      await sync.write({ filename: remote, file: stream, ...options });
    } finally {
      try {
        await sync.dispose();
      } catch {
        /* ignore */
      }
    }
    if (onProgress) onProgress({ phase: "install", sent, total: file.size });
    const out = await this.shell.run(["pm", "install", "-r", "-t", shellQuote(remote)], 120000);
    this.shell.run(["rm", "-f", shellQuote(remote)]).catch(() => {});
    if (!/Success/i.test(out)) {
      throw new Error(out.trim().split(/\r?\n/).filter(Boolean).pop() || "安装失败");
    }
    return out.trim();
  }

  /** 安装设备上已有的 APK */
  async installRemote(path) {
    const out = await this.shell.run(["pm", "install", "-r", "-t", shellQuote(normalizePath(path))], 120000);
    if (!/Success/i.test(out)) {
      throw new Error(out.trim().split(/\r?\n/).filter(Boolean).pop() || "安装失败");
    }
    return out.trim();
  }
}

export class DeviceFiles {
  constructor(adb) {
    this.adb = adb || null;
    this.shell = new AdbShell(adb);
    this._sync = null;
  }

  get ready() {
    return !!this.adb?.sync && this.shell.ready;
  }

  async _open() {
    if (!this.ready) throw new Error("ADB 未连接");
    if (!this._sync) this._sync = await this.adb.sync();
    return this._sync;
  }

  _drop() {
    const s = this._sync;
    this._sync = null;
    if (s) {
      try {
        s.dispose().catch(() => {});
      } catch {
        /* ignore */
      }
    }
  }

  async _withSync(fn) {
    const sync = await this._open();
    try {
      return await fn(sync);
    } catch (e) {
      // 一次失败通常是 sync 通道已失效：丢弃并重试一次
      this._drop();
      const retry = await this._open();
      return await fn(retry);
    }
  }

  async list(path) {
    const dir = normalizePath(path);
    const entries = await this._withSync((sync) => sync.readdir(dir));
    const mapped = entries
      .filter((entry) => entry.name !== "." && entry.name !== "..")
      .map((entry) => ({
        name: entry.name,
        dir: Number(entry.type) === 0o04,
        link: Number(entry.type) === 0o12,
        size: Number(entry.size || 0),
        mtime: Number(entry.mtime || 0),
        path: joinPath(dir, entry.name),
        kind: Number(entry.type) === 0o04 ? "folder" : fileKind(entry.name),
      }));
    mapped.sort((a, b) => {
      if (a.dir !== b.dir) return a.dir ? -1 : 1;
      return a.name.localeCompare(b.name, "zh-Hans-CN");
    });
    return { path: dir, entries: mapped };
  }

  async stat(path) {
    return await this._withSync((sync) => sync.lstat(normalizePath(path)));
  }

  async readBlob(path, onProgress) {
    const target = normalizePath(path);
    const chunks = [];
    let received = 0;
    await this._withSync(async (sync) => {
      const stream = sync.read(target);
      const reader = stream.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.length;
            if (onProgress) onProgress(received);
          }
        }
      } finally {
        try {
          reader.releaseLock();
        } catch {
          /* ignore */
        }
      }
    });
    return new Blob(chunks, { type: "application/octet-stream" });
  }

  async writeBlob(path, blob, onProgress, options = {}) {
    const target = normalizePath(path);
    let sent = 0;
    const file = blob.stream().pipeThrough(
      new TransformStream({
        transform(chunk, controller) {
          sent += chunk.length;
          if (onProgress) onProgress(sent, blob.size);
          controller.enqueue(chunk);
        },
      })
    );
    await this._withSync((sync) => sync.write({ filename: target, file, ...options }));
    return target;
  }

  async mkdir(path) {
    const out = await this.shell.run(["mkdir", "-p", shellQuote(normalizePath(path))]);
    return out.trim();
  }

  async remove(path, recursive = true) {
    const target = normalizePath(path);
    if (target === "/" || target === "/sdcard" || target === "/storage/emulated/0") {
      throw new Error("不允许删除该目录");
    }
    return await this.shell.run(["rm", "-" + (recursive ? "rf" : "f"), shellQuote(target)], 30000);
  }

  async rename(from, to) {
    const src = normalizePath(from);
    const dst = normalizePath(to);
    const out = await this.shell.run(["mv", shellQuote(src), shellQuote(dst)], 30000);
    return out.trim();
  }

  /**
   * v4.0.23 复制文件/文件夹。
   * 目标由调用方负责生成不冲突的名字；这里只拦“把目录复制进自身子目录”这类必然递归的错误。
   */
  async copy(from, to) {
    const src = normalizePath(from);
    const dst = normalizePath(to);
    if (src === "/" || src === "/sdcard" || src === "/storage/emulated/0") {
      throw new Error("不允许复制该目录");
    }
    if (src === dst) throw new Error("源和目标相同");
    if (dst.startsWith(src.replace(/\/+$/, "") + "/")) {
      throw new Error("不能把文件夹复制到它自己的子目录");
    }
    const out = await this.shell.run(["cp", "-R", shellQuote(src), shellQuote(dst)], 60000);
    return out.trim();
  }

  async mediaScan(path) {
    const target = normalizePath(path);
    try {
      await this.shell.run([
        "am",
        "broadcast",
        "-a",
        "android.intent.action.MEDIA_SCANNER_SCAN_FILE",
        "-d",
        shellQuote("file://" + target),
      ]);
    } catch {
      /* 扫描失败不影响文件本身 */
    }
  }
}
