import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BetaSeriesApiError, betaSeriesApi } from "../../src/betaseries/api";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
}

describe("betaSeriesApi", () => {
  it("throws BetaSeriesApiError when the API returns an errors array", async () => {
    mockFetchOnce({ errors: [{ text: "Invalid token", code: 401 }] }, false, 401);

    await expect(betaSeriesApi.getMemberLogin("bad-token")).rejects.toThrow(BetaSeriesApiError);
  });

  it("throws BetaSeriesApiError when the response body is not valid JSON", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("Unexpected token");
      },
    }) as unknown as typeof fetch;

    await expect(betaSeriesApi.getMemberLogin("token")).rejects.toThrow(BetaSeriesApiError);
  });

  it("wraps network failures in BetaSeriesApiError instead of leaking raw fetch errors", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(betaSeriesApi.getMemberLogin("token")).rejects.toThrow(BetaSeriesApiError);
  });

  it("returns an empty array (not a throw) when a show search finds nothing", async () => {
    mockFetchOnce({ errors: [] });
    const shows = await betaSeriesApi.searchShows("Some Unknown Show");
    expect(shows).toEqual([]);
  });

  it("resolves member login on a successful response", async () => {
    mockFetchOnce({ member: { login: "valentin" }, errors: [] });
    const login = await betaSeriesApi.getMemberLogin("token");
    expect(login).toBe("valentin");
  });
});
