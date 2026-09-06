import { BETASERIES_CONFIG } from "./config.local";
import { betaSeriesApi } from "./api";
import { storage } from "../storage/storage";
import type { AuthState } from "../utils/types";

const AUTHORIZE_URL = "https://www.betaseries.com/authorize";

/**
 * Runs the OAuth 2.0 "authorization code" flow using chrome.identity, the
 * standard mechanism for Manifest V3 extensions. Never touches the user's
 * BetaSeries password.
 */
export async function connectBetaSeries(): Promise<AuthState> {
  const redirectUri = chrome.identity.getRedirectURL();

  const authUrl = new URL(AUTHORIZE_URL);
  authUrl.searchParams.set("client_id", BETASERIES_CONFIG.apiKey);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");

  const responseUrl = await new Promise<string>((resolve, reject) => {
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

  const auth: AuthState = {
    connected: true,
    accessToken,
    memberLogin,
    connectedAt: Date.now(),
  };
  await storage.setAuth(auth);
  return auth;
}

export async function disconnectBetaSeries(): Promise<void> {
  const auth = await storage.getAuth();
  if (auth.accessToken) {
    try {
      await betaSeriesApi.destroyToken(auth.accessToken);
    } catch {
      // Best-effort: still clear local state even if the remote call fails
      // (e.g. token already expired).
    }
  }
  await storage.clearAuth();
}

export async function getValidAccessToken(): Promise<string | null> {
  const auth = await storage.getAuth();
  return auth.connected && auth.accessToken ? auth.accessToken : null;
}
