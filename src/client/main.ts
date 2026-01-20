import { Device, Call } from "@twilio/voice-sdk";

// DOM要素
const deviceStatusEl = document.getElementById("deviceStatus") as HTMLElement;
const connectBtn = document.getElementById("connectBtn") as HTMLButtonElement;
const disconnectBtn = document.getElementById(
  "disconnectBtn"
) as HTMLButtonElement;
const improvedSignalingCheckbox = document.getElementById(
  "improvedSignaling"
) as HTMLInputElement;
const logsEl = document.getElementById("logs") as HTMLElement;
const clearLogsBtn = document.getElementById("clearLogs") as HTMLButtonElement;

let device: Device | null = null;
let currentCall: Call | null = null;

// ログ出力
function log(message: string, type: "info" | "error" | "success" | "warn" = "info") {
  const timestamp = new Date().toLocaleTimeString();
  const className = `log-${type}`;
  logsEl.innerHTML += `<span class="${className}">[${timestamp}] ${message}</span>\n`;
  logsEl.scrollTop = logsEl.scrollHeight;
  console.log(`[${type.toUpperCase()}]`, message);
}

// ステータス更新
function setStatus(status: string, className: string) {
  deviceStatusEl.textContent = status;
  deviceStatusEl.className = `status ${className}`;
}

// Deviceの初期化
async function initDevice() {
  const enableImprovedSignaling = improvedSignalingCheckbox.checked;
  log(`Initializing device (enableImprovedSignalingErrorPrecision: ${enableImprovedSignaling})`, "info");

  try {
    // トークン取得
    const response = await fetch("/token");
    const { token, identity } = await response.json();
    log(`Token received for identity: ${identity}`, "success");

    // 既存のDeviceがあれば破棄
    if (device) {
      device.destroy();
      device = null;
    }

    // Device作成
    device = new Device(token, {
      enableImprovedSignalingErrorPrecision: enableImprovedSignaling,
      logLevel: 1, // DEBUG
    });

    // イベント登録
    device.on("registered", () => {
      log("Device registered", "success");
      setStatus("Ready", "ready");
      connectBtn.disabled = false;
    });

    device.on("unregistered", () => {
      log("Device unregistered", "warn");
      setStatus("Unregistered", "error");
      connectBtn.disabled = true;
    });

    device.on("error", (error) => {
      log(`Device error: ${error.code} - ${error.message}`, "error");
      log(`Error details: ${JSON.stringify(error, null, 2)}`, "error");
    });

    device.on("tokenWillExpire", () => {
      log("Token will expire soon", "warn");
    });

    // Device登録
    await device.register();
  } catch (err) {
    const error = err as Error;
    log(`Failed to initialize device: ${error.message}`, "error");
    setStatus("Error", "error");
  }
}

// 接続
async function connect() {
  if (!device) {
    log("Device not initialized", "error");
    return;
  }

  log("Connecting...", "info");
  setStatus("Connecting", "connecting");
  connectBtn.disabled = true;

  try {
    currentCall = await device.connect();
    log(`Call created: ${currentCall.parameters.CallSid}`, "info");

    // Call イベント
    currentCall.on("accept", () => {
      log("Call accepted", "success");
      disconnectBtn.disabled = false;
    });

    currentCall.on("disconnect", () => {
      log("Call disconnected", "warn");
      setStatus("Ready", "ready");
      connectBtn.disabled = false;
      disconnectBtn.disabled = true;
      currentCall = null;
    });

    currentCall.on("cancel", () => {
      log("Call cancelled", "warn");
      setStatus("Ready", "ready");
      connectBtn.disabled = false;
      disconnectBtn.disabled = true;
      currentCall = null;
    });

    currentCall.on("reject", () => {
      log("Call rejected", "error");
      setStatus("Ready", "ready");
      connectBtn.disabled = false;
      disconnectBtn.disabled = true;
      currentCall = null;
    });

    currentCall.on("error", (error) => {
      log(`===== CALL ERROR EVENT =====`, "error");
      log(`Error code: ${error.code}`, "error");
      log(`Error message: ${error.message}`, "error");
      log(`Error name: ${error.name}`, "error");
      log(`Full error: ${JSON.stringify(error, null, 2)}`, "error");
      log(`=============================`, "error");

      setStatus("Error", "error");
      connectBtn.disabled = false;
      disconnectBtn.disabled = true;
      currentCall = null;
    });

    currentCall.on("warning", (name, data) => {
      log(`Call warning: ${name} - ${JSON.stringify(data)}`, "warn");
    });

    currentCall.on("reconnecting", (error) => {
      log(`Call reconnecting: ${error?.message}`, "warn");
    });

    currentCall.on("reconnected", () => {
      log("Call reconnected", "success");
    });
  } catch (err) {
    const error = err as Error;
    log(`Connect failed: ${error.message}`, "error");
    setStatus("Ready", "ready");
    connectBtn.disabled = false;
  }
}

// 切断
function disconnect() {
  if (currentCall) {
    log("Disconnecting...", "info");
    currentCall.disconnect();
  }
}

// イベントリスナー
connectBtn.addEventListener("click", connect);
disconnectBtn.addEventListener("click", disconnect);
clearLogsBtn.addEventListener("click", () => {
  logsEl.innerHTML = "";
});

// チェックボックス変更時にDeviceを再初期化
improvedSignalingCheckbox.addEventListener("change", () => {
  log("Reinitializing device with new settings...", "info");
  initDevice();
});

// 初期化
log("Starting application...", "info");
initDevice();
