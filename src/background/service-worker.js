// src/betaseries/config.local.ts
var BETASERIES_CONFIG = {
  /** Your BetaSeries API key (a.k.a. client_id). */
  apiKey: "89703e61f3e7",
  /** Your BetaSeries API application secret. Used only for the OAuth code
   *  exchange, performed by the extension's background service worker. */
  apiSecret: "9efc88a783b21cffcfc0e8791eaf6e48",
  /** Must match the redirect URI registered for your application. For a
   *  Chrome/Edge extension, use the identity redirect URL, e.g. the value
   *  returned by chrome.identity.getRedirectURL(). */
  redirectUri: "https://hnadkcjplcnokhkcfpdfdblojaceajcp.chromiumapp.org/"
};

// src/betaseries/api.ts
var API_BASE = "https://api.betaseries.com";
var API_VERSION = "3.4";
var BetaSeriesApiError = class extends Error {
  constructor(message, httpStatus, code) {
    super(message);
    this.httpStatus = httpStatus;
    this.code = code;
    this.name = "BetaSeriesApiError";
  }
};
async function request(path, options = {}) {
  const { method = "GET", params = {}, accessToken } = options;
  const url = new URL(API_BASE + path);
  const headers = {
    "X-BetaSeries-Key": BETASERIES_CONFIG.apiKey,
    "X-BetaSeries-Version": API_VERSION,
    "User-Agent": "SeriesSync-Extension"
  };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  let body;
  if (method === "GET") {
    for (const [k, v] of Object.entries(params)) {
      if (v !== void 0) url.searchParams.set(k, String(v));
    }
  } else {
    body = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== void 0) body.set(k, String(v));
    }
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }
  let response;
  try {
    response = await fetch(url.toString(), { method, headers, body });
  } catch (err) {
    throw new BetaSeriesApiError(`Network error contacting BetaSeries: ${err.message}`);
  }
  let json;
  try {
    json = await response.json();
  } catch {
    throw new BetaSeriesApiError(`Invalid BetaSeries response (HTTP ${response.status})`, response.status);
  }
  if (!response.ok || json.errors && json.errors.length > 0) {
    const firstError = json.errors?.[0];
    throw new BetaSeriesApiError(
      firstError?.text ?? `BetaSeries API error (HTTP ${response.status})`,
      response.status,
      firstError?.code
    );
  }
  return json;
}
var betaSeriesApi = {
  /** POST /oauth/access_token — exchange an authorization code for a token. */
  async exchangeCodeForToken(code) {
    const json = await request("/oauth/access_token", {
      method: "POST",
      params: {
        client_id: BETASERIES_CONFIG.apiKey,
        client_secret: BETASERIES_CONFIG.apiSecret,
        redirect_uri: BETASERIES_CONFIG.redirectUri,
        code
      }
    });
    return json.access_token;
  },
  /** GET /members/infos — used to verify a token and get the member login. */
  async getMemberLogin(accessToken) {
    const json = await request("/members/infos", {
      accessToken,
      params: { fields: "login" }
    });
    return json.member.login;
  },
  /** DELETE /member/destroy — revoke the current token server-side. */
  async destroyToken(accessToken) {
    await request("/member/destroy", { method: "DELETE", accessToken });
  },
  /**
   * Show lookup by title. Uses the global search endpoint (`/search/all`),
   * which is confirmed to exist in the docs' Search section, filtered
   * client-side to shows. If your API key has access to `/shows/search`
   * directly, swap the implementation below for that endpoint.
   */
  async searchShows(title) {
    const json = await request("/search/all", {
      params: { text: title, fields: "shows.id,shows.title,shows.slug" }
    });
    return json.shows ?? [];
  },
  /** GET /episodes/search — resolve a show/season/episode to a BetaSeries episode id. */
  async searchEpisode(showId, season, episode) {
    const json = await request("/episodes/search", {
      params: { thetvdb_id: void 0, id: showId, season, episode }
    });
    return json.episode ?? null;
  },
  /** GET /episodes/list — list all episodes of a show/season (used for history sync). */
  async listSeasonEpisodes(showId, season) {
    const json = await request("/episodes/list", {
      params: { id: showId, season }
    });
    return json.episodes ?? [];
  },
  /** POST /episodes/watched — mark a single episode as watched. */
  async markEpisodeWatched(episodeId, accessToken) {
    await request("/episodes/watched", {
      method: "POST",
      accessToken,
      params: { id: episodeId }
    });
  }
};

// src/utils/types.ts
var DEFAULT_SETTINGS = {
  enabledPlatforms: {
    tf1plus: true,
    m6plus: true,
    francetv: true
  },
  watchThreshold: 80,
  simulationMode: false,
  debugLogging: false
};

// src/storage/storage.ts
var KEYS = {
  auth: "ss_auth",
  settings: "ss_settings",
  syncRecords: "ss_sync_records",
  logs: "ss_logs"
};
var MAX_SYNC_RECORDS = 500;
var MAX_LOGS = 300;
function get(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => resolve(result[key]));
  });
}
function set(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, () => resolve());
  });
}
var storage = {
  async getAuth() {
    return await get(KEYS.auth) ?? { connected: false };
  },
  async setAuth(auth) {
    await set(KEYS.auth, auth);
  },
  async clearAuth() {
    await set(KEYS.auth, { connected: false });
  },
  async getSettings() {
    const stored = await get(KEYS.settings);
    return { ...DEFAULT_SETTINGS, ...stored };
  },
  async setSettings(settings) {
    await set(KEYS.settings, settings);
  },
  /** Dedup lookup: has this episode key already been synchronized? */
  async hasSynced(key) {
    const records = await get(KEYS.syncRecords);
    return !!records?.[key] && records[key].status === "success";
  },
  async recordSync(record) {
    const records = await get(KEYS.syncRecords) ?? {};
    records[record.key] = record;
    const entries = Object.entries(records);
    if (entries.length > MAX_SYNC_RECORDS) {
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp).slice(0, entries.length - MAX_SYNC_RECORDS).forEach(([k]) => delete records[k]);
    }
    await set(KEYS.syncRecords, records);
  },
  async getRecentSyncs(limit = 20) {
    const records = await get(KEYS.syncRecords) ?? {};
    return Object.values(records).sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  },
  async appendLog(entry) {
    const logs = await get(KEYS.logs) ?? [];
    logs.push(entry);
    while (logs.length > MAX_LOGS) logs.shift();
    await set(KEYS.logs, logs);
  },
  async getLogs() {
    return await get(KEYS.logs) ?? [];
  },
  async clearLogs() {
    await set(KEYS.logs, []);
  }
};

// src/betaseries/auth.ts
var AUTHORIZE_URL = "https://www.betaseries.com/authorize";
async function connectBetaSeries() {
  const redirectUri = chrome.identity.getRedirectURL();
  const authUrl = new URL(AUTHORIZE_URL);
  authUrl.searchParams.set("client_id", BETASERIES_CONFIG.apiKey);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  const responseUrl = await new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl.toString(), interactive: true },
      (result) => {
        if (chrome.runtime.lastError || !result) {
          reject(new Error(chrome.runtime.lastError?.message ?? "Authorization was cancelled."));
          return;
        }
        resolve(result);
      }
    );
  });
  const code = new URL(responseUrl).searchParams.get("code");
  if (!code) {
    throw new Error("BetaSeries did not return an authorization code.");
  }
  const accessToken = await betaSeriesApi.exchangeCodeForToken(code);
  const memberLogin = await betaSeriesApi.getMemberLogin(accessToken);
  const auth = {
    connected: true,
    accessToken,
    memberLogin,
    connectedAt: Date.now()
  };
  await storage.setAuth(auth);
  return auth;
}
async function disconnectBetaSeries() {
  const auth = await storage.getAuth();
  if (auth.accessToken) {
    try {
      await betaSeriesApi.destroyToken(auth.accessToken);
    } catch {
    }
  }
  await storage.clearAuth();
}
async function getValidAccessToken() {
  const auth = await storage.getAuth();
  return auth.connected && auth.accessToken ? auth.accessToken : null;
}

// src/utils/normalize.ts
function normalizeTitle(raw) {
  return raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/['’‘`´]/g, "").replace(/[-_]+/g, " ").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function levenshtein(a, b) {
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
function titleSimilarity(a, b) {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (na === nb) return 1;
  if (!na.length || !nb.length) return 0;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return 1 - dist / maxLen;
}

// src/betaseries/matcher.ts
var MIN_SHOW_SIMILARITY = 0.72;
var MIN_LEAD_OVER_RUNNER_UP = 0.08;
function toShow(raw) {
  return { id: raw.id, title: raw.title, slug: raw.slug };
}
function rankShowCandidates(seriesTitle, raw) {
  return raw.map((r) => ({ show: toShow(r), score: titleSimilarity(seriesTitle, r.title) })).filter((c) => c.score >= MIN_SHOW_SIMILARITY).sort((a, b) => b.score - a.score);
}
async function matchEpisode(detected) {
  if (!detected.seriesTitle || detected.seasonNumber == null || detected.episodeNumber == null) {
    return { status: "not_found", reason: "Incomplete metadata (missing series title, season or episode)." };
  }
  let rawShows;
  try {
    rawShows = await betaSeriesApi.searchShows(detected.seriesTitle);
  } catch (err) {
    return { status: "error", reason: err.message };
  }
  const ranked = rankShowCandidates(detected.seriesTitle, rawShows);
  if (ranked.length === 0) {
    return { status: "not_found", reason: `No BetaSeries show found for "${detected.seriesTitle}".` };
  }
  const [best, runnerUp] = ranked;
  const isAmbiguous = runnerUp !== void 0 && best.score - runnerUp.score < MIN_LEAD_OVER_RUNNER_UP;
  if (isAmbiguous) {
    return {
      status: "ambiguous",
      candidates: ranked.slice(0, 5).map((c) => c.show),
      reason: `Multiple BetaSeries shows match "${detected.seriesTitle}" with similar confidence.`
    };
  }
  let rawEpisode;
  try {
    rawEpisode = await betaSeriesApi.searchEpisode(best.show.id, detected.seasonNumber, detected.episodeNumber);
  } catch (err) {
    return { status: "error", reason: err.message, show: best.show };
  }
  if (!rawEpisode) {
    return {
      status: "not_found",
      show: best.show,
      reason: `S${detected.seasonNumber}E${detected.episodeNumber} not found for "${best.show.title}" on BetaSeries.`
    };
  }
  const episode = {
    id: rawEpisode.id,
    showId: best.show.id,
    season: rawEpisode.season,
    episode: rawEpisode.episode,
    title: rawEpisode.title
  };
  return { status: "matched", show: best.show, episode };
}

// src/storage/dedup-key.ts
function dedupKey(episode, betaSeriesEpisodeId) {
  if (betaSeriesEpisodeId) {
    return `bse:${betaSeriesEpisodeId}`;
  }
  const title = normalizeTitle(episode.seriesTitle);
  return `local:${episode.platform}:${title}:s${episode.seasonNumber ?? "x"}e${episode.episodeNumber ?? "x"}`;
}

// src/background/sync-service.ts
async function log(level, message) {
  await storage.appendLog({ level, message, timestamp: Date.now() });
  const settings = await storage.getSettings();
  if (settings.debugLogging) {
    console[level === "error" ? "error" : "log"](`[SeriesSync] ${message}`);
  }
}
async function processWatchedCandidate(detected) {
  const settings = await storage.getSettings();
  if (!settings.enabledPlatforms[detected.platform]) {
    return finish(detected, "skipped", "Platform disabled in settings.");
  }
  const preliminaryKey = dedupKey(detected);
  if (await storage.hasSynced(preliminaryKey)) {
    return finish(detected, "skipped", "Already synchronized (local dedup).", preliminaryKey);
  }
  await log("info", `Detected: ${detected.platform} \u2014 ${detected.seriesTitle} S${detected.seasonNumber}E${detected.episodeNumber} (${detected.detectionMethod})`);
  const match = await matchEpisode(detected);
  if (match.status === "ambiguous") {
    await log("warn", `Ambiguous match \u2014 synchronization skipped for "${detected.seriesTitle}".`);
    return finish(detected, "ambiguous", match.reason, preliminaryKey);
  }
  if (match.status === "not_found") {
    await log("warn", `Could not identify episode: ${match.reason}`);
    return finish(detected, "error", match.reason, preliminaryKey);
  }
  if (match.status === "error") {
    await log("error", `BetaSeries error: ${match.reason}`);
    return finish(detected, "error", match.reason, preliminaryKey);
  }
  const episode = match.episode;
  const finalKey = dedupKey(detected, episode.id);
  if (await storage.hasSynced(finalKey)) {
    return finish(detected, "skipped", "Already synchronized (BetaSeries id dedup).", finalKey, episode.id);
  }
  if (settings.simulationMode) {
    await log("info", `SIMULATION \u2014 would mark as watched: ${match.show?.title} S${episode.season}E${episode.episode} (BetaSeries episode id ${episode.id})`);
    return finish(detected, "simulated", `Would synchronize BetaSeries episode ${episode.id}.`, finalKey, episode.id);
  }
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    await log("warn", "BetaSeries authentication expired or missing.");
    return finish(detected, "error", "Not connected to BetaSeries.", finalKey, episode.id);
  }
  try {
    await betaSeriesApi.markEpisodeWatched(episode.id, accessToken);
  } catch (err) {
    await log("error", `BetaSeries API unavailable or rejected the request: ${err.message}`);
    return finish(detected, "error", err.message, finalKey, episode.id);
  }
  await log("info", `Episode marked as watched: ${match.show?.title} S${episode.season}E${episode.episode}`);
  return finish(detected, "success", "Synchronized.", finalKey, episode.id);
}
async function finish(detected, status, message, key = dedupKey(detected), betaSeriesEpisodeId) {
  const record = {
    key,
    platform: detected.platform,
    seriesTitle: detected.seriesTitle,
    seasonNumber: detected.seasonNumber,
    episodeNumber: detected.episodeNumber,
    betaSeriesEpisodeId,
    status,
    message,
    timestamp: Date.now()
  };
  await storage.recordSync(record);
  return record;
}

// src/background/service-worker.ts
chrome.runtime.onInstalled.addListener(async () => {
  const settings = await storage.getSettings();
  await storage.setSettings(settings);
});
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse).catch((err) => sendResponse({ error: err.message }));
  return true;
});
async function handleMessage(message) {
  switch (message.type) {
    case "EPISODE_WATCHED_CANDIDATE":
      return processWatchedCandidate(message.episode);
    case "HISTORY_EPISODES_FOUND": {
      const results = [];
      for (const episode of message.episodes) {
        results.push(await processWatchedCandidate(episode));
      }
      return { results };
    }
    case "CONNECT_BETASERIES":
      return connectBetaSeries();
    case "DISCONNECT_BETASERIES":
      await disconnectBetaSeries();
      return { ok: true };
    case "GET_AUTH_STATE":
      return storage.getAuth();
    case "GET_SETTINGS":
      return storage.getSettings();
    case "SET_SETTINGS":
      await storage.setSettings(message.settings);
      return { ok: true };
    case "GET_RECENT_SYNCS":
      return { records: await storage.getRecentSyncs() };
    case "GET_LOGS":
      return { logs: await storage.getLogs() };
    case "CLEAR_LOGS":
      await storage.clearLogs();
      return { ok: true };
    case "REQUEST_HISTORY_SYNC": {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return { ok: false, reason: "No active tab." };
      return chrome.tabs.sendMessage(tab.id, { type: "SCAN_HISTORY" });
    }
    case "SYNC_NOW":
      return { ok: true };
    default:
      return { error: "Unknown message type." };
  }
}
//# sourceMappingURL=service-worker.js.map
