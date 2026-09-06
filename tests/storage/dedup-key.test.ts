import { describe, expect, it } from "vitest";
import { dedupKey } from "../../src/storage/dedup-key";
import type { DetectedEpisode } from "../../src/utils/types";

const episode: DetectedEpisode = {
  platform: "m6plus",
  seriesTitle: "Emily in Paris",
  seasonNumber: 5,
  episodeNumber: 1,
  url: "https://www.m6.fr/example",
  confidence: 0.8,
  detectionMethod: "test",
};

describe("dedupKey", () => {
  it("prefers the BetaSeries episode id when available", () => {
    expect(dedupKey(episode, 999)).toBe("bse:999");
  });

  it("produces the same key regardless of title casing/punctuation", () => {
    const variant: DetectedEpisode = { ...episode, seriesTitle: "Emily-in-Paris" };
    expect(dedupKey(episode)).toBe(dedupKey(variant));
  });

  it("differs across platforms for the same show/episode", () => {
    const other: DetectedEpisode = { ...episode, platform: "tf1plus" };
    expect(dedupKey(episode)).not.toBe(dedupKey(other));
  });

  it("differs across season/episode numbers", () => {
    const other: DetectedEpisode = { ...episode, episodeNumber: 2 };
    expect(dedupKey(episode)).not.toBe(dedupKey(other));
  });

  it("falls back to a local key when no BetaSeries id is known", () => {
    expect(dedupKey(episode)).toBe("local:m6plus:emily in paris:s5e1");
  });
});
