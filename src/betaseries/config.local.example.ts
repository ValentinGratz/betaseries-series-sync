// Copy this file to `config.local.ts` (same folder) and fill in your own
// BetaSeries API application credentials. `config.local.ts` is git-ignored
// and must never be committed.
//
// Create an application at: https://www.betaseries.com/api/ (or via the
// "Développer avec l'API" section of your account settings) to obtain a
// client id (API key) and client secret.

export const BETASERIES_CONFIG = {
  /** Your BetaSeries API key (a.k.a. client_id). */
  apiKey: "YOUR_BETASERIES_API_KEY",
  /** Your BetaSeries API application secret. Used only for the OAuth code
   *  exchange, performed by the extension's background service worker. */
  apiSecret: "YOUR_BETASERIES_API_SECRET",
  /** Must match the redirect URI registered for your application. For a
   *  Chrome/Edge extension, use the identity redirect URL, e.g. the value
   *  returned by chrome.identity.getRedirectURL(). */
  redirectUri: "https://<extension-id>.chromiumapp.org/",
};
