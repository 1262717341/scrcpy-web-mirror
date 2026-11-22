# GameScrcpy 输入法实现（参考源码）

本目录是从 [NuoRan/GameScrcpy](https://github.com/NuoRan/GameScrcpy)（Apache-2.0）
复制过来的输入法相关源码，用作实现参考，**不参与本项目构建**。

## 来源与许可

- 仓库：https://github.com/NuoRan/GameScrcpy
- 分支/路径：`main` → `android/companion/src/main/kotlin/com/gamescrcpy/companion/`
- 文件：
  - `CompanionIme.kt`（5,326 B）
  - `ImeBridge.kt`（3,547 B）
  - `AndroidManifest.xml`（3,284 B，仅 IME 服务声明部分相关）
- 许可证：Apache License 2.0（见上游仓库 `LICENSE`）
- 未做修改；文件头保留原始 package 声明。若要用于衍生作品，需按 Apache-2.0
  保留版权与许可声明。

## 它的输入法是怎么工作的

1. **它是真正的系统输入法**
   `CompanionIme : InputMethodService()`，在 Manifest 里以
   `android.permission.BIND_INPUT_METHOD` + `android.view.InputMethod` 注册。
   电脑端打字时，手机当前输入法就是它，所以不存在"注入不进去"的问题。

2. **文字不是走 ADB，而是走伴侣自己的连接**
   `ImeBridge` 是一个进程内单例，向上游暴露 `ImePort`（`commit` / `perform` /
   `watch`）；`CompanionServer` 通过局域网/USB 收到电脑端的 `COMMIT_TEXT` 帧后，
   调用 `ImeBridge.commit(text)`。`CompanionIme.commit()` 再执行
   `currentInputConnection.commitText(text, 1)`，整段文字一次性进输入框。

3. **输入框状态回传**
   `onStartInputView()` 里用 `InputBoxes.of(inputType, imeOptions)` 把
   「是否可见 / 输入类型 / 回车动作 / 是否多行」通过 `ImeBridge.report()` 回传电脑，
   电脑端据此决定是否显示虚拟键盘、回车键是"发送"还是"换行"。

4. **动作与返回**
   `perform(action)` 在手机上执行 `performEditorAction`（搜索/发送/完成）；
   `switchBack()` 调 `switchToPreviousInputMethod()` 回到手机原来的键盘。

5. **断线自动归还键盘**
   `ImeFallback` 记录断线时刻，5 秒宽限期后若仍未重连，自动
   `switchToPreviousInputMethod()`，避免手机一直停在无界面输入法。
   这是它体验上最值得抄的一点。

6. **界面**
   输入视图只有一条 32dp 高的提示条（"正在输入 / 等待电脑"），点一下可切回手机键盘；
   支持把提示条放到屏幕顶部（`ImeBar.TOP`）。

## 为什么不能直接把这份源码编译进我们的项目

- 它依赖 `CompanionState`、`CompanionServer`、`PhoneOptions`、`Look`、`Ui`、
  `R.string/R.drawable` 等伴侣 App 的内部类型与资源，单独拿出来编译不过。
- 它的文字通道是伴侣自己的 TCP/USB 协议，不是 ADB 广播；要复刻就得连
  `CompanionServer` 的握手、加密、分帧一起搬。
- 编译 Android APK 需要 Android SDK / JDK（本机目前没有）。

## 我们当前采用的等价方案

`assets/adbkeyboard/ADBKeyboard.apk`（GPL-2.0，18 KB）承担同样的角色：
系统输入法 + `InputConnection.commitText()`。区别是文字通过
`ADB_INPUT_B64` 广播送达，不需要额外守护进程；连接时自动安装、启用并切换，
断开或点「恢复手机输入法」时归还键盘（对应它的 `ImeFallback` 行为）。

如果以后要完全自研输入法，可直接参考本目录 `CompanionIme.kt` 的
`commit/perform/switchBack` 与 `ImeFallback` 三段逻辑。
