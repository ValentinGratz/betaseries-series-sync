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

  // popup/popup.ts
  var $ = (id) => document.getElementById(id);
  async function refreshAuth() {
    const auth = await sendToBackground({ type: "GET_AUTH_STATE" });
    const statusEl = $("auth-status");
    const connectBtn = $("connect-btn");
    const disconnectBtn = $("disconnect-btn");
    if (auth.connected) {
      statusEl.textContent = `Connect\xE9${auth.memberLogin ? ` (${auth.memberLogin})` : ""}`;
      statusEl.className = "status status--connected";
      connectBtn.hidden = true;
      disconnectBtn.hidden = false;
    } else {
      statusEl.textContent = "Non connect\xE9";
      statusEl.className = "status status--disconnected";
      connectBtn.hidden = false;
      disconnectBtn.hidden = true;
    }
  }
  async function refreshSettings() {
    const settings = await sendToBackground({ type: "GET_SETTINGS" });
    ["tf1plus", "m6plus", "francetv"].forEach((platform) => {
      $(`platform-${platform}`).checked = settings.enabledPlatforms[platform];
    });
    $("simulation-banner").hidden = !settings.simulationMode;
  }
  async function saveSettingsFromForm() {
    const current = await sendToBackground({ type: "GET_SETTINGS" });
    const updated = {
      ...current,
      enabledPlatforms: {
        tf1plus: $("platform-tf1plus").checked,
        m6plus: $("platform-m6plus").checked,
        francetv: $("platform-francetv").checked
      }
    };
    await sendToBackground({ type: "SET_SETTINGS", settings: updated });
  }
  async function refreshLastSync() {
    const { records } = await sendToBackground({ type: "GET_RECENT_SYNCS" });
    const container = $("last-sync");
    const [latest] = records;
    if (!latest) {
      container.textContent = "Aucune synchronisation pour le moment.";
      return;
    }
    const label = latest.seasonNumber != null && latest.episodeNumber != null ? `${latest.seriesTitle} S${String(latest.seasonNumber).padStart(2, "0")}E${String(latest.episodeNumber).padStart(2, "0")}` : latest.seriesTitle;
    const statusIcon = {
      success: "\u2713",
      simulated: "\u{1F9EA}",
      skipped: "\u21B7",
      ambiguous: "\u26A0",
      error: "\u26A0"
    };
    container.innerHTML = `<strong>${label}</strong><br/>${statusIcon[latest.status]} ${latest.message ?? latest.status}`;
  }
  function wireActions() {
    $("connect-btn").addEventListener("click", async () => {
      const errorEl = $("connect-error");
      errorEl.hidden = true;
      try {
        const result = await sendToBackground({ type: "CONNECT_BETASERIES" });
        if (result?.error) {
          errorEl.textContent = `\xC9chec de connexion : ${result.error}`;
          errorEl.hidden = false;
        }
      } catch (err) {
        errorEl.textContent = `\xC9chec de connexion : ${err.message}`;
        errorEl.hidden = false;
      } finally {
        await refreshAuth();
      }
    });
    $("disconnect-btn").addEventListener("click", async () => {
      await sendToBackground({ type: "DISCONNECT_BETASERIES" });
      await refreshAuth();
    });
    ["tf1plus", "m6plus", "francetv"].forEach((platform) => {
      $(`platform-${platform}`).addEventListener("change", saveSettingsFromForm);
    });
    $("history-sync-btn").addEventListener("click", async () => {
      const btn = $("history-sync-btn");
      btn.disabled = true;
      btn.textContent = "Analyse en cours\u2026";
      try {
        const result = await sendToBackground({
          type: "REQUEST_HISTORY_SYNC"
        });
        btn.textContent = result?.unavailable ? "Historique indisponible sur cette page" : "Synchroniser mon historique";
        await refreshLastSync();
      } finally {
        btn.disabled = false;
        setTimeout(() => btn.textContent = "Synchroniser mon historique", 3e3);
      }
    });
    $("open-betaseries-btn").addEventListener("click", () => {
      chrome.tabs.create({ url: "https://www.betaseries.com/" });
    });
    $("open-options-btn").addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
    });
  }
  async function init() {
    wireActions();
    await Promise.all([refreshAuth(), refreshSettings(), refreshLastSync()]);
  }
  init();
})();
//# sourceMappingURL=popup.js.map
