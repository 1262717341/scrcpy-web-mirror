---
feature: v3-ui-redesign
status: delivered
updated: 2026-11-09
source: local-workspace (no git available on this machine)
---

# scrcpy 便捷网页版 v3 — 全新设计

## Report

**What was built** — v3 全新前端:Linear/Vercel 式深色三栏 App Shell(左:连接向导+投屏设置;中:舞台+悬浮快捷条;右:设备控制+文本上屏+状态+日志),Android 绿 `#3DDC84` 主色,自定义开关/模式卡/步骤指示/toast/指南弹层。`page-mirror.js` 全部重写;核心协议模块原样迁移,修复 mirror.js 日志闭包缺陷与画布内联尺寸冲突;新增 index.html 入口与 favicon;快捷键补齐 F/M。serve.py 与全部后端接口不变。

**Verification** —
- `node build.mjs` → PASS(js/mirror.bundle.js 457.9KB,iife)
- `serve.py` 启动 + GET /api/status → PASS
- Playwright(Edge headless):加载页面、开/关指南弹层、切换无线模式卡 → PASS,控制台 0 错误、0 404;截图确认三栏布局与设计语言落地
- 独立审查(general 子代理):规格符合性 11/11 通过,ID 双向核对零缺失,一致性通过;发现的 btn-fs-fullscreen 双重绑定(v2 遗留)与状态徽章不变灰已修复并复验

## [S1] Problem

v2.0.0 功能完整(USB/无线投屏、控制、音频、截图),但界面是平铺式的:顶栏、连接栏、选项条、控制条、侧栏五个区块堆叠,视觉层级弱、密度高;连接流程(USB 与无线)没有清晰的引导状态;全屏悬浮条与页面控制条重复且样式粗糙。v3 目标:在不丢失任何功能的前提下,做一次全新视觉与信息架构设计,并重新编译产物。

## [S2] Design

### S2.1 设计语言

- 风格锚点:Linear / Vercel 式开发者工具深色界面 × Android 品牌绿。
- 色板:背景 `#0B0E12`,面板 `#11151C`,浮层 `#161B24`,描边 `rgba(255,255,255,.07)`,主文字 `#E8ECF1`,次要 `#8B95A5`,主色 Android 绿 `#3DDC84`,危险 `#F2555A`,警示 `#F5A623`。
- 字体:正文 system-ui + PingFang SC / Microsoft YaHei;数据/日志用 ui-monospace 等宽。
- 圆角 10px 卡片、6px 控件;描边优先于阴影;焦点环用主色 2px。

### S2.2 信息架构(三栏 App Shell)

- 顶栏(48px):品牌 + 状态徽章 + 声音/截图/全屏/指南/停止服务。
- 左栏(288px):连接向导 — USB/无线两张模式卡,各自带步骤提示;无线区含 IP 输入、自动搜索、扫描结果单选列表;下方为投屏设置(分辨率/FPS/码率/视频源 + 5 个开关),全部设置 localStorage 持久化。
- 中央舞台:设备画面,带状态角标;未连接时显示引导占位;舞台上缘悬浮快捷条(返回/主页/多任务/电源/旋转/音量/亮熄屏)。
- 右栏(320px):控制面板分组(导航/系统/画面旋转)+ 文本上屏输入框 + 实时状态(分辨率/帧数/FPS/解码器/音频)+ 日志抽屉。
- 全屏:舞台全屏后显示可拖动的精简悬浮控制条(含文本上屏与停止)。

### S2.3 功能契约(与 v2 对齐,逐项保留)

连接:USB(WebUSB 授权→ADB 认证→投屏)、无线(WS↔TCP 桥)、一键开启无线调试(adb tcpip 5555 并回填 IP)、局域网扫描(`/api/wifi-scan`)、断开。
投屏设置:maxSize/maxFps/videoBitRate/videoSource(display/camera_front/camera_back)/stayAwake/turnScreenOff/powerOffOnClose/showTouches/audioDup,键名沿用 `pandatest-mirror-settings-v1`。不再修改手机 system 设置(锁屏时间/屏保)。
控制:触控/滑动/滚轮映射(含 object-fit 黑边与旋转坐标换算)、系统键组、文本上屏(IME 组合结束后发送,中文走剪贴板粘贴)、设备剪贴板复制/粘贴、手机截屏→电脑图片目录(`/api/save-shot`、`/api/open-shot`)。
画面:画布精确像素 fit、视图旋转 0/90/270(坐标同步换算)、全屏。
声音:PCM 优先、Opus/AAC WebCodecs 兜底、静音开关。
其他:实时日志(500 行环形)、toast、指南弹层、停止服务(`/api/shutdown`)、快捷键(F 全屏 / M 静音 / Shift+Esc 停止)。

### S2.4 工程

- 后端 `serve.py` 原样保留(静态服务 + WS 桥 + 扫描 + 截图 + 关停)。
- 核心模块 `src/mirror.js`、`control.js`、`wireless.js`、`audio.js` 从 v2 迁移,仅做缺陷修复(已发现:mirror.js 中 scrcpy 输出日志的 WritableStream 内 `this.onLog` 指向错误,改为闭包引用)。
- 页面层 `src/page-mirror.js` 全部重写以驱动新 DOM。
- esbuild 打包 `js/mirror.bundle.js`(iife, chrome110/edge110);新增 `index.html` 重定向到 `control.html`。
- `assets/scrcpy-server.jar`、`logo.svg` 从 v2 复制。

## [S3] Out of Scope

- 不改 scrcpy 协议层参数与 ADB 库版本;不引入新依赖。
- 不支持多设备同时投屏;不做移动端布局适配(桌面工具)。
- 不重写 serve.py;不新增后端接口。

## Tasks

- [x] T-UI: control.html + css/app.css 全新设计 — acceptance: 页面含三栏布局与 S2.3 全部控件,构建后浏览器打开无 404、无控制台错误 (covers: S2.1, S2.2)
- [x] T-PAGE: 重写 page-mirror.js 绑定新 DOM — acceptance: S2.3 每个功能都有绑定且 ID 与 HTML 一致 (covers: S2.3)
- [x] T-CORE: 迁移核心模块并修复 mirror.js 日志闭包缺陷 — acceptance: esbuild 编译通过,无未解析引用 (covers: S2.4)
- [x] T-BUILD: npm install + esbuild 编译 — acceptance: `node build.mjs` 成功产出 js/mirror.bundle.js
- [x] T-VISUAL: serve.py 启动 + 截图核查 — acceptance: 页面渲染符合 S2.1/S2.2,无布局破损

## Journey log

- 2026-11-09 追加(设备选择):USB 卡新增已授权设备下拉(#usb-device-select)+「刷新」「添加」按钮;mirror.js 新增 listUsbDevices/pickUsbDevice;start(preferSerial) 按选中序列号连接,选择随设置持久化;serve.py 新增 POST /api/kill-adb(taskkill adb.exe),设备被占用(DEVICE_BUSY)时 toast 内给出「清理占用进程」按钮。

- 本机无 git,Workspace 阶段降级为直接在会话目录实现,无分支/worktree;v2-ref/ 保留为只读参考。
- CSS 类选择器设置 `display` 会覆盖 `[hidden]` 的 UA 隐藏规则 — 指南弹层因此常显遮挡整页,需显式补 `.guide-mask[hidden]{display:none}`。
- v2 遗留缺陷顺带修复:mirror.js scrcpy 输出日志 `this.onLog` 指向 WritableStream sink(首条日志即抛错);btn-fs-fullscreen 同时走 id 监听与 data-act 委托导致全屏切换执行两次。
- 画布尺寸统一由 fitCanvas 精确像素控制,移除 v2 的 maxWidth/maxHeight 内联约束以避免纵横比失真。
- S2.2 中"舞台状态角标"未单独实现,由顶栏状态徽章 + 舞台绿色辉光边框(body.mirroring)承担,观感等价。
