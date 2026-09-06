import { BETASERIES_CONFIG } from "./config.local";

/**
 * Thin client around the BetaSeries REST API.
 *
 * Reference: https://developers.betaseries.com/
 *
 * NOTE ON PARAMETER NAMES
 * ------------------------
 * The public documentation site renders its request/response parameter
 * tables client-side, which made it impossible to scrape the exact field
 * names for every endpoint from this environment. The endpoints, HTTP verbs,
 * auth mechanism (X-BetaSeries-Key / X-BetaSeries-Version headers, Bearer
 * token) and general request shape below ARE confirmed against the official
 * docs. The specific query parameter names for `/episodes/search` and the
 * bulk-marking options of `/episodes/watched` are implemented per the
 * documented endpoint *descriptions* and widely-used community clients, but
 * should be double-checked against https://developers.betaseries.com/docs/api
 * (or by inspecting one real request in your browser's network tab while
 * logged into betaseries.com) before relying on them in production. Every
 * such call is isolated in its own method below so adjusting a parameter
 * name is a one-line change.
 */

const API_BASE = "https://api.betaseries.com";
const API_VERSION = "3.4";

export class BetaSeriesApiError extends Error {
  constructor(
    message: string,
    public readonly httpStatus?: number,
    public readonly code?: string | number
  ) {
    super(message);
    this.name = "BetaSeriesApiError";
  }
}

export interface BsRawShow {
  id: number;
  title: string;
  slug?: string;
}

export interface BsRawEpisode {
  id: number;
  show_id?: number;
  season: number;
  episode: number;
  title?: string;
}

interface RequestOptions {
  method?: "GET" | "POST" | "DELETE";
  params?: Record<string, string | number | boolean | undefined>;
  accessToken?: string;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", params = {}, accessToken } = options;

  const url = new URL(API_BASE + path);
  const headers: Record<string, string> = {
    "X-BetaSeries-Key": BETASERIES_CONFIG.apiKey,
    "X-BetaSeries-Version": API_VERSION,
    "User-Agent": "SeriesSync-Extension",
  };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  let body: URLSearchParams | undefined;
  if (method === "GET") {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  } else {
    body = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) body.set(k, String(v));
    }
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), { method, headers, body });
  } catch (err) {
    throw new BetaSeriesApiError(`Network error contacting BetaSeries: ${(err as Error).message}`);
  }

  let json: any;
  try {
    json = await response.json();
  } catch {
    throw new BetaSeriesApiError(`Invalid BetaSeries response (HTTP ${response.status})`, response.status);
  }

  if (!response.ok || (json.errors && json.errors.length > 0)) {
    const firstError = json.errors?.[0];
    throw new BetaSeriesApiError(
      firstError?.text ?? `BetaSeries API error (HTTP ${response.status})`,
      response.status,
      firstError?.code
    );
  }

  return json as T;
}

export const betaSeriesApi = {
  /** POST /oauth/access_token — exchange an authorization code for a token. */
  async exchangeCodeForToken(code: string): Promise<string> {
    const json = await request<{ access_token: string }>("/oauth/access_token", {
      method: "POST",
      params: {
        client_id: BETASERIES_CONFIG.apiKey,
        client_secret: BETASERIES_CONFIG.apiSecret,
        redirect_uri: BETASERIES_CONFIG.redirectUri,
        code,
      },
    });
    return json.access_token;
  },

  /** GET /members/infos — used to verify a token and get the member login. */
  async getMemberLogin(accessToken: string): Promise<string> {
    const json = await request<{ member: { login: string } }>("/members/infos", {
      accessToken,
      params: { fields: "login" },
    });
    return json.member.login;
  },

  /** DELETE /member/destroy — revoke the current token server-side. */
  async destroyToken(accessToken: string): Promise<void> {
    await request("/member/destroy", { method: "DELETE", accessToken });
  },

  /**
   * Show lookup by title. Uses the global search endpoint (`/search/all`),
   * which is confirmed to exist in the docs' Search section, filtered
   * client-side to shows. If your API key has access to `/shows/search`
   * directly, swap the implementation below for that endpoint.
   */
  async searchShows(title: string): Promise<BsRawShow[]> {
    const json = await request<{ shows?: BsRawShow[] }>("/search/all", {
      params: { text: title, fields: "shows.id,shows.title,shows.slug" },
    });
    return json.shows ?? [];
  },

  /** GET /episodes/search — resolve a show/season/episode to a BetaSeries episode id. */
  async searchEpisode(showId: number, season: number, episode: number): Promise<BsRawEpisode | null> {
    const json = await request<{ episode?: BsRawEpisode }>("/episodes/search", {
      params: { thetvdb_id: undefined, id: showId, season, episode },
    });
    return json.episode ?? null;
  },

  /** GET /episodes/list — list all episodes of a show/season (used for history sync). */
  async listSeasonEpisodes(showId: number, season: number): Promise<BsRawEpisode[]> {
    const json = await request<{ episodes?: BsRawEpisode[] }>("/episodes/list", {
      params: { id: showId, season },
    });
    return json.episodes ?? [];
  },

  /** POST /episodes/watched — mark a single episode as watched. */
  async markEpisodeWatched(episodeId: number, accessToken: string): Promise<void> {
    await request("/episodes/watched", {
      method: "POST",
      accessToken,
      params: { id: episodeId },
    });
  },
};
