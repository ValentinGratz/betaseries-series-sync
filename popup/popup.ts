import { sendToBackground } from "../src/utils/messages";
import type { AuthState, ExtensionSettings, Platform, SyncRecord } from "../src/utils/types";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function refreshAuth(): Promise<void> {
  const auth = await sendToBackground<AuthState>({ type: "GET_AUTH_STATE" });
  const statusEl = $<HTMLSpanElement>("auth-status");
  const connectBtn = $<HTMLButtonElement>("connect-btn");
  const disconnectBtn = $<HTMLButtonElement>("disconnect-btn");

  if (auth.connected) {
    statusEl.textContent = `Connecté${auth.memberLogin ? ` (${auth.memberLogin})` : ""}`;
    statusEl.className = "status status--connected";
    connectBtn.hidden = true;
    disconnectBtn.hidden = false;
  } else {
    statusEl.textContent = "Non connecté";
    statusEl.className = "status status--disconnected";
    connectBtn.hidden = false;
    disconnectBtn.hidden = true;
  }
}

async function refreshSettings(): Promise<void> {
  const settings = await sendToBackground<ExtensionSettings>({ type: "GET_SETTINGS" });
  (["tf1plus", "m6plus", "francetv"] as Platform[]).forEach((platform) => {
    $<HTMLInputElement>(`platform-${platform}`).checked = settings.enabledPlatforms[platform];
  });
  $<HTMLElement>("simulation-banner").hidden = !settings.simulationMode;
}

async function saveSettingsFromForm(): Promise<void> {
  const current = await sendToBackground<ExtensionSettings>({ type: "GET_SETTINGS" });
  const updated: ExtensionSettings = {
    ...current,
    enabledPlatforms: {
      tf1plus: $<HTMLInputElement>("platform-tf1plus").checked,
      m6plus: $<HTMLInputElement>("platform-m6plus").checked,
      francetv: $<HTMLInputElement>("platform-francetv").checked,
    },
  };
  await sendToBackground({ type: "SET_SETTINGS", settings: updated });
}

async function refreshLastSync(): Promise<void> {
  const { records } = await sendToBackground<{ records: SyncRecord[] }>({ type: "GET_RECENT_SYNCS" });
  const container = $<HTMLDivElement>("last-sync");
  const [latest] = records;
  if (!latest) {
    container.textContent = "Aucune synchronisation pour le moment.";
    return;
  }
  const label =
    latest.seasonNumber != null && latest.episodeNumber != null
      ? `${latest.seriesTitle} S${String(latest.seasonNumber).padStart(2, "0")}E${String(latest.episodeNumber).padStart(2, "0")}`
      : latest.seriesTitle;
  const statusIcon: Record<SyncRecord["status"], string> = {
    success: "✓",
    simulated: "🧪",
    skipped: "↷",
    ambiguous: "⚠",
    error: "⚠",
  };
  container.innerHTML = `<strong>${label}</strong><br/>${statusIcon[latest.status]} ${latest.message ?? latest.status}`;
}

function wireActions(): void {
  $<HTMLButtonElement>("connect-btn").addEventListener("click", async () => {
    try {
      await sendToBackground({ type: "CONNECT_BETASERIES" });
    } finally {
      await refreshAuth();
    }
  });

  $<HTMLButtonElement>("disconnect-btn").addEventListener("click", async () => {
    await sendToBackground({ type: "DISCONNECT_BETASERIES" });
    await refreshAuth();
  });

  (["tf1plus", "m6plus", "francetv"] as Platform[]).forEach((platform) => {
    $<HTMLInputElement>(`platform-${platform}`).addEventListener("change", saveSettingsFromForm);
  });

  $<HTMLButtonElement>("history-sync-btn").addEventListener("click", async () => {
    const btn = $<HTMLButtonElement>("history-sync-btn");
    btn.disabled = true;
    btn.textContent = "Analyse en cours…";
    try {
      const result = await sendToBackground<{ unavailable?: boolean; reason?: string }>({
        type: "REQUEST_HISTORY_SYNC",
      });
      btn.textContent = result?.unavailable
        ? "Historique indisponible sur cette page"
        : "Synchroniser mon historique";
      await refreshLastSync();
    } finally {
      btn.disabled = false;
      setTimeout(() => (btn.textContent = "Synchroniser mon historique"), 3000);
    }
  });

  $<HTMLButtonElement>("open-betaseries-btn").addEventListener("click", () => {
    chrome.tabs.create({ url: "https://www.betaseries.com/" });
  });

  $<HTMLButtonElement>("open-options-btn").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
}

async function init(): Promise<void> {
  wireActions();
  await Promise.all([refreshAuth(), refreshSettings(), refreshLastSync()]);
}

init();
