import { parseSeasonEpisode } from "../utils/normalize";

/** Returns every JSON-LD object embedded in the page (script[type=application/ld+json]). */
export function extractJsonLd(doc: Document = document): any[] {
  const results: any[] = [];
  doc.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
    try {
      const parsed = JSON.parse(el.textContent ?? "");
      if (Array.isArray(parsed)) results.push(...parsed);
      else if (parsed["@graph"]) results.push(...parsed["@graph"]);
      else results.push(parsed);
    } catch {
      // Malformed JSON-LD blocks are common in the wild; skip silently.
    }
  });
  return results;
}

/** Finds the first JSON-LD node whose @type matches one of the given types. */
export function findJsonLdByType(nodes: any[], types: string[]): any | null {
  const wanted = types.map((t) => t.toLowerCase());
  for (const node of nodes) {
    const nodeTypes = Array.isArray(node?.["@type"]) ? node["@type"] : [node?.["@type"]];
    if (nodeTypes.some((t: string) => wanted.includes(String(t).toLowerCase()))) {
      return node;
    }
  }
  return null;
}

/**
 * Scans all inline <script> tags for a JSON blob assigned to one of the
 * given global variable names (e.g. window.__NUXT__, window.__NEXT_DATA__,
 * window.__INITIAL_STATE__) — a very common SPA hydration pattern — and
 * returns the parsed object.
 */
export function extractEmbeddedJson(varNames: string[], doc: Document = document): any | null {
  const scripts = Array.from(doc.querySelectorAll("script:not([src])"));
  for (const script of scripts) {
    const text = script.textContent ?? "";
    for (const name of varNames) {
      const marker = `${name}=`;
      const idx = text.indexOf(marker);
      if (idx === -1) continue;
      const jsonStart = text.indexOf("{", idx);
      if (jsonStart === -1) continue;
      const candidate = extractBalancedJson(text, jsonStart);
      if (!candidate) continue;
      try {
        return JSON.parse(candidate);
      } catch {
        // Try the next occurrence/variable.
      }
    }
  }
  // Also check window.<name> assignments already applied to the live page
  // (useful when the framework has hydrated by the time we scan).
  for (const name of varNames) {
    const value = (window as unknown as Record<string, unknown>)[name];
    if (value && typeof value === "object") return value;
  }
  return null;
}

/** Extracts a balanced {...} JSON substring starting at `startIndex`. */
function extractBalancedJson(text: string, startIndex: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(startIndex, i + 1);
    }
  }
  return null;
}

/** Reads common meta tags (Open Graph, Twitter, generic) into a flat map. */
export function extractMetaTags(doc: Document = document): Record<string, string> {
  const map: Record<string, string> = {};
  doc.querySelectorAll("meta[property], meta[name]").forEach((el) => {
    const key = el.getAttribute("property") ?? el.getAttribute("name");
    const value = el.getAttribute("content");
    if (key && value) map[key] = value;
  });
  return map;
}

/** Best-effort season/episode extraction from the document title and URL. */
export function seasonEpisodeFromTitleAndUrl(title: string, url: string) {
  return parseSeasonEpisode(title) ?? parseSeasonEpisode(url);
}

export function bestEffortSeasonEpisode(title: string, url: string) {
  const fromTitle = parseSeasonEpisode(title);
  if (fromTitle.season != null && fromTitle.episode != null) return fromTitle;
  return parseSeasonEpisode(url);
}
