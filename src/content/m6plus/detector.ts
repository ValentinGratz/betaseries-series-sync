import {
  bestEffortSeasonEpisode,
  extractEmbeddedJson,
  extractJsonLd,
  extractMetaTags,
  findJsonLdByType,
} from "../../detection/strategies";
import type { DetectedEpisode } from "../../utils/types";

/**
 * M6+ (m6.fr / legacy 6play.fr) episode detector.
 *
 * Same caveat as the TF1+ detector: no live network access to m6.fr/6play.fr
 * from this environment. Strategies follow the same priority order; field
 * names for the embedded-JSON strategy are best-effort and should be
 * confirmed against the live site before production use.
 */

const EMBEDDED_JSON_VARS = ["__NUXT__", "__6PLAY_STATE__", "__INITIAL_STATE__"];

export function detectM6PlusEpisode(doc: Document = document, url: string = location.href): DetectedEpisode | null {
  const embedded = extractEmbeddedJson(EMBEDDED_JSON_VARS, doc);
  if (embedded) {
    const found = tryExtractFromEmbedded(embedded, url);
    if (found) return found;
  }

  const ld = extractJsonLd(doc);
  const episodeNode = findJsonLdByType(ld, ["TVEpisode"]);
  if (episodeNode) {
    const seriesTitle = episodeNode.partOfSeries?.name ?? episodeNode.partOfTVSeries?.name;
    const seasonNumber = toInt(episodeNode.partOfSeason?.seasonNumber);
    const episodeNumber = toInt(episodeNode.episodeNumber);
    if (seriesTitle && seasonNumber != null && episodeNumber != null) {
      return {
        platform: "m6plus",
        seriesTitle,
        seasonNumber,
        episodeNumber,
        episodeTitle: episodeNode.name,
        url,
        confidence: 0.85,
        detectionMethod: "json-ld",
      };
    }
  }

  const meta = extractMetaTags(doc);
  const ogTitle = meta["og:title"] ?? doc.title;
  if (ogTitle) {
    const { season, episode } = bestEffortSeasonEpisode(ogTitle, url);
    const seriesTitle = ogTitle.split(/\s[-–|]\s/)[0]?.trim();
    if (seriesTitle && season != null && episode != null) {
      return {
        platform: "m6plus",
        seriesTitle,
        seasonNumber: season,
        episodeNumber: episode,
        url,
        confidence: 0.55,
        detectionMethod: "meta-tags",
      };
    }
  }

  // URL pattern, e.g. m6.fr/programme-name/s2/e5-title or 6play.fr equivalents.
  const urlMatch = url.match(/(?:m6|6play)\.fr\/([\w-]+)\/.*?s(\d{1,2})[-_/]?e(\d{1,3})/i);
  if (urlMatch) {
    return {
      platform: "m6plus",
      seriesTitle: slugToTitle(urlMatch[1]),
      seasonNumber: parseInt(urlMatch[2], 10),
      episodeNumber: parseInt(urlMatch[3], 10),
      url,
      confidence: 0.4,
      detectionMethod: "url-pattern",
    };
  }

  return null;
}

function tryExtractFromEmbedded(state: any, url: string): DetectedEpisode | null {
  const candidate = deepFind(state, (node) => {
    return (
      node &&
      typeof node === "object" &&
      (typeof node.season === "number" || typeof node.numeroSaison === "number") &&
      (typeof node.episode === "number" || typeof node.numeroEpisode === "number")
    );
  });
  if (!candidate) return null;

  const seriesTitle = candidate.programTitle ?? candidate.program?.title ?? candidate.emission?.titre;
  if (!seriesTitle) return null;

  return {
    platform: "m6plus",
    seriesTitle,
    seasonNumber: candidate.season ?? candidate.numeroSaison,
    episodeNumber: candidate.episode ?? candidate.numeroEpisode,
    episodeTitle: candidate.title ?? candidate.titre,
    url,
    confidence: 0.9,
    detectionMethod: "embedded-json",
  };
}

function deepFind(node: any, predicate: (n: any) => boolean, depth = 0, seen = new Set<any>()): any | null {
  if (depth > 6 || node == null || typeof node !== "object" || seen.has(node)) return null;
  seen.add(node);
  if (predicate(node)) return node;
  for (const value of Object.values(node)) {
    if (value && typeof value === "object") {
      const found = deepFind(value, predicate, depth + 1, seen);
      if (found) return found;
    }
  }
  return null;
}

function toInt(v: unknown): number | null {
  const n = typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

function slugToTitle(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
