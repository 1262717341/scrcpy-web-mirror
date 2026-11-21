#!/usr/bin/env python3
"""scrcpy 便捷网页版 本地投屏静态服务
- 提供 device-local 静态文件
- GET  /api/status   服务状态
- POST /api/shutdown 停止服务并清理项目进程（网页按钮调用）
"""
from __future__ import annotations

import json
import ipaddress
import os
import re
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import threading
import time
import uuid
import zipfile

# pythonw.exe has no console streams; redirect them so request logging stays safe.
if sys.stdout is None:
    sys.stdout = open(os.devnull, "w", encoding="utf-8", errors="ignore")
if sys.stderr is None:
    sys.stderr = open(os.devnull, "w", encoding="utf-8", errors="ignore")

import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs

import os
from datetime import datetime

WIRELESS_LOG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "wireless.log")

def wlog(msg: str) -> None:
    line = "%s %s\n" % (datetime.now().strftime("%Y-%m-%d %H:%M:%S"), msg)
    try:
        with open(WIRELESS_LOG, "a", encoding="utf-8") as f:
            f.write(line)
    except Exception:
        pass
    try:
        sys.stderr.write("[wireless] " + msg + "\n")
    except Exception:
        pass



ROOT = Path(__file__).resolve().parent
PORT = int(os.environ.get("PANDA_PORT", "8765"))
BIND = "127.0.0.1"
APP_VERSION = "4.2.12"
CREATE_NO_WINDOW = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0

# v4.2.3：应用名/图标解析的临时文件不再落到用户可见的 /sdcard，改放 shell 可写的临时目录。
REMOTE_TEMP_DIR = "/data/local/tmp/scrcpy-web"
_legacy_cleanup_done: set[str] = set()
_legacy_cleanup_lock = threading.Lock()


def run_bundled_adb(args: list[str], timeout: int = 20) -> subprocess.CompletedProcess:
    """Run the bundled official adb without opening any console window."""
    adb_dir = ROOT / "assets" / "adb"
    adb_exe = adb_dir / "adb.exe"
    if not adb_exe.is_file():
        raise RuntimeError("内置 ADB 缺失")
    return subprocess.run(
        [str(adb_exe), *args],
        cwd=str(adb_dir),
        stdin=subprocess.DEVNULL,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
        shell=False,
        creationflags=CREATE_NO_WINDOW,
    )


def adb_server_running(timeout: float = 0.35) -> bool:
    """只探测 5037，不启动 adb；避免 USB 串流期间被后台拉起 adb 抢走接口。"""
    try:
        with socket.create_connection(("127.0.0.1", 5037), timeout=timeout):
            return True
    except OSError:
        return False


def adb_usb_devices(start_if_needed: bool = False) -> list[dict]:
    """查询本机 ADB 设备。

    默认不启动 adb server：USB WebUSB 会话期间，后台启动 adb 会重新抢占
    同一个 USB 接口，表现为连上几秒后突然断流。只有显式允许时才拉起服务。
    """
    if not adb_server_running():
        if not start_if_needed:
            return []
        start = run_bundled_adb(["start-server"], 15)
        if start.returncode != 0:
            raise RuntimeError((start.stdout + start.stderr).strip() or "ADB 启动失败")
    result = run_bundled_adb(["devices", "-l"], 15)
    output = (result.stdout + result.stderr).strip()
    if result.returncode != 0:
        raise RuntimeError(output or "ADB 设备查询失败")

    devices: list[dict] = []
    for line in result.stdout.splitlines():
        line = line.strip()
        if not line or line.startswith("List of devices") or line.startswith("*"):
            continue
        parts = line.split()
        if len(parts) < 2:
            continue
        item = {"serial": parts[0], "state": parts[1]}
        for token in parts[2:]:
            if ":" in token:
                key, value = token.split(":", 1)
                item[key] = value
        devices.append(item)
    return devices


# ---------------- 应用名 / 图标 ----------------
def _pick_app_meta_dir() -> Path:
    """源代码目录可写时沿用旧缓存；装进 Program Files 后自动改到用户目录。"""
    candidates = [ROOT / "appmeta_cache"]
    local = os.environ.get("LOCALAPPDATA") or os.environ.get("XDG_CACHE_HOME")
    if local:
        candidates.append(Path(local) / "scrcpy-web" / "appmeta_cache")
    candidates.append(Path(tempfile.gettempdir()) / "scrcpy-web-appmeta")
    for path in candidates:
        try:
            path.mkdir(parents=True, exist_ok=True)
            probe = path / (".write-probe-" + str(os.getpid()))
            probe.write_text("ok", "utf-8")
            probe.unlink()
            return path
        except OSError:
            continue
    return candidates[-1]


APP_META_DIR = _pick_app_meta_dir()
_APP_META_LOCKS: dict[tuple[str, str], threading.Lock] = {}
_APP_META_GUARD = threading.Lock()


def _posix_quote(value: str) -> str:
    return "'" + str(value).replace("'", "'\\''") + "'"


def _meta_lock(serial: str, pkg: str) -> threading.Lock:
    key = (serial, pkg)
    with _APP_META_GUARD:
        lock = _APP_META_LOCKS.get(key)
        if lock is None:
            lock = threading.Lock()
            _APP_META_LOCKS[key] = lock
        return lock


def _cache_dir(serial: str) -> Path:
    safe = re.sub(r"[^0-9A-Za-z._-]", "_", serial)
    path = APP_META_DIR / safe
    path.mkdir(parents=True, exist_ok=True)
    return path


def _read_local_meta(serial: str, pkg: str) -> dict | None:
    """读取本机已有缓存的应用名/图标；命中返回响应字典，未命中或损坏返回 None。"""
    cache = _cache_dir(serial)
    meta_file = cache / f"{pkg}.json"
    if not meta_file.is_file():
        return None
    try:
        cached = json.loads(meta_file.read_text("utf-8"))
    except Exception:
        return None
    icon = cached.get("icon") or ""
    icon_ok = bool(icon and (cache / icon).is_file())
    if icon and not icon_ok:
        icon = ""
    return {
        "ok": True,
        "name": cached.get("name") or pkg,
        "pkg": pkg,
        "icon": icon_ok,
        "iconVersion": int(meta_file.stat().st_mtime),
        "cached": True,
    }


def _adopt_meta_from_other(serial: str, pkg: str) -> dict | None:
    """USB 直连时本机 adb 不能抢接口；从其它设备序列号的缓存里复用同名包的应用名/图标。"""
    target = _cache_dir(serial)
    meta_file = target / f"{pkg}.json"
    if meta_file.is_file():
        return None
    try:
        holders = [d for d in APP_META_DIR.iterdir() if d.is_dir() and d != target]
    except OSError:
        return None
    for holder in holders:
        if holder.name.startswith("meta_"):
            continue
        source_file = holder / f"{pkg}.json"
        if not source_file.is_file():
            continue
        try:
            cached = json.loads(source_file.read_text("utf-8"))
        except Exception:
            continue
        icon = cached.get("icon") or ""
        if icon and not (holder / icon).is_file():
            continue
        try:
            if icon:
                shutil.copy2(holder / icon, target / icon)
            temp_file = target / f"{pkg}.json.tmp"
            temp_file.write_text(json.dumps(cached, ensure_ascii=False), "utf-8")
            temp_file.replace(meta_file)
        except OSError:
            continue
        return {
            "ok": True,
            "name": cached.get("name") or pkg,
            "pkg": pkg,
            "icon": bool(icon),
            "iconVersion": int(meta_file.stat().st_mtime),
            "shared": True,
        }
    return None


def _adb_pull(serial: str, remote: str, local: Path, timeout: int = 40) -> None:
    # adb 的可执行目录是 assets\adb；对含中文的绝对路径 adb 会报“无法创建目录”，
    # 这里改成相对 adb 目录的路径，既避开中文前缀，也保持文件落在原目标位置。
    try:
        local_arg = os.path.relpath(str(local), str(ROOT / "assets" / "adb"))
    except ValueError:
        local_arg = str(local)
    result = run_bundled_adb(["-s", serial, "pull", remote, local_arg], timeout)
    if not local.is_file():
        raise RuntimeError((result.stdout + result.stderr).strip() or "ADB 拉取失败")


def _package_apk(serial: str, pkg: str) -> str:
    # 无线设备：本机 adb server 与网页的直连是两条通道，这里先确保 adb server 也连上
    if ":" in serial:
        try:
            listed = run_bundled_adb(["devices"], 10)
            if f"{serial}\tdevice" not in (listed.stdout or ""):
                run_bundled_adb(["connect", serial], 15)
        except Exception:
            pass
    result = run_bundled_adb(["-s", serial, "shell", f"pm path {_posix_quote(pkg)}"], 20)
    for line in (result.stdout + result.stderr).splitlines():
        line = line.strip()
        if line.startswith("package:"):
            return line[len("package:"):].strip()
    if ":" in serial:
        # 网页直连可能挤掉了 adb server 的连接，重连后重试一次
        try:
            run_bundled_adb(["connect", serial], 15)
            result = run_bundled_adb(["-s", serial, "shell", f"pm path {_posix_quote(pkg)}"], 20)
            for line in (result.stdout + result.stderr).splitlines():
                line = line.strip()
                if line.startswith("package:"):
                    return line[len("package:"):].strip()
        except Exception:
            pass
    raise RuntimeError("找不到应用安装包")


def _cleanup_legacy_temp(serial: str) -> None:
    """每个服务进程只做一次：清掉旧版本留在 /sdcard 根目录的应用解析临时文件。"""
    with _legacy_cleanup_lock:
        if serial in _legacy_cleanup_done:
            return
        try:
            run_bundled_adb(
                ["-s", serial, "shell",
                 "rm -f /sdcard/.scrcpy_*.xml /sdcard/.scrcpy_*.arsc /sdcard/.scrcpy_*.icon 2>/dev/null; "
                 f"rm -rf {REMOTE_TEMP_DIR}; mkdir -p {REMOTE_TEMP_DIR}; true"],
                15,
            )
            _legacy_cleanup_done.add(serial)
            wlog(f"已清理旧版 /sdcard/.scrcpy_* 临时文件 · {serial}")
        except Exception as e:
            wlog(f"旧版临时文件清理失败 · {serial} · {e}")


def app_meta(serial: str, pkg: str) -> dict:
    """读取应用显示名与图标路径（结果按包名缓存，APK 路径变化才刷新）。"""
    if not re.fullmatch(r"[0-9A-Za-z._:-]{1,80}", serial or ""):
        raise RuntimeError("设备序列号不合法")
    if not re.fullmatch(r"[A-Za-z0-9_.]{1,160}", pkg or ""):
        raise RuntimeError("包名不合法")

    # framework-res.apk 不是可启动应用，资源和体积都异常大；直接给固定名称，避免拖住队列。
    if pkg == "android":
        return {"ok": True, "name": "Android 系统框架", "pkg": pkg, "icon": False, "iconVersion": 0}

    # USB 直连由 WebUSB 独占 ADB 接口，服务端再起 adb 会抢走设备并中断投屏。
    # 有本机历史缓存就直接复用；其次从其它设备序列号缓存复用同名包；
    # 都没有才回退包名，绝不在 USB 投屏期间调用本机 adb。
    if ":" not in serial:
        local = _read_local_meta(serial, pkg)
        if local:
            return local
        cached = _adopt_meta_from_other(serial, pkg)
        if cached:
            return cached
        return {"ok": True, "name": pkg, "pkg": pkg, "icon": False, "iconVersion": 0, "usbFallback": True}

    _cleanup_legacy_temp(serial)

    vendor = ROOT / "tools" / "vendor_pyaxml"
    if str(vendor) not in sys.path:
        sys.path.insert(0, str(vendor))
    try:
        from pyaxmlparser import APK  # 延迟导入，避免拖慢服务启动
    except Exception as e:
        raise RuntimeError("应用信息解析组件不可用：" + str(e))

    cache = _cache_dir(serial)
    meta_file = cache / f"{pkg}.json"
    with _meta_lock(serial, pkg):
        try:
            apk_path = _package_apk(serial, pkg)
        except Exception:
            # 设备暂时不可达时退回已有缓存，避免列表整片报错
            if meta_file.is_file():
                try:
                    cached = json.loads(meta_file.read_text("utf-8"))
                except Exception:
                    cached = {}
                icon = cached.get("icon") or ""
                if icon and (cache / icon).is_file():
                    return {
                        "ok": True,
                        "name": cached.get("name") or pkg,
                        "pkg": pkg,
                        "icon": True,
                        "iconVersion": int(meta_file.stat().st_mtime),
                    }
            raise
        if meta_file.is_file():
            try:
                cached = json.loads(meta_file.read_text("utf-8"))
            except Exception:
                cached = {}
            if cached.get("apk") == apk_path:
                icon = cached.get("icon") or ""
                if not icon or (cache / icon).is_file():
                    cached["name"] = cached.get("name") or pkg
                    cached["icon"] = icon
                    return {
                        "ok": True,
                        "name": cached["name"],
                        "pkg": pkg,
                        "icon": bool(icon and (cache / icon).is_file()),
                        "iconVersion": int(meta_file.stat().st_mtime),
                    }

        token = uuid.uuid4().hex[:10]
        remote_xml = f"{REMOTE_TEMP_DIR}/{token}.xml"
        remote_arsc = f"{REMOTE_TEMP_DIR}/{token}.arsc"
        remote_icon = f"{REMOTE_TEMP_DIR}/{token}.icon"
        work = Path(tempfile.mkdtemp(prefix="meta_", dir=str(cache)))
        try:
            cmd = (
                f"mkdir -p {REMOTE_TEMP_DIR}; "
                f"unzip -p {_posix_quote(apk_path)} AndroidManifest.xml > {remote_xml}; "
                f"unzip -p {_posix_quote(apk_path)} resources.arsc > {remote_arsc}"
            )
            run_bundled_adb(["-s", serial, "shell", cmd], 40)
            local_xml = work / "AndroidManifest.xml"
            local_arsc = work / "resources.arsc"
            _adb_pull(serial, remote_xml, local_xml)
            _adb_pull(serial, remote_arsc, local_arsc)

            mini_apk = work / "mini.apk"
            with zipfile.ZipFile(mini_apk, "w", zipfile.ZIP_DEFLATED) as zf:
                zf.write(local_xml, "AndroidManifest.xml")
                zf.write(local_arsc, "resources.arsc")

            vendor = ROOT / "tools" / "vendor_pyaxml"
            if str(vendor) not in sys.path:
                sys.path.insert(0, str(vendor))

            apk = APK(str(mini_apk))
            name = ""
            try:
                name = (apk.get_app_name() or "").strip()
            except Exception:
                name = ""
            icon_entry = ""
            for dpi in (640, 480, 320, 240, 160):
                try:
                    icon_entry = apk.get_app_icon(dpi) or ""
                except Exception:
                    icon_entry = ""
                if icon_entry:
                    break

            icon_name = ""
            if icon_entry and not icon_entry.lower().endswith(".xml"):
                ext = Path(icon_entry).suffix.lower()
                if ext in (".png", ".webp", ".jpg", ".jpeg"):
                    try:
                        run_bundled_adb(
                            ["-s", serial, "shell",
                             f"unzip -p {_posix_quote(apk_path)} {_posix_quote(icon_entry)} > {remote_icon}"],
                            30,
                        )
                        icon_name = f"{pkg}{ext}"
                        _adb_pull(serial, remote_icon, cache / icon_name)
                    except Exception:
                        icon_name = ""
            meta = {"name": name or pkg, "apk": apk_path, "icon": icon_name, "ts": time.time()}
            meta_file.write_text(json.dumps(meta, ensure_ascii=False), "utf-8")
            return {
                "ok": True,
                "name": meta["name"],
                "pkg": pkg,
                "icon": bool(icon_name),
                "iconVersion": int(meta_file.stat().st_mtime),
            }
        finally:
            shutil.rmtree(work, ignore_errors=True)
            try:
                run_bundled_adb(
                    ["-s", serial, "shell",
                     f"rm -f {remote_xml} {remote_arsc} {remote_icon}; rmdir {REMOTE_TEMP_DIR} 2>/dev/null; true"],
                    10,
                )
            except Exception as e:
                wlog(f"临时文件清理失败 · {serial} · {e}")


def app_icon_path(serial: str, pkg: str) -> Path | None:
    if not re.fullmatch(r"[0-9A-Za-z._:-]{1,80}", serial or ""):
        return None
    if not re.fullmatch(r"[A-Za-z0-9_.]{1,160}", pkg or ""):
        return None
    cache = _cache_dir(serial)
    meta_file = cache / f"{pkg}.json"
    if not meta_file.is_file():
        return None
    try:
        meta = json.loads(meta_file.read_text("utf-8"))
    except Exception:
        return None
    icon = meta.get("icon") or ""
    path = cache / icon if icon else None
    return path if path and path.is_file() else None


def json_response(handler: SimpleHTTPRequestHandler, code: int, payload: dict) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(code)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(body)


def _kill_pid(pid: int) -> bool:
    """使用系统原生接口结束目标进程，不调用 PowerShell、CMD 或 taskkill。"""
    try:
        if os.name == "nt":
            import ctypes

            kernel32 = ctypes.windll.kernel32
            kernel32.OpenProcess.argtypes = [ctypes.c_uint32, ctypes.c_bool, ctypes.c_uint32]
            kernel32.OpenProcess.restype = ctypes.c_void_p
            kernel32.TerminateProcess.argtypes = [ctypes.c_void_p, ctypes.c_uint]
            kernel32.TerminateProcess.restype = ctypes.c_bool
            kernel32.CloseHandle.argtypes = [ctypes.c_void_p]
            kernel32.CloseHandle.restype = ctypes.c_bool
            handle = kernel32.OpenProcess(0x0001, False, int(pid))
            if not handle:
                return False
            try:
                return bool(kernel32.TerminateProcess(handle, 0))
            finally:
                kernel32.CloseHandle(handle)
        os.kill(pid, signal.SIGKILL)
        return True
    except Exception:
        return False


def _listener_pids() -> list[int]:
    """直接读取 netstat 输出，避免 shell=True 触发 CMD。"""
    pids: list[int] = []
    try:
        out = subprocess.check_output(
            ["netstat", "-ano"],
            shell=False,
            stderr=subprocess.DEVNULL,
            timeout=4,
            text=True,
            errors="ignore",
            creationflags=CREATE_NO_WINDOW,
        )
    except Exception:
        return pids
    pat = ":%d" % PORT
    for line in out.splitlines():
        if "LISTENING" not in line.upper() or pat not in line:
            continue
        parts = line.split()
        if not parts:
            continue
        try:
            pid = int(parts[-1])
        except ValueError:
            continue
        if pid > 0 and pid not in pids:
            pids.append(pid)
    return pids


def _project_pids() -> list[int]:
    """进程由服务状态、PID 文件和监听端口定位，不再枚举命令行。"""
    return []


def _collect_targets() -> list[int]:
    """并行读取监听端口和项目目标，避免外部命令拖慢关机。"""
    got: dict[str, list[int]] = {}

    def worker(key, fn):
        try:
            got[key] = fn()
        except Exception:
            got[key] = []

    threads = [
        threading.Thread(target=worker, args=("listen", _listener_pids), daemon=True),
        threading.Thread(target=worker, args=("proj", _project_pids), daemon=True),
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join(3.0)
    out: list[int] = []
    for key in ("listen", "proj"):
        out += got.get(key, [])
    return out


def kill_project_processes() -> dict:
    """清理本项目相关进程。全程有超时，绝不会把自己卡死。"""
    killed: list[int] = []
    me = os.getpid()

    targets: list[int] = []
    st = _probe_status()
    if st and st.get("pid"):
        try:
            targets.append(int(st["pid"]))
        except (TypeError, ValueError):
            pass
    targets += _collect_targets()

    pid_file = ROOT / ".http-server.pid"
    try:
        if pid_file.exists():
            pid = int(pid_file.read_text(encoding="ascii").strip() or 0)
            if pid:
                targets.append(pid)
    except Exception:
        pass

    for pid in targets:
        if pid == me or pid in killed:
            continue
        if _kill_pid(pid):
            killed.append(pid)

    try:
        pid_file.unlink(missing_ok=True)
    except OSError:
        pass

    # 停服务连 adb 一起收掉，避免 adb.exe 留在后台占着 5037/USB 设备
    adb_stopped = False
    try:
        run_bundled_adb(["kill-server"], 8)
        adb_stopped = True
    except Exception:
        pass

    return {"killed": killed, "adbStopped": adb_stopped}


def _probe_status(timeout: float = 0.6):
    """裸 socket 探测端口上是否已有本服务。不能用 urllib：系统代理会把 127.0.0.1 也劫走。"""
    try:
        with socket.create_connection((BIND, PORT), timeout=timeout) as c:
            c.settimeout(timeout)
            c.sendall(
                b"GET /api/status HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n"
            )
            buf = b""
            while len(buf) < 65536:
                chunk = c.recv(8192)
                if not chunk:
                    break
                buf += chunk
        body = buf.split(b"\r\n\r\n", 1)[-1].decode("utf-8", "ignore").strip()
        return json.loads(body) if body.startswith("{") else None
    except Exception:
        return None


def ensure_single_instance() -> str:
    """保证一个端口只有一个本服务在应答。

    返回 "fresh" 正常启动 / "reuse" 同目录已有实例 / "took_over" 抢回了旧实例占用的端口。
    为什么需要：Windows 的 SO_REUSEADDR 允许第二个进程绑同一端口，
    两个实例并存时浏览器可能被旧目录里的旧版本接手 —— 表现就是“改了代码但页面没变”。
    """
    st = _probe_status()
    if not st:
        # 端口没人应答：直接启动。不做任何进程扫描，避免每次启动多等 2 秒
        return "fresh"

    other_root = str(st.get("root") or "")
    same_root = bool(other_root) and os.path.normcase(
        os.path.normpath(other_root)
    ) == os.path.normcase(os.path.normpath(str(ROOT)))
    if same_root and st.get("pid"):
        return "reuse"

    # 端口上的监听者（可能是别的目录里的旧版本）全部结束掉
    targets: list[int] = []
    try:
        if st and st.get("pid"):
            targets.append(int(st["pid"]))
    except (TypeError, ValueError):
        pass
    targets += _listener_pids()
    targets += _project_pids()

    killed: list[int] = []
    me = os.getpid()
    for pid in targets:
        if pid == me or pid in killed:
            continue
        if _kill_pid(pid):
            killed.append(pid)
    if killed:
        print("[serve] 已结束占用端口 %d 的旧实例: %s" % (PORT, killed), flush=True)

    # 等端口真正空出来（最多 ~3s），尽量别和旧实例同时监听
    for _ in range(30):
        if _probe_status(timeout=0.2) is None:
            break
        time.sleep(0.1)
    return "took_over" if killed else "fresh"


def _verify_self(timeout: float = 6.0) -> None:
    """绑端口后再确认一次：应答 /api/status 的必须是自己。

    SO_REUSEADDR 下旧进程若没死透会和自己抢连接，页面就会加载到旧文件。
    这里发现不是自己就继续清，直到端口上只剩自己。
    """
    time.sleep(0.4)
    deadline = time.time() + timeout
    me = os.getpid()
    while time.time() < deadline:
        st = _probe_status(timeout=0.4)
        if st is None:
            time.sleep(0.2)
            continue
        try:
            pid = int(st.get("pid") or 0)
        except (TypeError, ValueError):
            pid = 0
        if pid == me:
            return
        if pid:
            print("[serve] 端口上还有别的实例 pid=%d，结束它" % pid, flush=True)
            _kill_pid(pid)
        time.sleep(0.2)



# --- WebSocket <-> TCP bridge for wireless ADB ---
import base64
import hashlib
import selectors
import socket
from urllib.parse import urlparse, parse_qs

WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"


def _ws_accept(key: str) -> str:
    import base64 as b64
    digest = hashlib.sha1((key + WS_GUID).encode("ascii")).digest()
    return b64.b64encode(digest).decode("ascii")


def _ws_send(sock, payload: bytes, opcode: int = 0x2) -> None:
    """Server->client unmasked frame."""
    n = len(payload)
    header = bytearray()
    header.append(0x80 | (opcode & 0x0F))
    if n < 126:
        header.append(n)
    elif n < 65536:
        header.append(126)
        header.extend(n.to_bytes(2, "big"))
    else:
        header.append(127)
        header.extend(n.to_bytes(8, "big"))
    sock.sendall(bytes(header) + payload)


def _ws_feed(buf: bytearray, frag: dict):
    """Yield (kind, payload) for complete client messages.

    浏览器会把大消息拆成 FIN=0 的首帧 + opcode=0 的续帧；必须按消息重组，
    否则每个大包都会丢掉续帧里的字节，手机端 adbd 读到坏流后会直接断开。
    """
    while True:
        if len(buf) < 2:
            return
        b0 = buf[0]
        b1 = buf[1]
        fin = (b0 & 0x80) != 0
        opcode = b0 & 0x0F
        masked = (b1 & 0x80) != 0
        ln = b1 & 0x7F
        idx = 2
        if ln == 126:
            if len(buf) < 4:
                return
            ln = int.from_bytes(buf[2:4], "big")
            idx = 4
        elif ln == 127:
            if len(buf) < 10:
                return
            ln = int.from_bytes(buf[2:10], "big")
            idx = 10
        if masked:
            if len(buf) < idx + 4:
                return
            mask = bytes(buf[idx:idx + 4])
            idx += 4
        else:
            mask = b"\x00\x00\x00\x00"
        if len(buf) < idx + ln:
            return
        payload = bytearray(buf[idx:idx + ln])
        del buf[:idx + ln]
        if masked:
            for i in range(len(payload)):
                payload[i] ^= mask[i % 4]
        payload = bytes(payload)
        if opcode == 0x8:
            yield ("close", b"")
            return
        if opcode == 0x9:
            yield ("ping", payload)
            continue
        if opcode == 0xA:
            continue
        if opcode == 0x0:
            # 续帧：拼到上一条消息里，等 FIN 再交付
            frag["data"].extend(payload)
            if fin:
                data = bytes(frag["data"])
                kind_op = frag["opcode"]
                frag["opcode"] = 0
                frag["data"] = bytearray()
                if kind_op in (0x1, 0x2) and data:
                    yield ("data", data)
            continue
        if opcode in (0x1, 0x2):
            if fin:
                yield ("data", payload)
            else:
                frag["opcode"] = opcode
                frag["data"] = bytearray(payload)


def handle_ws_adb(client_sock, path: str) -> None:
    """Bridge WebSocket binary <-> TCP (Android wireless ADB)."""
    import threading

    q = parse_qs(urlparse(path).query)
    target = (q.get("target") or [""])[0]
    wlog("WS bridge open " + path)

    if ":" not in target:
        try:
            _ws_send(client_sock, b"bad target", 0x8)
        except Exception:
            pass
        try:
            client_sock.close()
        except Exception:
            pass
        wlog("bad target " + target)
        return

    host, port_s = target.rsplit(":", 1)
    try:
        port = int(port_s)
    except ValueError:
        try:
            _ws_send(client_sock, b"bad port", 0x8)
        except Exception:
            pass
        client_sock.close()
        wlog("bad port " + target)
        return

    try:
        tcp = socket.create_connection((host, port), timeout=10)
    except OSError as e:
        try:
            _ws_send(client_sock, ("tcp fail: " + str(e)).encode(), 0x8)
        except Exception:
            pass
        try:
            client_sock.close()
        except Exception:
            pass
        wlog("TCP fail " + target + " " + str(e))
        return

    wlog("TCP connected " + target)

    # Blocking sockets + 2 relay threads — avoid BlockingIOError killing the bridge
    try:
        tcp.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        tcp.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
        client_sock.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
        # ADB Server 的 wait-for-disconnect 等通道会长时间静默，不能套用 10 秒读超时
        tcp.settimeout(None)
    except Exception:
        pass

    state = {"stop": False, "reason": "unknown"}
    stats = {"c2t": 0, "t2c": 0, "frames": 0}

    def stop(reason):
        if not state["stop"]:
            state["stop"] = True
            state["reason"] = reason
            wlog("bridge stop reason=" + reason + " target=" + target
                 + " ws2tcp=" + str(stats["c2t"])
                 + " tcp2ws=" + str(stats["t2c"]))

    def ws_to_tcp():
        buf = bytearray()
        frag = {"opcode": 0, "data": bytearray()}
        try:
            while not state["stop"]:
                try:
                    chunk = client_sock.recv(65536)
                except OSError as e:
                    stop("ws-recv:" + type(e).__name__ + ":" + str(e))
                    return
                if not chunk:
                    stop("ws-closed-by-browser")
                    return
                buf.extend(chunk)
                for kind, payload in _ws_feed(buf, frag):
                    if kind == "close":
                        stop("ws-close-frame")
                        return
                    if kind == "ping":
                        try:
                            _ws_send(client_sock, payload, 0xA)
                        except OSError as e:
                            stop("ws-ping-send:" + str(e))
                            return
                    elif kind == "data":
                        if not payload:
                            continue
                        if target.endswith(":5037") and stats["c2t"] == 0:
                            try:
                                wlog("adb-server req=" + repr(payload[:120]))
                            except Exception:
                                pass
                        try:
                            tcp.sendall(payload)
                            stats["c2t"] += len(payload)
                            stats["frames"] += 1
                        except OSError as e:
                            stop("tcp-send:" + type(e).__name__ + ":" + str(e))
                            return
        except Exception as e:
            stop("ws2tcp-exc:" + str(e))

    def tcp_to_ws():
        try:
            while not state["stop"]:
                try:
                    chunk = tcp.recv(65536)
                except OSError as e:
                    stop("tcp-recv:" + type(e).__name__ + ":" + str(e))
                    return
                if not chunk:
                    stop("tcp-closed-by-phone")
                    return
                try:
                    _ws_send(client_sock, chunk, 0x2)
                    stats["t2c"] += len(chunk)
                except OSError as e:
                    stop("ws-send:" + type(e).__name__ + ":" + str(e))
                    return
        except Exception as e:
            stop("tcp2ws-exc:" + str(e))

    th1 = threading.Thread(target=ws_to_tcp, daemon=True, name="ws2tcp")
    th2 = threading.Thread(target=tcp_to_ws, daemon=True, name="tcp2ws")
    th1.start()
    th2.start()
    th1.join()
    th2.join()
    stop("join-finished")

    # ADB Server 会在一次命令响应后主动断开。给最后的 WebSocket 数据帧留出送达时间，
    # 否则浏览器可能在 close 事件前丢掉版本号等短响应。
    try:
        time.sleep(0.08)
    except Exception:
        pass
    try:
        tcp.close()
    except Exception:
        pass
    try:
        client_sock.close()
    except Exception:
        pass
    wlog("WS bridge close target=" + target + " reason=" + state["reason"])



def wifi_scan(port: int = 5555, timeout: float = 2.0) -> list:
    """Scan local /24 for open TCP port (wireless ADB). Safe / fail-soft."""
    import concurrent.futures
    import ipaddress
    import socket

    ips = []
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(1)
        s.connect(("8.8.8.8", 80))
        local = s.getsockname()[0]
        s.close()
        if local.startswith("192.168.") or local.startswith("10.") or local.startswith("172."):
            net = ipaddress.ip_network(local + "/24", strict=False)
            ips = [str(x) for x in net.hosts() if str(x) != local][:250]
    except Exception:
        pass

    if not ips:
        return []

    found = []

    def probe(ip):
        try:
            sock = socket.create_connection((ip, int(port)), timeout=0.15)
            sock.close()
            return ip
        except Exception:
            return None

    workers = min(48, max(8, len(ips)))
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
            futs = [ex.submit(probe, ip) for ip in ips]
            try:
                for fut in concurrent.futures.as_completed(futs, timeout=max(float(timeout), 1.0)):
                    try:
                        r = fut.result()
                    except Exception:
                        r = None
                    if r:
                        found.append(r)
            except concurrent.futures.TimeoutError:
                pass
    except Exception:
        pass

    found.sort()
    return [{"ip": ip, "port": int(port), "target": ip + ":" + str(port)} for ip in found]



class Handler(SimpleHTTPRequestHandler):
    server_version = "ScrcpyWeb/3.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("[http] %s\n" % (fmt % args))

    def end_headers(self) -> None:
        # 页面/脚本/样式一律不缓存：改完代码刷新即生效，避免旧 bundle 顶替新版本
        path = urlparse(self.path).path.lower()
        if path.endswith((".html", ".htm", ".js", ".css", ".json", ".map")) or path in ("/", ""):
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self):  # noqa: N802
        path = urlparse(self.path).path
        # WebSocket upgrade for wireless ADB bridge
        if path == "/ws/adb" and self.headers.get("Upgrade", "").lower() == "websocket":
            key = self.headers.get("Sec-WebSocket-Key", "")
            accept = _ws_accept(key) if key else ""
            self.send_response(101)
            self.send_header("Upgrade", "websocket")
            self.send_header("Connection", "Upgrade")
            self.send_header("Sec-WebSocket-Accept", accept)
            self.end_headers()
            try:
                handle_ws_adb(self.connection, self.path)
            except Exception as e:
                sys.stderr.write("[ws] %s\n" % e)
            return
        if path == "/api/app-meta":
            qs = parse_qs(urlparse(self.path).query)
            serial = (qs.get("serial") or [""])[0]
            pkg = (qs.get("pkg") or [""])[0]
            try:
                json_response(self, 200, app_meta(serial, pkg))
            except Exception as e:
                json_response(self, 500, {"ok": False, "error": str(e) or "读取应用信息失败"})
            return
        if path == "/api/app-icon":
            qs = parse_qs(urlparse(self.path).query)
            serial = (qs.get("serial") or [""])[0]
            pkg = (qs.get("pkg") or [""])[0]
            icon = app_icon_path(serial, pkg)
            if not icon:
                self.send_response(404)
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                self.end_headers()
                self.wfile.write(b"icon not found")
                return
            data = icon.read_bytes()
            ext = icon.suffix.lower()
            ctype = {".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}.get(ext, "application/octet-stream")
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "public, max-age=86400")
            self.end_headers()
            self.wfile.write(data)
            return
        if path == "/api/status":
            json_response(self, 200, {
                "ok": True,
                "version": APP_VERSION,
                "port": PORT,
                "root": str(ROOT),
                "pid": os.getpid(),
                "time": time.time(),
            })
            return
        super().do_GET()

    def do_POST(self):  # noqa: N802
        path = urlparse(self.path).path
        if path == "/api/shutdown":
            # 先回包再收尾：清理动作放后台，保证浏览器一定拿到 200，进程必定退出
            json_response(self, 200, {
                "ok": True,
                "message": "shutting down",
                "pid": os.getpid(),
            })
            try:
                self.wfile.flush()
            except Exception:
                pass
            wlog("shutdown requested")
            threading.Thread(target=self._exit_soon, daemon=True).start()
            return
        if path == "/api/wifi-scan":
            length = int(self.headers.get("Content-Length") or 0)
            body = self.rfile.read(length) if length else b"{}"
            try:
                data = json.loads(body.decode("utf-8") or "{}")
            except Exception:
                data = {}
            try:
                port = int(data.get("port") or 5555)
                timeout = float(data.get("timeout") or 2)
                devices = wifi_scan(port, timeout)
                json_response(self, 200, {"ok": True, "devices": devices})
            except Exception as e:
                json_response(self, 200, {"ok": False, "devices": [], "error": str(e)})
            return

        if path == "/api/adb-usb":
            # 有线优先走本机官方 ADB 直连；未授权时由 ADB 触发手机端调试授权弹窗
            try:
                devices = adb_usb_devices()
                wlog("adb-usb devices=" + json.dumps(devices, ensure_ascii=False))
                json_response(self, 200, {"ok": True, "devices": devices, "bridge": "127.0.0.1:5037"})
            except Exception as e:
                wlog("adb-usb fail " + str(e))
                json_response(self, 200, {"ok": False, "devices": [], "error": str(e)})
            return

        if path == "/api/usb-push":
            length = int(self.headers.get("Content-Length") or 0)
            body = self.rfile.read(length) if length else b"{}"
            serial = ""
            try:
                data = json.loads(body.decode("utf-8") or "{}")
                serial = str(data.get("serial") or "").strip()
                if not serial or not all(ch.isalnum() or ch in "._:-" for ch in serial):
                    raise ValueError("invalid serial")
                server_jar = ROOT / "assets" / "scrcpy-server.jar"
                if not server_jar.is_file():
                    raise RuntimeError("scrcpy-server 缺失")
                pushed = run_bundled_adb([
                    "-s", serial, "push", str(server_jar),
                    "/data/local/tmp/scrcpy-server.jar",
                ], 35)
                output = (pushed.stdout + pushed.stderr).strip()
                if pushed.returncode != 0:
                    raise RuntimeError(output or "adb push 失败")
                wlog("usb push ok serial=" + serial + " " + output)
                json_response(self, 200, {"ok": True, "output": output})
            except Exception as e:
                wlog("usb push fail serial=" + serial + " " + str(e))
                json_response(self, 200, {"ok": False, "error": str(e)})
            return

        if path == "/api/wireless-push":
            length = int(self.headers.get("Content-Length") or 0)
            body = self.rfile.read(length) if length else b"{}"
            target = ""
            try:
                data = json.loads(body.decode("utf-8") or "{}")
                target = str(data.get("target") or "").strip()
                host, port_text = target.rsplit(":", 1)
                ipaddress.ip_address(host)
                port = int(port_text)
                if not 1 <= port <= 65535:
                    raise ValueError("invalid port")
                adb_dir = ROOT / "assets" / "adb"
                adb_exe = adb_dir / "adb.exe"
                server_jar = ROOT / "assets" / "scrcpy-server.jar"
                if not adb_exe.is_file() or not server_jar.is_file():
                    raise RuntimeError("内置 ADB 或 scrcpy-server 缺失")
                def run_adb(args, timeout):
                    return subprocess.run(
                        [str(adb_exe), *args],
                        cwd=str(adb_dir),
                        stdin=subprocess.DEVNULL,
                        capture_output=True,
                        text=True,
                        encoding="utf-8",
                        errors="replace",
                        timeout=timeout,
                        shell=False,
                        creationflags=CREATE_NO_WINDOW,
                    )
                try:
                    t_begin = time.time()
                    connected = run_adb(["connect", target], 12)
                    if connected.returncode != 0:
                        raise RuntimeError((connected.stdout + connected.stderr).strip())
                    # 手机端已有一份大小一致的 jar 就不重复推：省掉一次 700 KB 传输
                    local_size = server_jar.stat().st_size
                    probe = run_adb([
                        "-s", target, "shell", "stat", "-c", "%s",
                        "/data/local/tmp/scrcpy-server.jar",
                    ], 8)
                    remote_text = (probe.stdout or "").strip()
                    remote_size = int(remote_text) if probe.returncode == 0 and remote_text.isdigit() else -1
                    if remote_size == local_size:
                        output = "server 已存在且大小一致，跳过上传"
                        wlog("wireless push skip target=" + target + " size=" + str(local_size)
                             + " cost=" + ("%.2f" % (time.time() - t_begin)) + "s")
                        json_response(self, 200, {"ok": True, "skipped": True, "output": output})
                        return
                    pushed = run_adb([
                        "-s", target, "push", str(server_jar),
                        "/data/local/tmp/scrcpy-server.jar",
                    ], 35)
                    output = (pushed.stdout + pushed.stderr).strip()
                    if pushed.returncode != 0:
                        raise RuntimeError(output)
                    wlog("wireless push ok target=" + target + " " + output
                         + " cost=" + ("%.2f" % (time.time() - t_begin)) + "s")
                    json_response(self, 200, {"ok": True, "skipped": False, "output": output})
                finally:
                    try:
                        run_adb(["disconnect", target], 5)
                    except Exception:
                        pass
            except Exception as e:
                wlog("wireless push fail target=" + target + " " + str(e))
                json_response(self, 200, {"ok": False, "error": str(e)})
            return

        if path == "/api/save-shot":
            import base64 as _b64
            length = int(self.headers.get("Content-Length") or 0)
            body = self.rfile.read(length) if length else b"{}"
            try:
                data = json.loads(body.decode("utf-8") or "{}")
                raw = _b64.b64decode(data.get("data") or "")
                name = data.get("name") or ("shot-%s.png" % int(time.time()))
                name = os.path.basename(name)
                # C:\Users\<user>\Pictures
                pic = os.path.join(os.environ.get("USERPROFILE", "C:\\"), "Pictures")
                os.makedirs(pic, exist_ok=True)
                out = os.path.join(pic, name)
                with open(out, "wb") as f:
                    f.write(raw)
                # thumbnail data-url (small)
                thumb = ""
                try:
                    from PIL import Image
                    import io as _io
                    import base64 as _b64
                    im = Image.open(_io.BytesIO(raw))
                    im.thumbnail((160, 160))
                    buf = _io.BytesIO()
                    im.save(buf, format="PNG")
                    thumb = "data:image/png;base64," + _b64.b64encode(buf.getvalue()).decode()
                except Exception:
                    thumb = ""
                wlog("save-shot " + out + " bytes=" + str(len(raw)))
                json_response(self, 200, {"ok": True, "path": out, "name": name, "size": len(raw), "thumb": thumb})
            except Exception as e:
                wlog("save-shot fail " + str(e))
                json_response(self, 500, {"ok": False, "error": str(e)})
            return

        if path == "/api/open-shot":
            length = int(self.headers.get("Content-Length") or 0)
            body = self.rfile.read(length) if length else b"{}"
            try:
                data = json.loads(body.decode("utf-8") or "{}")
                file_path = data.get("path") or ""
                if not os.path.isfile(file_path):
                    json_response(self, 400, {"ok": False, "error": "file not found"})
                    return
                # Windows: explorer /select,path
                try:
                    subprocess.Popen(["explorer", "/select," + file_path])
                except Exception:
                    os.startfile(file_path)  # type: ignore
                json_response(self, 200, {"ok": True, "path": file_path})
            except Exception as e:
                json_response(self, 500, {"ok": False, "error": str(e)})
            return
        if path == "/api/kill-adb":
            # WebUSB 要独占 ADB 接口：只在 adb server 真在运行时才 kill。
            # 空跑 kill-server 会触发 adb 自己拉起再退出，造成 USB 重新枚举，
            # 部分机器上会在投屏开始几秒后把 WebUSB 链路掐断。
            details: list[str] = []
            changed = False
            try:
                if not adb_server_running():
                    details.append("adb server 未运行，无需释放")
                else:
                    out = run_bundled_adb(["kill-server"], 10)
                    text = ((out.stdout or "") + (out.stderr or "")).strip()
                    details.append(text or "adb server stopped")
                    changed = out.returncode == 0 or "killed" in text.lower() or "stopped" in text.lower()
            except Exception as e:
                details.append("adb kill-server fail: %s" % e)
            wlog("kill-adb changed=%s %s" % (changed, " | ".join(details)))
            json_response(self, 200, {"ok": True, "changed": changed, "detail": details})
            return

        if path == "/api/cleanup":
            json_response(self, 200, {
                "ok": True,
                "cleanup": kill_project_processes(),
            })
            return
        json_response(self, 404, {"ok": False, "error": "not found"})

    def _exit_soon(self) -> None:
        time.sleep(0.2)
        # pid 文件要先删：os._exit 不会走 finally，清理线程也可能被超时打断
        try:
            (ROOT / ".http-server.pid").unlink(missing_ok=True)
        except OSError:
            pass
        # 清理别的实例，但最多等 2.5s —— 超时也要自杀，绝不把 python 留在后台
        try:
            t = threading.Thread(target=kill_project_processes, daemon=True)
            t.start()
            t.join(2.0)
        except Exception:
            pass
        try:
            sys.stderr.write("[serve] exit\n")
            sys.stderr.flush()
        except Exception:
            pass
        os._exit(0)


def main() -> int:
    state = ensure_single_instance()
    if state == "reuse":
        st = _probe_status() or {}
        print(
            "already running pid=%s -> http://%s:%d/control.html"
            % (st.get("pid", "?"), BIND, PORT),
            flush=True,
        )
        return 0

    # 记录 PID
    try:
        (ROOT / ".http-server.pid").write_text(str(os.getpid()), encoding="ascii")
    except OSError:
        pass

    def _on_signal(signum, _frame):
        try:
            kill_project_processes()
        except Exception:
            pass
        os._exit(0)

    for name in ("SIGTERM", "SIGINT", "SIGBREAK"):
        sig = getattr(signal, name, None)
        if sig is not None:
            try:
                signal.signal(sig, _on_signal)
            except Exception:
                pass

    httpd = None
    for attempt in range(15):
        try:
            httpd = ThreadingHTTPServer((BIND, PORT), Handler)
            break
        except OSError as e:
            if attempt == 14:
                st = _probe_status() or {}
                print(
                    "[serve] 端口 %d 无法绑定(%s)，已被占用 pid=%s root=%s\n"
                    "       请先运行 stop.cmd，或关闭占用该端口的程序。"
                    % (PORT, e, st.get("pid", "?"), st.get("root", "?")),
                    flush=True,
                )
                return 1
            time.sleep(0.3)
    if httpd is None:
        return 1

    print(
        "scrcpy web mirror server v%s http://%s:%d/control.html pid=%d"
        % (APP_VERSION, BIND, PORT, os.getpid()),
        flush=True,
    )
    threading.Thread(target=_verify_self, daemon=True).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        try:
            httpd.server_close()
        except Exception:
            pass
        try:
            (ROOT / ".http-server.pid").unlink(missing_ok=True)
        except OSError:
            pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())








