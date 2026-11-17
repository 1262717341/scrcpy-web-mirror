/**
 * 无线投屏逻辑（对齐 scrcpy 控制面板）
 * 1) USB 已连时：adb tcpip 5555 + 读取手机 IP
 * 2) 本地扫描：搜局域网 :5555
 * 3) 连接/断开：经 serve.py 的 WS↔TCP 桥
 */
import {
  Adb,
  AdbDaemonTransport,
  AdbPacketHeader,
  AdbReverseNotSupportedError,
  AdbServerClient,
} from "@yume-chan/adb";
import AdbWebCredentialStore from "@yume-chan/adb-credential-web";
import {
  Consumable,
  ReadableStream,
  WritableStream,
} from "@yume-chan/stream-extra";

export class WirelessError extends Error {
  constructor(message, code = "WIRELESS_ERROR", cause) {
    super(message, { cause });
    this.name = "WirelessError";
    this.code = code;
  }
}

function parseHeader(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, 24);
  return {
    command: dv.getUint32(0, true),
    arg0: dv.getUint32(4, true),
    arg1: dv.getUint32(8, true),
    payloadLength: dv.getUint32(12, true),
    checksum: dv.getUint32(16, true),
    magic: dv.getUint32(20, true),
  };
}

function encodePacket(packet) {
  // Accept AdbPacketInit {command,arg0,arg1,payload}
  const payload = packet.payload || new Uint8Array(0);
  const header = AdbPacketHeader.serialize({
    command: packet.command,
    arg0: packet.arg0 | 0,
    arg1: packet.arg1 | 0,
    payloadLength: payload.length,
    checksum: payload.length ? Array.from(payload).reduce((a, b) => (a + b) & 0xffffffff, 0) : 0,
    magic: (packet.command ^ 0xffffffff) >>> 0,
  });
  const out = new Uint8Array(header.length + payload.length);
  out.set(header, 0);
  if (payload.length) out.set(payload, header.length);
  return out;
}

function createAdbConnection(ws) {
  let buffer = new Uint8Array(0);
  // 最近一次从手机收到数据的时间戳：只要视频/音频/ADB 回包还在流入，
  // 链路就必然活着 —— 用于快速判活 + ping 超时时的误判保护。
  let lastRecv = Date.now();
  const readable = new ReadableStream({
    start(controller) {
      ws.binaryType = "arraybuffer";
      ws.addEventListener("message", (ev) => {
        lastRecv = Date.now();
        const chunk = new Uint8Array(ev.data);
        const merged = new Uint8Array(buffer.length + chunk.length);
        merged.set(buffer, 0);
        merged.set(chunk, buffer.length);
        buffer = merged;
        while (buffer.length >= 24) {
          const header = parseHeader(buffer.subarray(0, 24));
          const payloadLength = header.payloadLength >>> 0;
          if (buffer.length < 24 + payloadLength) break;
          const payload = buffer.slice(24, 24 + payloadLength);
          buffer = buffer.slice(24 + payloadLength);
          controller.enqueue({
            command: header.command,
            arg0: header.arg0,
            arg1: header.arg1,
            payload,
            checksum: header.checksum,
            magic: header.magic,
          });
        }
      });
      ws.addEventListener("close", (ev) => {
        const code = ev && ev.code;
        const reason = ev && ev.reason ? ev.reason : "";
        console.warn("[wireless] WS closed", code, reason);
        try {
          window.__wirelessLog = window.__wirelessLog || [];
          window.__wirelessLog.push({ t: Date.now(), ev: "ws-close", code, reason });
        } catch { /* ignore */ }
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      });
      ws.addEventListener("error", (e) => {
        console.warn("[wireless] WS error", e);
        controller.error(e);
      });
    },
  });

  const writable = new WritableStream({
    write(chunk) {
      if (ws.readyState !== 1) throw new WirelessError("WebSocket 未就绪", "WS_CLOSED");
      const packet = chunk instanceof Consumable ? chunk.value : chunk?.value ?? chunk;
      let bytes;
      if (packet instanceof Uint8Array) {
        bytes = packet;
      } else if (packet && typeof packet === "object" && "command" in packet) {
        bytes = encodePacket(packet);
      } else {
        bytes = new Uint8Array(packet || []);
      }
      if (ws.readyState !== 1) return;
      ws.send(bytes);
      if (chunk instanceof Consumable) chunk.consume();
    },
    close() {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    },
  });

  return { readable, writable, lastRecv: () => lastRecv };
}

/** 打开本地服务桥（同一 WebSocket 格式也用于 127.0.0.1:5037 ADB Server） */
async function openAdbBridge(target, timeoutMs = 10000) {
  const wsUrl = `ws://${location.hostname}:${location.port || 8765}/ws/adb?target=${encodeURIComponent(target)}`;
  const ws = new WebSocket(wsUrl);
  ws.binaryType = "arraybuffer";
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new WirelessError("连接本地 ADB 服务超时", "USB_BRIDGE_TIMEOUT")),
      timeoutMs
    );
    ws.addEventListener("open", () => {
      clearTimeout(timer);
      resolve();
    });
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new WirelessError("无法连接本地服务桥（serve.py）", "USB_BRIDGE_FAIL"));
    });
    ws.addEventListener("close", () => {
      clearTimeout(timer);
      reject(new WirelessError("本地 ADB 服务通道已关闭", "USB_BRIDGE_CLOSED"));
    });
  });
  return ws;
}

/** 原始 WebSocket ↔ 字节流：用于 ADB Server 的 ASCII 长度协议，不能再按手机 ADB 包解析 */
function createRawBridgeConnection(ws) {
  const readable = new ReadableStream({
    start(controller) {
      ws.binaryType = "arraybuffer";
      ws.addEventListener("message", (ev) => {
        controller.enqueue(new Uint8Array(ev.data));
      });
      ws.addEventListener("close", () => {
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      });
      ws.addEventListener("error", (e) => {
        try {
          controller.error(e);
        } catch {
          /* ignore */
        }
      });
    },
  });

  const writable = new WritableStream({
    write(chunk) {
      if (ws.readyState !== 1) throw new WirelessError("ADB Server 通道未就绪", "USB_BRIDGE_CLOSED");
      const value = chunk instanceof Consumable ? chunk.value : chunk?.value ?? chunk;
      const bytes =
        value instanceof Uint8Array
          ? value
          : value instanceof ArrayBuffer
          ? new Uint8Array(value)
          : new Uint8Array(value || []);
      ws.send(bytes);
      if (chunk instanceof Consumable) chunk.consume();
    },
    close() {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    },
  });

  return { readable, writable };
}

/** ADB Server 连接器：每次请求经本地桥连接 127.0.0.1:5037 */
function createAdbServerConnector() {
  return {
    async connect() {
      const ws = await openAdbBridge("127.0.0.1:5037");
      const connection = createRawBridgeConnection(ws);
      let resolveClosed;
      const closed = new Promise((resolve) => {
        resolveClosed = resolve;
      });
      ws.addEventListener("close", () => resolveClosed());
      return {
        readable: connection.readable,
        writable: connection.writable,
        closed,
        close: async () => {
          try {
            ws.close();
          } catch {
            /* ignore */
          }
          return closed;
        },
      };
    },
    async addReverseTunnel() {
      // 浏览器侧无法承接 ADB Server 的反向隧道，交给 scrcpy 自动改用 forward 模式
      throw new AdbReverseNotSupportedError();
    },
    async removeReverseTunnel() {
      throw new AdbReverseNotSupportedError();
    },
    async clearReverseTunnels() {
      throw new AdbReverseNotSupportedError();
    },
  };
}

/** 给单个设备建立 ADB Server 传输：每个请求单独开一条 host:transport-id 通道 */
function createUsbDeviceTransport(selected) {
  const transportId = selected.transport_id || selected.transportId || 1;
  const serial = selected.serial;
  const model = selected.model || serial;
  const product = selected.product || model;
  const device = selected.device || model;

  const openTransport = async () => {
    const ws = await openAdbBridge("127.0.0.1:5037");
    const connection = createRawBridgeConnection(ws);
    const writer = connection.writable.getWriter();
    const reader = connection.readable.getReader();
    let closed = false;
    const close = async () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      closed = true;
    };
    try {
      await writer.write(new TextEncoder().encode(`host:transport-id:${transportId}`));
      const { value } = await reader.read();
      const text = value ? new TextDecoder().decode(value) : "";
      if (text.slice(0, 4) !== "OKAY") {
        throw new WirelessError("ADB Server 拒绝设备通道：" + text, "USB_CONNECT_FAIL");
      }
    } catch (e) {
      await close();
      throw e;
    }
    const readable = new ReadableStream({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done || closed) {
            controller.close();
            return;
          }
          controller.enqueue(value);
        } catch (e) {
          controller.error(e);
        }
      },
    });
    return {
      readable,
      writable: connection.writable,
      closed: new Promise((resolve) => {
        ws.addEventListener("close", resolve);
      }),
      close,
    };
  };

  return {
    serial,
    name: model,
    product,
    model,
    device,
    transportId,
    banner: {
      product,
      model,
      device,
      features: new Set(["shell_v2", "cmd", "stat_v2"]),
    },
    connect: openTransport,
    async addReverseTunnel() {
      throw new AdbReverseNotSupportedError();
    },
    async removeReverseTunnel() {
      throw new AdbReverseNotSupportedError();
    },
    async clearReverseTunnels() {
      throw new AdbReverseNotSupportedError();
    },
    async close() {
      /* 无全局连接，无需关闭 */
    },
  };
}

/**
 * 有线直连：浏览器不弹 WebUSB 设备选择器，直接复用本机官方 adb.exe
 * 若手机尚未授权，adb devices 会触发手机上的“允许 USB 调试”弹窗。
 */
export async function connectUsbDirect(preferSerial, onStatus = () => {}) {
  onStatus("检查有线设备…");
  let payload = {};
  try {
    const resp = await fetch("/api/adb-usb", { method: "POST" });
    payload = await resp.json();
  } catch (e) {
    throw new WirelessError("本地 ADB 服务不可用：" + (e?.message || e), "USB_SERVER_FAIL", e);
  }
  if (!payload?.ok) {
    throw new WirelessError(payload?.error || "本机 ADB 无法读取有线设备", "USB_SERVER_FAIL");
  }

  const devices = Array.isArray(payload.devices) ? payload.devices : [];
  if (!devices.length) {
    throw new WirelessError("未检测到 USB 设备。请插好数据线并开启 USB 调试", "USB_NO_DEVICE");
  }
  const authorized = devices.filter((d) => d.state === "device");
  if (!authorized.length) {
    throw new WirelessError(
      "手机尚未授权 USB 调试。请查看手机并勾选「始终允许」后点「确定」",
      "USB_AUTH_REQUIRED"
    );
  }
  const selected =
    (preferSerial && authorized.find((d) => d.serial === preferSerial)) ||
    authorized[0];

  onStatus("有线直连 " + selected.serial + "…");
  let adb;
  try {
    onStatus("ADB Server 通道就绪，连接设备…");
    adb = new Adb(createUsbDeviceTransport(selected));
  } catch (e) {
    throw new WirelessError("有线 ADB 直连失败：" + (e?.message || e), "USB_CONNECT_FAIL", e);
  }
  onStatus("有线已连接");
  return {
    adb,
    serial: selected.serial,
    name: selected.model || selected.serial,
    dispose: async () => {
      try {
        await adb.close();
      } catch {
        /* ignore */
      }
    },
  };
}

/** 有线 server 预上传：由本地官方 ADB 执行 push，绕开浏览器 Sync */
export async function prepareUsbServer(serial, onStatus = () => {}) {
  onStatus("上传 scrcpy-server…");
  let payload = {};
  try {
    const resp = await fetch("/api/usb-push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serial }),
    });
    payload = await resp.json();
  } catch (e) {
    throw new WirelessError("有线 server 上传请求失败：" + (e?.message || e), "USB_PUSH_FAIL", e);
  }
  if (!payload?.ok) {
    throw new WirelessError(payload?.error || "有线 server 上传失败", "USB_PUSH_FAIL");
  }
}

/** 从 USB ADB 开启无线调试并拿到手机 IP */
export async function enableWirelessViaUsb(adb, port = 5555) {
  if (!adb) throw new WirelessError("请先完成 USB 连接", "NO_USB");
  // 设备 IP（wifi）
  let ip = "";
  const cmds = [
    ["ip", "-f", "inet", "addr", "show", "wlan0"],
    ["ip", "-f", "inet", "addr", "show", "rmnet_data0"],
    ["getprop", "dhcp.wlan0.ipaddress"],
    ["getprop", "dhcp.wlan1.ipaddress"],
    ["getprop", "net.hostname"],
  ];
  for (const argv of cmds) {
    try {
      const text = await adb.subprocess.noneProtocol.spawnWaitText(argv);
      const m =
        /inet\s+(\d+\.\d+\.\d+\.\d+)/.exec(text || "") ||
        /(\d+\.\d+\.\d+\.\d+)/.exec(text || "");
      if (m && !m[1].startsWith("127.")) {
        ip = m[1];
        break;
      }
    } catch {
      /* next */
    }
  }

  let portText = "";
  try {
    portText = await adb.createSocketAndWait(`tcpip:${port}`);
  } catch (e) {
    throw new WirelessError("开启无线调试失败：" + (e?.message || e), "TCPIP_FAIL", e);
  }

  return {
    ip,
    port,
    target: ip ? `${ip}:${port}` : "",
    message: portText || "ok",
  };
}

/** 扫描局域网 :5555 */
export async function scanWireless(timeoutMs = 2500) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs + 1500);
    const resp = await fetch("/api/wifi-scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ port: 5555, timeout: Math.ceil(timeoutMs / 1000) }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const data = await resp.json();
    return data.devices || [];
  } catch (e) {
    throw new WirelessError("扫描失败：" + (e?.message || e), "SCAN_FAIL", e);
  }
}

/** 连接无线设备 */
export async function connectWireless(target, onStatus = () => {}) {
  const t = String(target || "").trim();
  if (!t || !/^\d{1,3}(\.\d{1,3}){3}:\d{2,5}$/.test(t)) {
    throw new WirelessError("请填写 IP:端口，例如 192.168.1.8:5555", "BAD_TARGET");
  }
  const wsUrl = `ws://${location.hostname}:${location.port || 8765}/ws/adb?target=${encodeURIComponent(t)}`;
  onStatus(`连接无线 ${t}…`);
  const ws = new WebSocket(wsUrl);
  ws.binaryType = "arraybuffer";

  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new WirelessError("无线连接超时（请确认手机已开无线调试且 IP 正确）", "WS_TIMEOUT")),
      10000
    );
    ws.addEventListener("open", () => {
      clearTimeout(timer);
      resolve();
    });
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new WirelessError("无法连接本地服务桥（serve.py）", "WS_FAIL"));
    });
    ws.addEventListener("close", () => {
      clearTimeout(timer);
      reject(new WirelessError("无线通道已关闭", "WS_CLOSED"));
    });
  });

  const connection = createAdbConnection(ws);
  onStatus("ADB 握手中…");
  let transport;
  const authTask = AdbDaemonTransport.authenticate({
    serial: t,
    connection,
    credentialStore: new AdbWebCredentialStore("PandaTestLocal"),
    readTimeLimit: 0,
  });
  authTask.catch(() => {});
  // 首次连接手机时会弹「允许 USB 调试」，留足阅读/点击时间；排查时可用 ?auth_timeout=毫秒 调整
  const authTimeout = Math.max(
    8000,
    Number(new URLSearchParams(location.search).get("auth_timeout")) || 30000
  );
  try {
    // 握手必须有上限：手机在等「允许调试」确认、或 adbd 被旧连接占住时，
    // authenticate 会一直挂着不返回，界面就永远停在「ADB 握手中…」。
    transport = await Promise.race([
      authTask,
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(
            new WirelessError(
              "ADB 握手超时（" + Math.round(authTimeout / 1000) + "s）。若手机弹出「允许 USB 调试」请点允许；否则重新开启无线调试后再连",
              "AUTH_TIMEOUT"
            )
          );
        }, authTimeout);
      }),
    ]);
  } catch (err) {
    try {
      ws.close();
    } catch {
      /* ignore */
    }
    throw new WirelessError(
      "无线 ADB 握手失败。请：同一 Wi-Fi → USB 开启无线调试（开5555）→ 拔线后连接 IP:5555",
      "AUTH_FAIL",
      err
    );
  }

  const adb = new Adb(transport);
  onStatus("无线已连接");
  return {
    adb,
    target: t,
    lastRecv: connection.lastRecv,
    dispose: async () => {
      try {
        await adb.close();
      } catch {
        /* ignore */
      }
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    },
  };
}

export function wirelessHelp() {
  return [
    "1. 手机与电脑同一 Wi-Fi",
    "2. USB 连接后点「开启无线调试」（等价 adb tcpip 5555）",
    "3. 拔线，填 手机IP:5555 点「连接」",
    "4. 或点「搜索本地 IP」自动发现",
  ].join("\n");
}
