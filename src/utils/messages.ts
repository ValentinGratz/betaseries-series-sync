import type { DetectedEpisode, ExtensionSettings, LogEntry, SyncRecord } from "./types";

export type ExtensionMessage =
  | { type: "EPISODE_WATCHED_CANDIDATE"; episode: DetectedEpisode }
  | { type: "HISTORY_EPISODES_FOUND"; episodes: DetectedEpisode[] }
  | { type: "CONNECT_BETASERIES" }
  | { type: "DISCONNECT_BETASERIES" }
  | { type: "GET_AUTH_STATE" }
  | { type: "GET_SETTINGS" }
  | { type: "SET_SETTINGS"; settings: ExtensionSettings }
  | { type: "GET_RECENT_SYNCS" }
  | { type: "GET_LOGS" }
  | { type: "CLEAR_LOGS" }
  | { type: "REQUEST_HISTORY_SYNC" }
  | { type: "SYNC_NOW" };

export interface RecentSyncsResponse {
  records: SyncRecord[];
}

export interface LogsResponse {
  logs: LogEntry[];
}

export function sendToBackground<T = unknown>(message: ExtensionMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response as T);
    });
  });
}
