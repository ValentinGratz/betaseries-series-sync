import {
  bestEffortSeasonEpisode,
  extractEmbeddedJson,
  extractJsonLd,
  extractMetaTags,
  findJsonLdByType,
} from "../../detection/strategies";
import type { DetectedEpisode } from "../../utils/types";

/**
 * TF1+ (tf1.fr) episode detector.
 *
 * IMPORTANT: this sandbox has no network access to tf1.fr, so the exact
 * DOM/embedded-state shape below could not be verified against the live
 * site. The strategies are implemented in the priority order requested by
 * the spec (embedded JSON > JSON-LD > player metadata > DOM > URL > title),
 * using the hydration patterns most common on modern TF1+/Newen/Salto-style
 * SPA players (window.__NUXT__ / window.__APOLLO_STATE__-like blobs, plus
 * standard schema.org JSON-LD which French broadcasters generally emit for
 * SEO). Field paths inside the embedded JSON are best-effort guesses and
 * MUST be confirmed by inspecting a real page (DevTools > Elements, search
 * for "saison"/"episode", or Sources > look for a large inline <script>)
 * before relying on this in production. See README "Limitations".
 */

const EMBEDDED_JSON_VARS = ["__NUXT__", "__APOLLO_STATE__", "__INITIAL_STATE__"];

export function detectTf1PlusEpisode(doc: Document = document, url: string = location.href): DetectedEpisode | null {
  // Strategy 1: embedded SPA state.
  const embedded = extractEmbeddedJson(EMBEDDED_JSON_VARS, doc);
  if (embedded) {
    const fromEmbedded = tryExtractFromEmbedded(embedded, url);
    if (fromEmbedded) return fromEmbedded;
  }

  // Strategy 2: JSON-LD (TVEpisode / VideoObject).
  const ld = extractJsonLd(doc);
  const episodeNode = findJsonLdByType(ld, ["TVEpisode"]);
  if (episodeNode) {
    const seriesTitle = episodeNode.partOfSeries?.name ?? episodeNode.partOfTVSeries?.name;
    const seasonNumber = toInt(episodeNode.partOfSeason?.seasonNumber);
    const episodeNumber = toInt(episodeNode.episodeNumber);
    if (seriesTitle && seasonNumber != null && episodeNumber != null) {
      return {
        platform: "tf1plus",
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

  // Strategy 3: meta tags (og:title often encodes "Show - Sxx Exx - Title").
  const meta = extractMetaTags(doc);
  const ogTitle = meta["og:title"] ?? doc.title;
  if (ogTitle) {
    const { season, episode } = bestEffortSeasonEpisode(ogTitle, url);
    const seriesTitle = ogTitle.split(/\s[-–|]\s/)[0]?.trim();
    if (seriesTitle && season != null && episode != null) {
      return {
        platform: "tf1plus",
        seriesTitle,
        seasonNumber: season,
        episodeNumber: episode,
        url,
        confidence: 0.55,
        detectionMethod: "meta-tags",
      };
    }
  }

  // Strategy 4: URL pattern, e.g. tf1.fr/tf1/emily-in-paris/videos/s5-e1-....
  const urlMatch = url.match(/tf1\.fr\/[\w-]+\/([\w-]+)\/videos\/.*?s(\d{1,2})[-_]?e(\d{1,3})/i);
  if (urlMatch) {
    return {
      platform: "tf1plus",
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
  // Best-effort walk: look for the first object that "smells like" an
  // episode (has season + episode numeric fields alongside a show/program
  // title). Real field names must be confirmed against a live page.
  const candidate = deepFind(state, (node) => {
    return (
      node &&
      typeof node === "object" &&
      (typeof node.season === "number" || typeof node.saison === "number") &&
      (typeof node.episode === "number" || typeof node.numeroEpisode === "number")
    );
  });
  if (!candidate) return null;

  const seriesTitle = candidate.programTitle ?? candidate.show?.title ?? candidate.serie?.titre;
  if (!seriesTitle) return null;

  return {
    platform: "tf1plus",
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
