"use strict";
(() => {
  // src/utils/messages.ts
  function sendToBackground(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    });
  }

  // options/options.ts
  var $ = (id) => document.getElementById(id);
  async function refreshAuth() {
    const auth = await sendToBackground({ type: "GET_AUTH_STATE" });
    $("auth-status").textContent = auth.connected ? `Connect\xE9${auth.memberLogin ? ` en tant que ${auth.memberLogin}` : ""}` : "Non connect\xE9";
    $("connect-btn").hidden = auth.connected;
    $("disconnect-btn").hidden = !auth.connected;
  }
  async function refreshSettings() {
    const settings = await sendToBackground({ type: "GET_SETTINGS" });
    $("threshold-select").value = String(settings.watchThreshold);
    $("simulation-toggle").checked = settings.simulationMode;
    $("debug-toggle").checked = settings.debugLogging;
  }
  async function refreshLogs() {
    const { logs } = await sendToBackground({ type: "GET_LOGS" });
    const list = $("log-list");
    list.textContent = logs.slice(-100).reverse().map((l) => `[${new Date(l.timestamp).toLocaleTimeString()}] ${l.level.toUpperCase()}: ${l.message}`).join("\n");
  }
  async function saveSettings(partial) {
    const current = await sendToBackground({ type: "GET_SETTINGS" });
    await sendToBackground({ type: "SET_SETTINGS", settings: { ...current, ...partial } });
  }
  function wire() {
    $("connect-btn").addEventListener("click", async () => {
      await sendToBackground({ type: "CONNECT_BETASERIES" });
      await refreshAuth();
    });
    $("disconnect-btn").addEventListener("click", async () => {
      await sendToBackground({ type: "DISCONNECT_BETASERIES" });
      await refreshAuth();
    });
    $("threshold-select").addEventListener("change", (e) => {
      const value = Number(e.target.value);
      saveSettings({ watchThreshold: value });
    });
    $("simulation-toggle").addEventListener("change", (e) => {
      saveSettings({ simulationMode: e.target.checked });
    });
    $("debug-toggle").addEventListener("change", (e) => {
      saveSettings({ debugLogging: e.target.checked });
    });
    $("clear-logs-btn").addEventListener("click", async () => {
      await sendToBackground({ type: "CLEAR_LOGS" });
      await refreshLogs();
    });
  }
  async function init() {
    wire();
    await Promise.all([refreshAuth(), refreshSettings(), refreshLogs()]);
  }
  init();
})();
//# sourceMappingURL=options.js.map
