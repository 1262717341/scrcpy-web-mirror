# 第三方组件与许可声明（Third-Party Notices）

本仓库（`scrcpy-web-mirror`，scrcpy 便捷网页版）是**第三方非官方实现**，在其上使用了以下开源作品。各组件的版权与许可归原作者，许可全文见 `third_party/` 目录。

## 随仓库分发（含 `js/mirror.bundle.js` 与 `assets/`）

| 组件 | 位置 | 用途 | 许可证 | 版权 | 上游 |
| --- | --- | --- | --- | --- | --- |
| scrcpy 5.0.1（`scrcpy-server.jar`） | `assets/scrcpy-server.jar` | 手机端服务、投屏/控制协议 | Apache-2.0 | © Genymobile | [Genymobile/scrcpy](https://github.com/Genymobile/scrcpy) |
| @yume-chan/adb 系列（adb、adb-credential-web、adb-daemon-webusb、adb-scrcpy、async、event、no-data-view、pcm-player、scrcpy、scrcpy-decoder-tinyh264、scrcpy-decoder-webcodecs、stream-extra、struct） | `js/mirror.bundle.js`、`src/` | 浏览器内 ADB、scrcpy 协议、音频播放 | MIT | © 2020–2025 Simon Chan | [yume-chan/ya-webadb](https://github.com/yume-chan/ya-webadb) |
| tinyh264 | `js/mirror.bundle.js` | H.264 软件解码（无 WebCodecs 时回落） | Apache-2.0 | © Erik De Rijcke | [aaaronic/tinyh264](https://github.com/aaaronic/tinyh264) |
| yuv-buffer / yuv-canvas | `js/mirror.bundle.js` | YUV 帧缓冲转换与 Canvas 绘制 | MIT | © 2014–2024 Brooke Vibber | [btlr/yuv-canvas](https://github.com/btlr/yuv-canvas) |

许可全文：

- `third_party/scrcpy-LICENSE.txt`（Apache-2.0）
- `third_party/ya-webadb-LICENSE.txt`（MIT，Simon Chan）
- `third_party/tinyh264-LICENSE.txt`（Apache-2.0）
- `third_party/yuv-canvas-LICENSE.txt`（MIT，Brooke Vibber，同时覆盖 yuv-buffer）

## 仅构建期使用（不随产物分发）

| 组件 | 用途 | 许可证 | 版权 | 上游 |
| --- | --- | --- | --- | --- |
| esbuild | 把 `src/page-mirror.js` 打包成 `js/mirror.bundle.js` | MIT | © 2020 Evan Wallace | [evanw/esbuild](https://github.com/evanw/esbuild) |
| Node.js / npm | 构建环境 | 见上游 | © OpenJS Foundation 及各贡献者 | [nodejs.org](https://nodejs.org) |

许可全文：`third_party/esbuild-LICENSE.md`。

## 运行时需要但不随仓库分发

| 组件 | 说明 | 许可证 | 版权 |
| --- | --- | --- | --- |
| Android platform-tools（`adb.exe`、`AdbWinApi.dll`、`AdbWinUsbApi.dll`） | 需自行放入 `assets/adb/`，见 README | Apache-2.0 | © Google LLC |

## 声明

- 本项目**不是 scrcpy 官方项目**，与 Genymobile 及 scrcpy 维护者无隶属、赞助或背书关系；仅使用其公开发布的服务端与协议。
- `scrcpy`、`Android`、`Chrome`、`Edge`、`Windows` 等名称与商标归各自所有者。
- 本项目自身代码以 Apache-2.0 发布（见 `LICENSE`）；第三方部分仍遵循各自许可，若与本文表述冲突，以各许可证原文为准。
- 如你是权利人并认为此处归属有误，请提交 issue，我们会及时更正。
