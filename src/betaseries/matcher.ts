import { betaSeriesApi, type BsRawShow } from "./api";
import { titleSimilarity } from "../utils/normalize";
import type { BetaSeriesEpisode, BetaSeriesShow, DetectedEpisode, MatchResult } from "../utils/types";

/** Below this similarity score, a show candidate is not considered at all. */
const MIN_SHOW_SIMILARITY = 0.72;
/**
 * A match is only accepted automatically if the best candidate is clearly
 * ahead of the second-best one. This is the core anti-false-positive
 * safeguard requested by the project spec: "if the result is ambiguous, do
 * not synchronize."
 */
const MIN_LEAD_OVER_RUNNER_UP = 0.08;

function toShow(raw: BsRawShow): BetaSeriesShow {
  return { id: raw.id, title: raw.title, slug: raw.slug };
}

function rankShowCandidates(seriesTitle: string, raw: BsRawShow[]): { show: BetaSeriesShow; score: number }[] {
  return raw
    .map((r) => ({ show: toShow(r), score: titleSimilarity(seriesTitle, r.title) }))
    .filter((c) => c.score >= MIN_SHOW_SIMILARITY)
    .sort((a, b) => b.score - a.score);
}

/**
 * Resolves a DetectedEpisode to a concrete BetaSeries show + episode.
 * Refuses to guess: returns `ambiguous` whenever more than one show is a
 * plausible match, or `not_found` when metadata is incomplete or nothing
 * matches confidently enough.
 */
export async function matchEpisode(detected: DetectedEpisode): Promise<MatchResult> {
  if (!detected.seriesTitle || detected.seasonNumber == null || detected.episodeNumber == null) {
    return { status: "not_found", reason: "Incomplete metadata (missing series title, season or episode)." };
  }

  let rawShows: BsRawShow[];
  try {
    rawShows = await betaSeriesApi.searchShows(detected.seriesTitle);
  } catch (err) {
    return { status: "error", reason: (err as Error).message };
  }

  const ranked = rankShowCandidates(detected.seriesTitle, rawShows);
  if (ranked.length === 0) {
    return { status: "not_found", reason: `No BetaSeries show found for "${detected.seriesTitle}".` };
  }

  const [best, runnerUp] = ranked;
  const isAmbiguous = runnerUp !== undefined && best.score - runnerUp.score < MIN_LEAD_OVER_RUNNER_UP;
  if (isAmbiguous) {
    return {
      status: "ambiguous",
      candidates: ranked.slice(0, 5).map((c) => c.show),
      reason: `Multiple BetaSeries shows match "${detected.seriesTitle}" with similar confidence.`,
    };
  }

  let rawEpisode;
  try {
    rawEpisode = await betaSeriesApi.searchEpisode(best.show.id, detected.seasonNumber, detected.episodeNumber);
  } catch (err) {
    return { status: "error", reason: (err as Error).message, show: best.show };
  }

  if (!rawEpisode) {
    return {
      status: "not_found",
      show: best.show,
      reason: `S${detected.seasonNumber}E${detected.episodeNumber} not found for "${best.show.title}" on BetaSeries.`,
    };
  }

  const episode: BetaSeriesEpisode = {
    id: rawEpisode.id,
    showId: best.show.id,
    season: rawEpisode.season,
    episode: rawEpisode.episode,
    title: rawEpisode.title,
  };

  return { status: "matched", show: best.show, episode };
}
