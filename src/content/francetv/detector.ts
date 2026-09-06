import {
  bestEffortSeasonEpisode,
  extractEmbeddedJson,
  extractJsonLd,
  extractMetaTags,
  findJsonLdByType,
} from "../../detection/strategies";
import type { DetectedEpisode } from "../../utils/types";

/**
 * France.tv episode detector.
 *
 * Same caveat as the other two detectors regarding live verification — see
 * README "Limitations". France Télévisions pages are generally known to
 * emit schema.org JSON-LD for SEO, so the JSON-LD strategy is promoted
 * relative to the other platforms, but embedded-state is still tried first
 * per the requested priority order.
 */

const EMBEDDED_JSON_VARS = ["__data__", "__NEXT_DATA__", "__INITIAL_STATE__"];

export function detectFranceTvEpisode(doc: Document = document, url: string = location.href): DetectedEpisode | null {
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
        platform: "francetv",
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
        platform: "francetv",
        seriesTitle,
        seasonNumber: season,
        episodeNumber: episode,
        url,
        confidence: 0.55,
        detectionMethod: "meta-tags",
      };
    }
  }

  // URL pattern, e.g. france.tv/france-2/programme-name/saison-3/1234567-titre.html
  const urlMatch = url.match(/france\.tv\/[\w-]+\/([\w-]+)\/saison-(\d{1,2})\/\d+-([\w-]+)\.html/i);
  if (urlMatch) {
    return {
      platform: "francetv",
      seriesTitle: slugToTitle(urlMatch[1]),
      seasonNumber: parseInt(urlMatch[2], 10),
      episodeNumber: null,
      episodeTitle: slugToTitle(urlMatch[3]),
      url,
      confidence: 0.3,
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
      (typeof node.season === "number" || typeof node.saison === "number") &&
      (typeof node.episode === "number" || typeof node.numeroEpisode === "number")
    );
  });
  if (!candidate) return null;

  const seriesTitle = candidate.programTitle ?? candidate.program?.label ?? candidate.emission?.titre;
  if (!seriesTitle) return null;

  return {
    platform: "francetv",
    seriesTitle,
    seasonNumber: candidate.season ?? candidate.saison,
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
