import { betaSeriesApi } from "../betaseries/api";
import { getValidAccessToken } from "../betaseries/auth";
import { matchEpisode } from "../betaseries/matcher";
import { dedupKey } from "../storage/dedup-key";
import { storage } from "../storage/storage";
import { log } from "../utils/logger";
import type { DetectedEpisode, SyncRecord } from "../utils/types";

/**
 * Handles a single "this episode looks watched" candidate coming from a
 * content script: checks settings, dedup state, resolves it against
 * BetaSeries, and (unless simulation mode is on) marks it as watched.
 */
export async function processWatchedCandidate(detected: DetectedEpisode): Promise<SyncRecord> {
  const settings = await storage.getSettings();

  if (!settings.enabledPlatforms[detected.platform]) {
    return finish(detected, "skipped", "Platform disabled in settings.");
  }

  const preliminaryKey = dedupKey(detected);
  if (await storage.hasSynced(preliminaryKey)) {
    return finish(detected, "skipped", "Already synchronized (local dedup).", preliminaryKey);
  }

  await log("info", `Detected: ${detected.platform} — ${detected.seriesTitle} S${detected.seasonNumber}E${detected.episodeNumber} (${detected.detectionMethod})`);

  const match = await matchEpisode(detected);

  if (match.status === "ambiguous") {
    await log("warn", `Ambiguous match — synchronization skipped for "${detected.seriesTitle}".`);
    return finish(detected, "ambiguous", match.reason, preliminaryKey);
  }
  if (match.status === "not_found") {
    await log("warn", `Could not identify episode: ${match.reason}`);
    return finish(detected, "error", match.reason, preliminaryKey);
  }
  if (match.status === "error") {
    await log("error", `BetaSeries error: ${match.reason}`);
    return finish(detected, "error", match.reason, preliminaryKey);
  }

  const episode = match.episode!;
  const finalKey = dedupKey(detected, episode.id);
  if (await storage.hasSynced(finalKey)) {
    return finish(detected, "skipped", "Already synchronized (BetaSeries id dedup).", finalKey, episode.id);
  }

  if (settings.simulationMode) {
    await log("info", `SIMULATION — would mark as watched: ${match.show?.title} S${episode.season}E${episode.episode} (BetaSeries episode id ${episode.id})`);
    return finish(detected, "simulated", `Would synchronize BetaSeries episode ${episode.id}.`, finalKey, episode.id);
  }

  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    await log("warn", "BetaSeries authentication expired or missing.");
    return finish(detected, "error", "Not connected to BetaSeries.", finalKey, episode.id);
  }

  try {
    await betaSeriesApi.markEpisodeWatched(episode.id, accessToken);
  } catch (err) {
    await log("error", `BetaSeries API unavailable or rejected the request: ${(err as Error).message}`);
    return finish(detected, "error", (err as Error).message, finalKey, episode.id);
  }

  await log("info", `Episode marked as watched: ${match.show?.title} S${episode.season}E${episode.episode}`);
  return finish(detected, "success", "Synchronized.", finalKey, episode.id);
}

async function finish(
  detected: DetectedEpisode,
  status: SyncRecord["status"],
  message: string | undefined,
  key: string = dedupKey(detected),
  betaSeriesEpisodeId?: number
): Promise<SyncRecord> {
  const record: SyncRecord = {
    key,
    platform: detected.platform,
    seriesTitle: detected.seriesTitle,
    seasonNumber: detected.seasonNumber,
    episodeNumber: detected.episodeNumber,
    betaSeriesEpisodeId,
    status,
    message,
    timestamp: Date.now(),
  };
  await storage.recordSync(record);
  return record;
}
