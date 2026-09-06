import { describe, expect, it } from "vitest";
import { levenshtein, normalizeTitle, parseSeasonEpisode, titleSimilarity } from "../../src/utils/normalize";

describe("normalizeTitle", () => {
  it("lowercases, strips accents, and collapses whitespace", () => {
    expect(normalizeTitle("Émily In Paris")).toBe("emily in paris");
  });

  it("treats hyphens/underscores as spaces", () => {
    expect(normalizeTitle("Emily-in-Paris")).toBe("emily in paris");
    expect(normalizeTitle("Emily_in_Paris")).toBe("emily in paris");
  });

  it("strips apostrophes without inserting a space", () => {
    expect(normalizeTitle("L'Agence")).toBe("lagence");
  });

  it("strips punctuation", () => {
    expect(normalizeTitle("Grey's Anatomy: Origins!")).toBe("greys anatomy origins");
  });
});

describe("titleSimilarity", () => {
  it("is 1 for identical normalized titles", () => {
    expect(titleSimilarity("Emily in Paris", "emily in paris")).toBe(1);
    expect(titleSimilarity("Emily-in-Paris", "Emily in Paris")).toBe(1);
  });

  it("is lower for different titles", () => {
    expect(titleSimilarity("Emily in Paris", "Breaking Bad")).toBeLessThan(0.5);
  });

  it("is 0 when either title is empty", () => {
    expect(titleSimilarity("", "Emily in Paris")).toBe(0);
  });
});

describe("levenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshtein("abc", "abc")).toBe(0);
  });
  it("counts single-character edits", () => {
    expect(levenshtein("abc", "abd")).toBe(1);
    expect(levenshtein("abc", "ab")).toBe(1);
  });
});

describe("parseSeasonEpisode", () => {
  it("parses SxxExx", () => {
    expect(parseSeasonEpisode("Emily in Paris S05E01")).toEqual({ season: 5, episode: 1 });
  });
  it("parses lowercase sXXeXX with no separator", () => {
    expect(parseSeasonEpisode("s5e1")).toEqual({ season: 5, episode: 1 });
  });
  it("parses NxNN pattern", () => {
    expect(parseSeasonEpisode("5x01")).toEqual({ season: 5, episode: 1 });
  });
  it("parses French Saison/Episode wording", () => {
    expect(parseSeasonEpisode("Saison 5 Episode 1")).toEqual({ season: 5, episode: 1 });
  });
  it("returns nulls when nothing matches", () => {
    expect(parseSeasonEpisode("no pattern here")).toEqual({ season: null, episode: null });
  });
});
