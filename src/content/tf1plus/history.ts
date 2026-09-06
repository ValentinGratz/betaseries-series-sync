import { extractJsonLd } from "../../detection/strategies";
import { parseSeasonEpisode } from "../../utils/normalize";
import type { DetectedEpisode } from "../../utils/types";

/**
 * Attempts to read TF1+'s own "reprendre la lecture" / history UI, when the
 * current page happens to be one that lists it. This is intentionally
 * conservative: if no reliably structured history data is found, it returns
 * `null` (meaning "unavailable"), per the project's "do not invent data"
 * requirement, rather than guessing from partial DOM text.
 *
 * Verified capability: none of TF1+'s actual history page markup could be
 * inspected from this environment (no network access). This function only
 * recognizes a generic, commonly-used pattern (a schema.org ItemList of
 * TVEpisode nodes) and should be revisited once the real history page
 * structure has been confirmed manually.
 */
export function scanTf1PlusHistory(doc: Document = document): DetectedEpisode[] | null {
  const nodes = extractJsonLd(doc);
  const list = nodes.find((n) => n["@type"] === "ItemList" && Array.isArray(n.itemListElement));
  if (!list) return null;

  const episodes: DetectedEpisode[] = [];
  for (const item of list.itemListElement) {
    const ep = item.item ?? item;
    if (ep?.["@type"] !== "TVEpisode") continue;
    const seriesTitle = ep.partOfSeries?.name ?? ep.partOfTVSeries?.name;
    const seasonNumber = ep.partOfSeason?.seasonNumber ?? parseSeasonEpisode(ep.name ?? "").season;
    const episodeNumber = ep.episodeNumber ?? parseSeasonEpisode(ep.name ?? "").episode;
    if (!seriesTitle || seasonNumber == null || episodeNumber == null) continue;
    episodes.push({
      platform: "tf1plus",
      seriesTitle,
      seasonNumber,
      episodeNumber,
      episodeTitle: ep.name,
      url: ep.url ?? location.href,
      confidence: 0.7,
      detectionMethod: "history-json-ld",
    });
  }

  return episodes.length > 0 ? episodes : null;
}
