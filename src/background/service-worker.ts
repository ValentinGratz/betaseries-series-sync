import { connectBetaSeries, disconnectBetaSeries } from "../betaseries/auth";
import { storage } from "../storage/storage";
import { processWatchedCandidate } from "./sync-service";
import { log } from "../utils/logger";
import type { ExtensionMessage } from "../utils/messages";

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await storage.getSettings();
  await storage.setSettings(settings); // ensure defaults are persisted on first install
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((err) => sendResponse({ error: (err as Error).message }));
  return true; // keep the message channel open for the async response
});

async function handleMessage(message: ExtensionMessage): Promise<unknown> {
  switch (message.type) {
    case "EPISODE_WATCHED_CANDIDATE":
      return processWatchedCandidate(message.episode);

    case "HISTORY_EPISODES_FOUND": {
      const results = [];
      for (const episode of message.episodes) {
        results.push(await processWatchedCandidate(episode));
      }
      return { results };
    }

    case "CONNECT_BETASERIES":
      await log("info", "Tentative de connexion à BetaSeries…");
      try {
        const auth = await connectBetaSeries();
        await log("info", `Connecté à BetaSeries en tant que ${auth.memberLogin ?? "?"}.`);
        return auth;
      } catch (err) {
        await log("error", `Échec de connexion BetaSeries : ${(err as Error).message}`);
        return { error: (err as Error).message };
      }

    case "DISCONNECT_BETASERIES":
      await disconnectBetaSeries();
      await log("info", "Déconnecté de BetaSeries.");
      return { ok: true };

    case "GET_AUTH_STATE":
      return storage.getAuth();

    case "GET_SETTINGS":
      return storage.getSettings();

    case "SET_SETTINGS":
      await storage.setSettings(message.settings);
      return { ok: true };

    case "GET_RECENT_SYNCS":
      return { records: await storage.getRecentSyncs() };

    case "GET_LOGS":
      return { logs: await storage.getLogs() };

    case "CLEAR_LOGS":
      await storage.clearLogs();
      return { ok: true };

    case "REQUEST_HISTORY_SYNC": {
      // The popup asks the active tab's content script to scan for
      // history; the content script replies via HISTORY_EPISODES_FOUND
      // (or a HISTORY_UNAVAILABLE-shaped result it renders itself).
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return { ok: false, reason: "No active tab." };
      return chrome.tabs.sendMessage(tab.id, { type: "SCAN_HISTORY" });
    }

    case "SYNC_NOW":
      return { ok: true };

    default:
      return { error: "Unknown message type." };
  }
}
