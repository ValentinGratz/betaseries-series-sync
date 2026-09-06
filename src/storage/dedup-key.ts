import { normalizeTitle } from "../utils/normalize";
import type { DetectedEpisode } from "../utils/types";

/**
 * Builds a stable key identifying "this exact episode of this exact show".
 * Prefers the resolved BetaSeries episode id (stable across platforms and
 * re-detections); falls back to platform + normalized title + season/episode
 * when no BetaSeries id is known yet (e.g. before matching has run).
 */
export function dedupKey(episode: DetectedEpisode, betaSeriesEpisodeId?: number): string {
  if (betaSeriesEpisodeId) {
    return `bse:${betaSeriesEpisodeId}`;
  }
  const title = normalizeTitle(episode.seriesTitle);
  return `local:${episode.platform}:${title}:s${episode.seasonNumber ?? "x"}e${
    episode.episodeNumber ?? "x"
  }`;
}
