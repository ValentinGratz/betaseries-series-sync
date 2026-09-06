// Shared type definitions used across the extension.

export type Platform = "tf1plus" | "m6plus" | "francetv";

/** Normalized episode information extracted from a streaming platform page. */
export interface DetectedEpisode {
  platform: Platform;
  seriesTitle: string;
  seasonNumber: number | null;
  episodeNumber: number | null;
  episodeTitle?: string;
  url: string;
  confidence: number; // 0..1
  detectionMethod: string;
}

/** A BetaSeries show, as returned by /shows/search or /search/all. */
export interface BetaSeriesShow {
  id: number;
  title: string;
  slug?: string;
}

/** A BetaSeries episode, as returned by /episodes/search or /episodes/list. */
export interface BetaSeriesEpisode {
  id: number;
  showId: number;
  season: number;
  episode: number;
  title?: string;
}

/** Result of trying to resolve a DetectedEpisode to a concrete BetaSeries episode. */
export interface MatchResult {
  status: "matched" | "ambiguous" | "not_found" | "error";
  episode?: BetaSeriesEpisode;
  show?: BetaSeriesShow;
  candidates?: BetaSeriesShow[];
  reason?: string;
}

/** Local record of a synchronization attempt, used for dedup + UI history. */
export interface SyncRecord {
  key: string; // stable dedup key, see storage/dedup-key.ts
  platform: Platform;
  seriesTitle: string;
  seasonNumber: number | null;
  episodeNumber: number | null;
  betaSeriesEpisodeId?: number;
  status: "success" | "skipped" | "ambiguous" | "error" | "simulated";
  message?: string;
  timestamp: number;
}

export interface ExtensionSettings {
  enabledPlatforms: Record<Platform, boolean>;
  watchThreshold: 70 | 80 | 90 | 100;
  simulationMode: boolean;
  debugLogging: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enabledPlatforms: {
    tf1plus: true,
    m6plus: true,
    francetv: true,
  },
  watchThreshold: 80,
  simulationMode: false,
  debugLogging: false,
};

export interface AuthState {
  connected: boolean;
  accessToken?: string;
  memberLogin?: string;
  connectedAt?: number;
}

export interface LogEntry {
  level: "info" | "warn" | "error";
  message: string;
  timestamp: number;
}

export interface HistorySyncPlatformResult {
  platform: Platform;
  detected: number;
  synchronized: number;
  unidentified: number;
  unavailable?: boolean;
  unavailableReason?: string;
}
