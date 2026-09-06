# SeriesSync

**Automatically synchronize watched episodes from streaming platforms to BetaSeries.**

SeriesSync is a Chrome/Edge extension designed to automatically detect watched TV episodes on supported streaming platforms and synchronize them with your BetaSeries account.

The goal is simple:

> Watch your episode normally.
> SeriesSync detects that you watched it.
> BetaSeries marks the episode as watched automatically.

## ✨ Features

* 🎬 Automatic episode detection
* 📺 Support for **TF1+**
* 📺 Support for **M6+**
* 📺 Support for **France.tv**
* 🔄 Automatic synchronization with BetaSeries
* 📚 First-time synchronization of previously watched episodes when the platform exposes sufficient data
* ▶️ Detection based on video playback progress when no "watched" indicator is available
* ⏱️ Configurable watched threshold
* 🧠 Multiple detection methods and fallbacks
* 🛡️ Conservative matching to avoid marking the wrong episode
* 💾 Local synchronization history
* 🐞 Debug mode
* 🧪 Mock API mode for development and testing
* 🌐 Chrome and Microsoft Edge compatible
* 🔐 OAuth authentication with BetaSeries

## 🎯 How it works

SeriesSync monitors supported streaming websites while you watch them.

For example:

```text
TF1+
   ↓
Episode detected
   ↓
Emily in Paris — S05E01
   ↓
BetaSeries series matching
   ↓
BetaSeries episode matching
   ↓
Episode marked as watched
```

The extension does **not** mark an episode as watched simply because its page was opened.

By default, an episode is considered watched when approximately **80% of the video has been watched**, or when the video reports that it has ended.

The threshold can be changed in the extension settings.

## 📚 Existing watch history

SeriesSync is also designed to handle episodes watched **before the extension was installed**.

During the first synchronization, the extension attempts to retrieve previously watched information exposed by the supported platform.

For example:

```text
First synchronization

TF1+
✓ 12 episodes detected
✓ 10 synchronized
⚠ 2 could not be identified

M6+
✓ 8 episodes detected
✓ 8 synchronized

France.tv
✓ 4 episodes detected
✓ 4 synchronized
```

The exact amount of historical information available depends on what each streaming platform exposes to the browser.

SeriesSync will never pretend that an episode was watched if it cannot reliably determine it.

## 🔎 Episode detection

SeriesSync uses multiple detection methods where possible:

* URL analysis
* Page title
* HTML metadata
* JSON-LD
* embedded page data
* `data-*` attributes
* player information
* HTML5 video information
* platform-specific data structures
* SPA navigation detection
* `MutationObserver`

Because streaming platforms can change their websites, each platform has its own detector.

## ▶️ Playback detection

When a platform does not provide a reliable "watched" indicator, SeriesSync can monitor the HTML5 video player when technically possible.

Example:

```text
Episode starts
      ↓
Video detected
      ↓
currentTime / duration monitored
      ↓
80% watched
      ↓
Episode considered watched
      ↓
BetaSeries synchronization
```

If the player reports:

```text
ended
```

the episode can also be considered watched.

Opening an episode page alone is **never sufficient**.

## 🔗 BetaSeries

SeriesSync uses the official BetaSeries API.

Official documentation:

https://developers.betaseries.com/

The extension can:

1. Identify the series
2. Search for the corresponding BetaSeries series
3. Identify the season and episode
4. Search for the corresponding BetaSeries episode
5. Mark the episode as watched

Relevant API operations include:

```text
GET /episodes/search
POST /episodes/watched
```

Authentication is handled through the official BetaSeries authentication mechanism.

SeriesSync never asks for or stores your BetaSeries password.

## 🔐 Privacy

SeriesSync is designed to minimize data collection.

The extension does not need:

* your streaming service passwords
* your BetaSeries password
* unnecessary personal information
* browsing data unrelated to supported streaming platforms

The extension only processes information required to detect episodes and synchronize them with BetaSeries.

Authentication tokens are stored using browser extension storage mechanisms.

No external analytics service is required.

## 🛡️ Safe matching

Avoiding incorrect synchronization is more important than synchronizing every possible episode.

Before automatically marking an episode as watched, SeriesSync attempts to confirm:

* the platform
* the series
* the season
* the episode
* the BetaSeries match

If the match is ambiguous, synchronization is skipped.

Example:

```text
⚠ Ambiguous BetaSeries match

Synchronization skipped.
```

This is intentional.

A missed synchronization can be fixed manually.

A wrongly synchronized episode is much more annoying.

## ⚙️ Settings

The extension is expected to provide settings for:

### Automatic synchronization

```text
☑ Enable automatic synchronization
```

### Watched threshold

Default:

```text
80%
```

Possible values:

```text
70%
80%
90%
100%
```

### Supported platforms

```text
☑ TF1+
☑ M6+
☑ France.tv
```

### Debug mode

```text
☐ Enable debug mode
```

### Simulation mode

Simulation mode allows developers to see what would be synchronized without actually modifying the BetaSeries account.

## 🧪 Development

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/series-sync.git
cd series-sync
```

Install dependencies:

```bash
npm install
```

Build the extension:

```bash
npm run build
```

The production extension will be generated in:

```text
dist/
```

## 🧩 Load the extension in Chrome

1. Open:

```text
chrome://extensions/
```

2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `dist/` directory

## 🧩 Load the extension in Microsoft Edge

1. Open:

```text
edge://extensions/
```

2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `dist/` directory

## 🏗️ Project structure

```text
series-sync/
│
├── manifest.json
├── package.json
├── README.md
├── tsconfig.json
│
├── src/
│   ├── background/
│   │   └── service-worker.ts
│   │
│   ├── content/
│   │   ├── tf1plus/
│   │   ├── m6plus/
│   │   └── francetv/
│   │
│   ├── detection/
│   │   ├── episode-detector.ts
│   │   ├── video-tracker.ts
│   │   └── platform-detector.ts
│   │
│   ├── betaseries/
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   └── matcher.ts
│   │
│   ├── storage/
│   │   └── storage.ts
│   │
│   └── utils/
│
├── popup/
│   ├── popup.html
│   ├── popup.ts
│   └── popup.css
│
├── options/
│   ├── options.html
│   ├── options.ts
│   └── options.css
│
└── tests/
    ├── detection/
    ├── matching/
    └── betaseries/
```

The final architecture may differ if a better technical solution is found.

## 🧪 Testing

Unit tests should cover:

* title normalization
* season/episode extraction
* SxxExx parsing
* platform detection
* BetaSeries matching
* duplicate prevention
* storage
* API error handling

Tests must use mocked BetaSeries API responses.

Tests must **never modify a real BetaSeries account**.

## 🚧 Current limitations

Streaming platforms can change their website structure at any time.

Because SeriesSync relies partly on information exposed by streaming websites, a website update may temporarily break episode detection.

Historical synchronization is also limited by the information made available by each platform.

If a platform does not expose its previous watch history to the browser, SeriesSync cannot reliably reconstruct it.

## ⚠️ Disclaimer

SeriesSync is an independent open-source project.

It is **not affiliated with, endorsed by, or officially connected to BetaSeries, TF1, M6, France Télévisions, Netflix, Amazon, or any supported streaming platform.**

BetaSeries is a trademark of its respective owner.

Use of the BetaSeries API must comply with the applicable BetaSeries API terms and conditions.

## 📄 License

Choose an appropriate open-source license before publishing the project.

MIT License is a possible choice for a personal open-source project.
