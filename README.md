# SeriesSync

SeriesSync is a Chrome/Edge (Manifest V3) extension that automatically marks
episodes as watched on your [BetaSeries](https://www.betaseries.com) account
when you watch them on **TF1+**, **M6+**, or **France.tv** — without having
to open BetaSeries and check the box yourself.

It is an independent project built against the official
[BetaSeries API](https://developers.betaseries.com/). It does not use or
copy any code from the existing BetaSeries browser extension.

## Features

- **Automatic detection** of the series/season/episode you're watching, using
  several fallback strategies per platform (embedded page state, schema.org
  JSON-LD, meta tags, URL patterns).
- **Playback-based triggering**: an episode is only synced once you've
  watched a configurable percentage of it (default 80%, choose 70/80/90/100%)
  or the player fires `ended`. **Opening an episode page never marks it as
  watched by itself.**
- **BetaSeries matching with safety rails**: titles are normalized (accents,
  punctuation, hyphens, case) before comparison, and if two shows match with
  similar confidence, SeriesSync refuses to guess and skips the sync instead
  ("⚠ Ambiguous match — synchronization skipped").
- **Duplicate prevention**: every sync is recorded locally, keyed primarily
  by the BetaSeries episode id, so the same episode is never sent twice.
- **Simulation mode**: see exactly what would be synchronized (including the
  resolved BetaSeries episode id) without ever calling the "mark as watched"
  endpoint. Recommended for first-time setup.
- **History sync**: a "Synchronize my existing history" action that inspects
  what each platform's page exposes and reports per platform how many
  episodes were detected/synchronized/unidentified — or reports the feature
  as unavailable if the platform doesn't expose enough data, rather than
  inventing results.
- **Diagnostic log** (toggleable debug logging) and a simple popup/options UI.
- Minimal permissions: no `<all_urls>`, no analytics, no password storage.

<img width="381" height="509" alt="image" src="https://github.com/user-attachments/assets/99d3ce55-c14a-48da-9167-3a84b68b01c0" />


## Installation (from source)

### Prerequisites

- Node.js 18+
- A BetaSeries account
- A BetaSeries API application (see [BetaSeries configuration](#betaseries-configuration))

### Build

```bash
npm install
npm run build
```

This produces a ready-to-load extension in `dist/`.

### Load in Chrome

1. Go to `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select the `dist/` folder

### Load in Edge

1. Go to `edge://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `dist/` folder

## Development

```bash
npm run build       # type-check + esbuild bundle into dist/
npm run test        # run the unit test suite (vitest)
npm run test:watch  # watch mode
```

There is no separate dev-server step: content scripts and the service worker
must be plain bundled files for Manifest V3, so `npm run build` is the single
build entry point. Re-run it after each change and reload the unpacked
extension in `chrome://extensions/`.

## BetaSeries configuration

SeriesSync needs its own BetaSeries API application (client id + secret) to
perform the OAuth flow. To create one:

1. Log into [betaseries.com](https://www.betaseries.com), then go to your
   account's **"Développer avec l'API"** section (or
   `https://www.betaseries.com/api/`) and create a new application.
2. Set the redirect URI to the value logged by
   `chrome.identity.getRedirectURL()` for your unpacked extension — this is
   typically `https://<your-extension-id>.chromiumapp.org/`. You can find
   your extension id on `chrome://extensions/` after the first `Load unpacked`.
3. Copy `src/betaseries/config.local.example.ts` to
   `src/betaseries/config.local.ts` and fill in:
   ```ts
   export const BETASERIES_CONFIG = {
     apiKey: "...",       // your application's client id / API key
     apiSecret: "...",    // your application's client secret
     redirectUri: "https://<your-extension-id>.chromiumapp.org/",
   };
   ```
4. `config.local.ts` is git-ignored — never commit real credentials.
5. Rebuild (`npm run build`) and reload the extension.

**⚠ Manual step required:** creating the BetaSeries API application and
obtaining the extension id for the redirect URI cannot be automated from
outside a real browser session — you must do this once yourself. Everything
else (auth flow, token storage, API calls) is fully implemented and does not
require further manual work.

### Authentication

SeriesSync uses BetaSeries' OAuth 2.0 authorization-code flow via
`chrome.identity.launchWebAuthFlow`. Your BetaSeries **password is never
requested or stored** by the extension — only the OAuth access token, kept
in `chrome.storage.local`. Disconnecting from the options page also revokes
the token server-side (`/member/destroy`).

## Permissions explained

| Permission | Why |
|---|---|
| `storage` | Save settings, auth token, sync history and logs locally. |
| `alarms` | Reserved for future periodic housekeeping (e.g. log trimming); not required for core sync. |
| `host_permissions: api.betaseries.com, www.betaseries.com` | Call the BetaSeries API and run the OAuth flow. |
| Content scripts on `tf1.fr`, `m6.fr`/`6play.fr`, `france.tv` | Read publicly-rendered page metadata and observe the `<video>` element's playback progress. No other site is touched, and `<all_urls>` is never requested. |

SeriesSync does not collect analytics, does not read unrelated browsing
history, and does not access any site content beyond what's needed to
identify the episode currently playing.

## Supported platforms & limitations

⚠ **Detection selectors are unverified against the live sites.** This
project was built in a sandboxed environment with no network access to
`tf1.fr`, `m6.fr`/`6play.fr`, or `france.tv`, so the exact DOM/embedded-JSON
shape of each platform's real pages could not be inspected directly. What
**is** implemented and correct:

- The detection **strategy and priority order** requested by the spec
  (embedded SPA state → JSON-LD → meta tags → DOM → URL → title), with a
  normalized, typed `DetectedEpisode` output shared by all three platforms.
- Generic, framework-agnostic helpers (`src/detection/strategies.ts`) for
  extracting JSON-LD, common SPA hydration globals (`__NUXT__`,
  `__NEXT_DATA__`, `__INITIAL_STATE__`, etc.), and meta tags — these work
  against *any* site using those conventions, not just guesses.
- A reusable, platform-independent `VideoTracker` that correctly triggers
  only at the configured threshold or on `ended`.

What is **⚠ Limited** and needs verification with a real account before
relying on it:

- The specific embedded-JSON field names guessed in
  `src/content/{tf1plus,m6plus,francetv}/detector.ts` (e.g. `season`,
  `programTitle`) — these are best-effort based on common French broadcaster
  patterns, not confirmed against live markup. If a platform doesn't hit
  these strategies, it will safely fall through to JSON-LD/meta/URL matching
  or return no detection at all (never a wrong guess).
- **Historical synchronization** (`src/content/*/history.ts`): implemented
  to look for a generic schema.org `ItemList` of `TVEpisode` entries. If a
  platform's real history page doesn't expose that (which is likely without
  further inspection), SeriesSync correctly reports
  `"Historical synchronization unavailable for this platform"` rather than
  inventing data — per the project's explicit requirement.
- The exact BetaSeries endpoints used for show search
  (`/search/all`) and episode resolution (`/episodes/search`,
  `/episodes/list`) are implemented per the official docs' *endpoint
  descriptions* (their parameter tables render client-side and couldn't be
  scraped from this environment). Verify the request/response shape with one
  real call (e.g. your browser's network tab while using betaseries.com, or
  the interactive docs at https://developers.betaseries.com/docs/api) and
  adjust `src/betaseries/api.ts` if needed — every endpoint is isolated in
  its own method so this is a small, contained change.

**Recommended next step before real-world use:** enable simulation mode,
open a real episode on each platform, and check the diagnostic log
(options page) to see which detection strategy actually fired and with what
data — then adjust the relevant detector if needed.

## Troubleshooting

- **Nothing happens when I watch an episode**: open the options page and
  enable debug logging, then check the browser console on the video page and
  the diagnostic log. If detection fails silently, the platform likely
  changed its markup — see Limitations above.
- **"Ambiguous match — synchronization skipped"**: two or more BetaSeries
  shows matched the detected title with similar confidence. This is by
  design (false positives are worse than false negatives) — search for the
  show yourself on BetaSeries.com to confirm the exact title.
- **"BetaSeries authentication expired"**: reconnect from the popup or
  options page.
- **Build fails on `config.local.ts` missing**: copy
  `src/betaseries/config.local.example.ts` to `config.local.ts` as described
  above.

## Project structure

```
series-sync/
├── manifest.json
├── package.json
├── scripts/build.mjs       # esbuild-based production build
├── src/
│   ├── background/         # service worker + sync orchestration
│   ├── content/{tf1plus,m6plus,francetv}/  # per-platform detector + history scanner + entry point
│   ├── detection/           # shared strategies, platform routing, video tracker
│   ├── betaseries/          # API client, OAuth, matching
│   ├── storage/             # chrome.storage.local wrapper, dedup keys
│   └── utils/                # types, normalization, messaging
├── popup/, options/         # UI
└── tests/                   # vitest unit tests
```

## Testing

`npm run test` runs unit tests covering: title normalization and SxxExx
parsing, platform detection, the TF1+ detector's fallback chain, the
playback-threshold tracker, BetaSeries matching (including the ambiguity
safeguard), the BetaSeries API client's error handling, dedup key stability,
and the storage layer. Tests use mocked `fetch`/`chrome.*` APIs and never
call the real BetaSeries API or modify a real account.

## Disclaimer

This is an independent, unofficial project, not affiliated with or endorsed
by BetaSeries SAS, TF1, M6, or France Télévisions. It only uses information
legitimately available to the browser via each site's own pages and the
official BetaSeries API — it does not bypass DRM, authentication, or any
platform's backend protections.

## License

MIT — see [LICENSE](./LICENSE).
