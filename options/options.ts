import { sendToBackground } from "../src/utils/messages";
import type { AuthState, ExtensionSettings, LogEntry } from "../src/utils/types";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function refreshAuth(): Promise<void> {
  const auth = await sendToBackground<AuthState>({ type: "GET_AUTH_STATE" });
  $("auth-status").textContent = auth.connected
    ? `Connecté${auth.memberLogin ? ` en tant que ${auth.memberLogin}` : ""}`
    : "Non connecté";
  $<HTMLButtonElement>("connect-btn").hidden = auth.connected;
  $<HTMLButtonElement>("disconnect-btn").hidden = !auth.connected;
}

async function refreshSettings(): Promise<void> {
  const settings = await sendToBackground<ExtensionSettings>({ type: "GET_SETTINGS" });
  $<HTMLSelectElement>("threshold-select").value = String(settings.watchThreshold);
  $<HTMLInputElement>("simulation-toggle").checked = settings.simulationMode;
  $<HTMLInputElement>("debug-toggle").checked = settings.debugLogging;
}

async function refreshLogs(): Promise<void> {
  const { logs } = await sendToBackground<{ logs: LogEntry[] }>({ type: "GET_LOGS" });
  const list = $<HTMLDivElement>("log-list");
  list.textContent = logs
    .slice(-100)
    .reverse()
    .map((l) => `[${new Date(l.timestamp).toLocaleTimeString()}] ${l.level.toUpperCase()}: ${l.message}`)
    .join("\n");
}

async function saveSettings(partial: Partial<ExtensionSettings>): Promise<void> {
  const current = await sendToBackground<ExtensionSettings>({ type: "GET_SETTINGS" });
  await sendToBackground({ type: "SET_SETTINGS", settings: { ...current, ...partial } });
}

function wire(): void {
  $<HTMLButtonElement>("connect-btn").addEventListener("click", async () => {
    await sendToBackground({ type: "CONNECT_BETASERIES" });
    await refreshAuth();
  });
  $<HTMLButtonElement>("disconnect-btn").addEventListener("click", async () => {
    await sendToBackground({ type: "DISCONNECT_BETASERIES" });
    await refreshAuth();
  });
  $<HTMLSelectElement>("threshold-select").addEventListener("change", (e) => {
    const value = Number((e.target as HTMLSelectElement).value) as ExtensionSettings["watchThreshold"];
    saveSettings({ watchThreshold: value });
  });
  $<HTMLInputElement>("simulation-toggle").addEventListener("change", (e) => {
    saveSettings({ simulationMode: (e.target as HTMLInputElement).checked });
  });
  $<HTMLInputElement>("debug-toggle").addEventListener("change", (e) => {
    saveSettings({ debugLogging: (e.target as HTMLInputElement).checked });
  });
  $<HTMLButtonElement>("clear-logs-btn").addEventListener("click", async () => {
    await sendToBackground({ type: "CLEAR_LOGS" });
    await refreshLogs();
  });
}

async function init(): Promise<void> {
  wire();
  await Promise.all([refreshAuth(), refreshSettings(), refreshLogs()]);
}

init();
