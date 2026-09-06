import { VideoTracker } from "../detection/video-tracker";
import { sendToBackground } from "../utils/messages";
import type { DetectedEpisode, ExtensionSettings, Platform } from "../utils/types";
import { DEFAULT_SETTINGS } from "../utils/types";

type Detector = () => DetectedEpisode | null;
type HistoryScanner = () => DetectedEpisode[] | null;

/**
 * Wires a platform-specific detector + the shared VideoTracker together.
 * Opening an episode page never triggers a sync by itself — only reaching
 * the configured watch threshold (or `ended`) does, per the project spec.
 */
export function initPlatformContentScript(
  platform: Platform,
  detectEpisode: Detector,
  scanHistory?: HistoryScanner
): void {
  let settings: ExtensionSettings = DEFAULT_SETTINGS;
  let lastUrl = location.href;

  sendToBackground<ExtensionSettings>({ type: "GET_SETTINGS" })
    .then((s) => (settings = s ?? DEFAULT_SETTINGS))
    .catch(() => {
      /* fall back to defaults if the background worker isn't ready yet */
    });

  const tracker = new VideoTracker(
    () => {
      if (!settings.enabledPlatforms[platform]) return;
      const episode = detectEpisode();
      if (!episode) return; // never sync without a confident detection
      sendToBackground({ type: "EPISODE_WATCHED_CANDIDATE", episode }).catch(() => {});
    },
    () => (settings.watchThreshold ?? 80) / 100
  );
  tracker.start();

  // SPA navigation: re-check settings occasionally and let the tracker's own
  // MutationObserver/poll pick up the new <video> element automatically.
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
    }
  }, 1000);

  if (scanHistory) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === "SCAN_HISTORY") {
        const episodes = scanHistory();
        if (episodes === null) {
          sendResponse({ unavailable: true, reason: "Historical synchronization unavailable for this platform." });
        } else {
          sendToBackground({ type: "HISTORY_EPISODES_FOUND", episodes }).then(sendResponse).catch(() => sendResponse({ unavailable: true }));
        }
        return true;
      }
      return false;
    });
  }
}
