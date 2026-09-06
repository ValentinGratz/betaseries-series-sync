import { storage } from "../storage/storage";

export async function log(level: "info" | "warn" | "error", message: string): Promise<void> {
  await storage.appendLog({ level, message, timestamp: Date.now() });
  const settings = await storage.getSettings();
  if (settings.debugLogging) {
    // eslint-disable-next-line no-console
    console[level === "error" ? "error" : "log"](`[SeriesSync] ${message}`);
  }
}
