/**
 * 日志中文化（v4.2.12）
 * 目标：把 scrcpy server 输出的英文日志、启动参数 JSON 统一翻成简洁中文，
 *      技术标识（编码器名、API 名、数值单位）保持原样，避免看日志还要猜英文。
 */

// 常见 scrcpy server 日志 → 中文模板（%1/%2 为捕获组）
const SERVER_RULES = [
  [/^INFO: Device: \[([^\]]+)\]\s*(.+?)\s*\(Android\s*([^)]+)\)\s*$/, "设备 $2 · 厂商 $1 · 安卓 $3"],
  [/^INFO: Device: \[([^\]]+)\]\s*(.+)$/, "设备 $2 · 厂商 $1"],
  [/^INFO: Device serial: (.+)$/, "设备序列号 $1"],
  [/^DEBUG: Using video encoder: '?([^']+)'?$/, "视频编码器 $1"],
  [/^DEBUG: Using audio encoder: '?([^']+)'?$/, "音频编码器 $1"],
  [/^DEBUG: Video codec size alignment requirement: (\d+)px$/, "视频尺寸需 $1 像素对齐"],
  [/^DEBUG: Display: using DisplayManager API$/, "显示接口 DisplayManager"],
  [/^INFO: Device display turned off$/, "手机屏幕已关闭"],
  [/^INFO: Device display turned on$/, "手机屏幕已点亮"],
  [/^INFO: Screen size: (\d+)x(\d+)$/, "屏幕尺寸 $1×$2"],
  [/^INFO: (?:Starting|Launching) server/, "服务端启动"],
  [/^INFO: Audio (?:disabled|capture disabled).*$/, "音频采集被禁用"],
  [/^INFO: Audio source: (.+)$/, "音频来源 $1"],
  [/^DEBUG: Audio source: (.+)$/, "音频来源 $1"],
  [/^INFO: Video source: (.+)$/, "视频来源 $1"],
  [/^DEBUG: Video source: (.+)$/, "视频来源 $1"],
  [/^INFO: Recording started/, "开始录制"],
  [/^INFO: Capture stopped/, "采集已停止"],
  [/^INFO: Video encoding stopped/, "视频编码已停止"],
  [/^INFO: Audio encoding stopped/, "音频编码已停止"],
  [/^INFO: Encoder stopped/, "编码器已停止"],
  [/^INFO: Controller stopped/, "控制通道已停止"],
  [/^INFO: Server stopped/, "服务端已停止"],
  [/^ERROR: Could not open video encoder '?([^']+)'?/, "打不开视频编码器 $1"],
  [/^ERROR: Could not open audio encoder '?([^']+)'?/, "打不开音频编码器 $1"],
  [/^ERROR: No video encoder could be found/, "找不到可用的视频编码器"],
  [/^ERROR: Could not (?:start|create) audio (?:capture|recorder)/, "无法启动音频采集"],
  [/^ERROR: Could not (?:start|create) video (?:capture|recorder)/, "无法启动视频采集"],
  [/^ERROR: (.+)$/, "错误：$1"],
  [/^WARN: (.+)$/, "警告：$1"],
  [/^INFO: (.+)$/, "信息：$1"],
  [/^DEBUG: (.+)$/, "调试：$1"],
  [/^TRACE: (.+)$/, "跟踪：$1"],
];

// 通用短语补译（server 之外的位置，例如客户端异常输出）
const PHRASES = [
  [/\bDevice serial\b/g, "设备序列号"],
  [/\bDevice display turned off\b/g, "手机屏幕已关闭"],
  [/\bDevice display turned on\b/g, "手机屏幕已点亮"],
  [/\bUsing video encoder\b/g, "视频编码器"],
  [/\bUsing audio encoder\b/g, "音频编码器"],
  [/\bCould not open audio encoder\b/g, "打不开音频编码器"],
  [/\bCould not open video encoder\b/g, "打不开视频编码器"],
  [/\bNo video encoder could be found\b/g, "找不到可用的视频编码器"],
  [/\bCould not start audio capture\b/g, "无法启动音频采集"],
  [/\bCould not start video capture\b/g, "无法启动视频采集"],
  [/\bConnection refused\b/g, "连接被拒绝"],
  [/\bPermission denied\b/g, "权限不足"],
  [/\bNo such file or directory\b/g, "文件或目录不存在"],
  [/\bnot found\b/g, "未找到"],
  [/\btimeout\b/gi, "超时"],
  [/\bfailed\b/gi, "失败"],
];

/** 把单行英文 server 日志翻成中文 */
export function translateServerLine(text) {
  let line = String(text == null ? "" : text).trim();
  if (!line) return "";
  // server 输出统一前缀 "[server] "
  let isServer = false;
  if (line.startsWith("[server]")) {
    isServer = true;
    line = line.slice("[server]".length).trim();
  }
  for (const [re, tpl] of SERVER_RULES) {
    const m = line.match(re);
    if (m) {
      const out = tpl.replace(/\$(\d)/g, (_, i) => (m[Number(i)] || "").trim());
      return (isServer ? "服务端 " : "") + out;
    }
  }
  // 未命中模板：至少把常见英文短语替换掉，保留技术标识
  let translated = line;
  for (const [re, zh] of PHRASES) translated = translated.replace(re, zh);
  return (isServer ? "服务端 " : "") + translated;
}

/** 把 scrcpy 启动参数对象压成几行短中文摘要（面板窄，太长会折行显得乱） */
export function summarizeScrcpyOptions(o) {
  const line1 = [];
  const line2 = [];
  const add1 = (k, v) => { if (v !== undefined && v !== null && v !== "" && v !== false) line1.push(k + " " + v); };
  const add2 = (k, v) => { if (v !== undefined && v !== null && v !== "" && v !== false) line2.push(k + " " + v); };
  add1("参数版本", o.serverVersion);
  add1("画面", o.maxSize ? o.maxSize + "px" : "原始尺寸");
  add1("帧率", o.fps ? o.fps + "fps" : "不限");
  add1("码率", o.bitrate ? Math.round(Number(o.bitrate) / 1e6) + "Mbps" : "");
  add1("视频源", { display: "屏幕", camera_back: "后摄", camera_front: "前摄" }[o.source] || o.source);
  add2("音频", o.audioOn ? "开" : "关");
  if (o.audioOn) add2("来源", { both: "内录+麦克风", mic: "麦克风", playback: "内录" }[o.audioMode] || o.audioMode);
  if (o.audioDup) add2("复制", "手机与电脑同时出声");
  if (o.stayAwake) add2("保持唤醒", "开");
  if (o.showTouches) add2("显示触摸", "开");
  if (o.powerOffOnClose) add2("关闭灭屏", "开");
  return "启动参数 · " + line1.join(" · ") + (line2.length ? "\n音频设置 · " + line2.join(" · ") : "");
}

/** 整段日志（可能多行）逐行翻译，返回单行文本，换行保留 */
export function translateLogBlock(text) {
  return String(text == null ? "" : text)
    .split(/\r?\n/)
    .map((l) => translateServerLine(l))
    .filter((l) => l)
    .join("\n");
}
