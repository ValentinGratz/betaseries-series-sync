/**
 * Normalizes a series/show title for fuzzy comparison:
 * lowercase, strip accents, replace punctuation/hyphens/underscores with
 * spaces, collapse whitespace.
 */
export function normalizeTitle(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .toLowerCase()
    .replace(/['’‘`´]/g, "") // apostrophes
    .replace(/[-_]+/g, " ") // hyphens/underscores -> space
    .replace(/[^a-z0-9\s]/g, " ") // remaining punctuation -> space
    .replace(/\s+/g, " ")
    .trim();
}

/** Levenshtein distance, used as a similarity fallback for title matching. */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

/** Similarity score in [0, 1], 1 = identical normalized titles. */
export function titleSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (na === nb) return 1;
  if (!na.length || !nb.length) return 0;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return 1 - dist / maxLen;
}

/**
 * Parses common "SxxExx" / "Saison X Episode Y" / "1x04" patterns out of a
 * string (title, URL segment, etc). Returns null fields when not found.
 */
export function parseSeasonEpisode(
  text: string
): { season: number | null; episode: number | null } {
  const patterns: RegExp[] = [
    /s(?:aison)?\s*(\d{1,3})\D{0,5}e(?:pisode)?\s*(\d{1,4})/i, // S05E01, Saison 5 Episode 1
    /(\d{1,3})x(\d{1,4})/i, // 5x01
    /saison[\s-]*(\d{1,3})[^\d]{0,10}episode[\s-]*(\d{1,4})/i,
  ];
  for (const re of patterns) {
    const match = text.match(re);
    if (match) {
      return { season: parseInt(match[1], 10), episode: parseInt(match[2], 10) };
    }
  }
  return { season: null, episode: null };
}
