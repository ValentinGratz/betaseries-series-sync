import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DetectedEpisode } from "../../src/utils/types";

vi.mock("../../src/betaseries/api", () => ({
  betaSeriesApi: {
    searchShows: vi.fn(),
    searchEpisode: vi.fn(),
  },
}));

import { betaSeriesApi } from "../../src/betaseries/api";
import { matchEpisode } from "../../src/betaseries/matcher";

const baseEpisode: DetectedEpisode = {
  platform: "tf1plus",
  seriesTitle: "Emily in Paris",
  seasonNumber: 5,
  episodeNumber: 1,
  url: "https://www.tf1.fr/example",
  confidence: 0.9,
  detectionMethod: "test",
};

describe("matchEpisode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns not_found when metadata is incomplete", async () => {
    const result = await matchEpisode({ ...baseEpisode, seasonNumber: null });
    expect(result.status).toBe("not_found");
    expect(betaSeriesApi.searchShows).not.toHaveBeenCalled();
  });

  it("matches a single clear show candidate and resolves the episode", async () => {
    (betaSeriesApi.searchShows as any).mockResolvedValue([{ id: 42, title: "Emily in Paris" }]);
    (betaSeriesApi.searchEpisode as any).mockResolvedValue({ id: 999, season: 5, episode: 1, title: "Pilot" });

    const result = await matchEpisode(baseEpisode);

    expect(result.status).toBe("matched");
    expect(result.episode?.id).toBe(999);
    expect(result.show?.id).toBe(42);
  });

  it("refuses to guess when two shows score too closely (ambiguous)", async () => {
    (betaSeriesApi.searchShows as any).mockResolvedValue([
      { id: 1, title: "Emily in Paris" },
      { id: 2, title: "Emily in Parys" }, // near-identical title, close score
    ]);

    const result = await matchEpisode(baseEpisode);

    expect(result.status).toBe("ambiguous");
    expect(betaSeriesApi.searchEpisode).not.toHaveBeenCalled();
  });

  it("returns not_found when no show clears the similarity threshold", async () => {
    (betaSeriesApi.searchShows as any).mockResolvedValue([{ id: 1, title: "Completely Different Show" }]);

    const result = await matchEpisode(baseEpisode);

    expect(result.status).toBe("not_found");
  });

  it("returns not_found when the show matches but the season/episode does not exist", async () => {
    (betaSeriesApi.searchShows as any).mockResolvedValue([{ id: 42, title: "Emily in Paris" }]);
    (betaSeriesApi.searchEpisode as any).mockResolvedValue(null);

    const result = await matchEpisode(baseEpisode);

    expect(result.status).toBe("not_found");
    expect(result.show?.id).toBe(42);
  });

  it("surfaces API errors as status 'error' rather than throwing", async () => {
    (betaSeriesApi.searchShows as any).mockRejectedValue(new Error("network down"));

    const result = await matchEpisode(baseEpisode);

    expect(result.status).toBe("error");
    expect(result.reason).toMatch(/network down/);
  });
});
