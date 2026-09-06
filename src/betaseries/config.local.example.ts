// Copy this file to `config.local.ts` (same folder) and fill in your own
// BetaSeries API application credentials. `config.local.ts` is git-ignored
// and must never be committed.
//
// Create an application at: https://www.betaseries.com/api/ (or via the
// "Développer avec l'API" section of your account settings) to obtain a
// client id (API key) and client secret.

export const BETASERIES_CONFIG = {
  /** Your BetaSeries API key (a.k.a. client_id). */
  apiKey: "89703e61f3e7",
  /** Your BetaSeries API application secret. Used only for the OAuth code
   *  exchange, performed by the extension's background service worker. */
  apiSecret: "9efc88a783b21cffcfc0e8791eaf6e48",
  /** Must match the redirect URI registered for your application. For a
   *  Chrome/Edge extension, use the identity redirect URL, e.g. the value
   *  returned by chrome.identity.getRedirectURL(). */
  redirectUri: "https://hnadkcjplcnokhkcfpdfdblojaceajcp.chromiumapp.org/",
};
