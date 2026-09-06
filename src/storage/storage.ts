import type {
  AuthState,
  ExtensionSettings,
  LogEntry,
  SyncRecord,
} from "../utils/types";
import { DEFAULT_SETTINGS } from "../utils/types";

const KEYS = {
  auth: "ss_auth",
  settings: "ss_settings",
  syncRecords: "ss_sync_records",
  logs: "ss_logs",
} as const;

const MAX_SYNC_RECORDS = 500;
const MAX_LOGS = 300;

function get<T>(key: string): Promise<T | undefined> {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => resolve(result[key] as T | undefined));
  });
}

function set(key: string, value: unknown): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, () => resolve());
  });
}

export const storage = {
  async getAuth(): Promise<AuthState> {
    return (await get<AuthState>(KEYS.auth)) ?? { connected: false };
  },
  async setAuth(auth: AuthState): Promise<void> {
    await set(KEYS.auth, auth);
  },
  async clearAuth(): Promise<void> {
    await set(KEYS.auth, { connected: false });
  },

  async getSettings(): Promise<ExtensionSettings> {
    const stored = await get<Partial<ExtensionSettings>>(KEYS.settings);
    return { ...DEFAULT_SETTINGS, ...stored };
  },
  async setSettings(settings: ExtensionSettings): Promise<void> {
    await set(KEYS.settings, settings);
  },

  /** Dedup lookup: has this episode key already been synchronized? */
  async hasSynced(key: string): Promise<boolean> {
    const records = await get<Record<string, SyncRecord>>(KEYS.syncRecords);
    return !!records?.[key] && records[key].status === "success";
  },

  async recordSync(record: SyncRecord): Promise<void> {
    const records = (await get<Record<string, SyncRecord>>(KEYS.syncRecords)) ?? {};
    records[record.key] = record;

    const entries = Object.entries(records);
    if (entries.length > MAX_SYNC_RECORDS) {
      entries
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, entries.length - MAX_SYNC_RECORDS)
        .forEach(([k]) => delete records[k]);
    }
    await set(KEYS.syncRecords, records);
  },

  async getRecentSyncs(limit = 20): Promise<SyncRecord[]> {
    const records = (await get<Record<string, SyncRecord>>(KEYS.syncRecords)) ?? {};
    return Object.values(records)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  },

  async appendLog(entry: LogEntry): Promise<void> {
    const logs = (await get<LogEntry[]>(KEYS.logs)) ?? [];
    logs.push(entry);
    while (logs.length > MAX_LOGS) logs.shift();
    await set(KEYS.logs, logs);
  },

  async getLogs(): Promise<LogEntry[]> {
    return (await get<LogEntry[]>(KEYS.logs)) ?? [];
  },

  async clearLogs(): Promise<void> {
    await set(KEYS.logs, []);
  },
};
