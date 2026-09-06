"use strict";
(() => {
  // src/detection/video-tracker.ts
  var VideoTracker = class {
    constructor(onThresholdReached, getThreshold = () => 0.8) {
      this.onThresholdReached = onThresholdReached;
      this.getThreshold = getThreshold;
      this.observedVideos = /* @__PURE__ */ new WeakSet();
      this.mutationObserver = null;
      this.pollHandle = null;
      this.currentVideo = null;
      this.thresholdReachedForVideo = /* @__PURE__ */ new WeakSet();
    }
    start() {
      this.scanForVideo();
      this.mutationObserver = new MutationObserver(debounce(() => this.scanForVideo(), 500));
      this.mutationObserver.observe(document.documentElement, { childList: true, subtree: true });
      this.pollHandle = window.setInterval(() => this.scanForVideo(), 3e3);
    }
    stop() {
      this.mutationObserver?.disconnect();
      this.mutationObserver = null;
      if (this.pollHandle != null) {
        clearInterval(this.pollHandle);
        this.pollHandle = null;
      }
    }
    scanForVideo() {
      const video = document.querySelector("video");
      if (!video || video === this.currentVideo) return;
      this.currentVideo = video;
      this.attach(video);
    }
    attach(video) {
      if (this.observedVideos.has(video)) return;
      this.observedVideos.add(video);
      const check = () => {
        if (this.thresholdReachedForVideo.has(video)) return;
        const { currentTime, duration } = video;
        if (!duration || !isFinite(duration) || duration <= 0) return;
        const ratio = currentTime / duration;
        if (ratio >= this.getThreshold()) {
          this.thresholdReachedForVideo.add(video);
          this.onThresholdReached(video);
        }
      };
      video.addEventListener("timeupdate", check);
      video.addEventListener("ended", () => {
        if (!this.thresholdReachedForVideo.has(video)) {
          this.thresholdReachedForVideo.add(video);
          this.onThresholdReached(video);
        }
      });
    }
  };
  function debounce(fn, wait) {
    let handle = null;
    return (...args) => {
      if (handle != null) clearTimeout(handle);
      handle = window.setTimeout(() => fn(...args), wait);
    };
  }

  // src/utils/messages.ts
  function sendToBackground(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    });
  }

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

  // src/content/shared-content-script.ts
  function initPlatformContentScript(platform, detectEpisode, scanHistory) {
    let settings = DEFAULT_SETTINGS;
    let lastUrl = location.href;
    sendToBackground({ type: "GET_SETTINGS" }).then((s) => settings = s ?? DEFAULT_SETTINGS).catch(() => {
    });
    const tracker = new VideoTracker(
      () => {
        if (!settings.enabledPlatforms[platform]) return;
        const episode = detectEpisode();
        if (!episode) return;
        sendToBackground({ type: "EPISODE_WATCHED_CANDIDATE", episode }).catch(() => {
        });
      },
      () => (settings.watchThreshold ?? 80) / 100
    );
    tracker.start();
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
      }
    }, 1e3);
    if (scanHistory) {
      chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message?.type === "SCAN_HISTORY") {
          const episodes = scanHistory();
          if (episodes === null) {
            sendResponse({ unavailable: true, reason: "Historical synchronization unavailable for this platform." });
          } else {
            sendToBackground({ type: "HISTORY_EPISODES_FOUND", episodes }).then(sendResponse).catch(() => sendResponse({ unavailable: true }));
          }
          return true;
        }
        return false;
      });
    }
  }

  // src/utils/normalize.ts
  function parseSeasonEpisode(text) {
    const patterns = [
      /s(?:aison)?\s*(\d{1,3})\D{0,5}e(?:pisode)?\s*(\d{1,4})/i,
      // S05E01, Saison 5 Episode 1
      /(\d{1,3})x(\d{1,4})/i,
      // 5x01
      /saison[\s-]*(\d{1,3})[^\d]{0,10}episode[\s-]*(\d{1,4})/i
    ];
    for (const re of patterns) {
      const match = text.match(re);
      if (match) {
        return { season: parseInt(match[1], 10), episode: parseInt(match[2], 10) };
      }
    }
    return { season: null, episode: null };
  }

  // src/detection/strategies.ts
  function extractJsonLd(doc = document) {
    const results = [];
    doc.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
      try {
        const parsed = JSON.parse(el.textContent ?? "");
        if (Array.isArray(parsed)) results.push(...parsed);
        else if (parsed["@graph"]) results.push(...parsed["@graph"]);
        else results.push(parsed);
      } catch {
      }
    });
    return results;
  }
  function findJsonLdByType(nodes, types) {
    const wanted = types.map((t) => t.toLowerCase());
    for (const node of nodes) {
      const nodeTypes = Array.isArray(node?.["@type"]) ? node["@type"] : [node?.["@type"]];
      if (nodeTypes.some((t) => wanted.includes(String(t).toLowerCase()))) {
        return node;
      }
    }
    return null;
  }
  function extractEmbeddedJson(varNames, doc = document) {
    const scripts = Array.from(doc.querySelectorAll("script:not([src])"));
    for (const script of scripts) {
      const text = script.textContent ?? "";
      for (const name of varNames) {
        const marker = `${name}=`;
        const idx = text.indexOf(marker);
        if (idx === -1) continue;
        const jsonStart = text.indexOf("{", idx);
        if (jsonStart === -1) continue;
        const candidate = extractBalancedJson(text, jsonStart);
        if (!candidate) continue;
        try {
          return JSON.parse(candidate);
        } catch {
        }
      }
    }
    for (const name of varNames) {
      const value = window[name];
      if (value && typeof value === "object") return value;
    }
    return null;
  }
  function extractBalancedJson(text, startIndex) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = startIndex; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return text.slice(startIndex, i + 1);
      }
    }
    return null;
  }
  function extractMetaTags(doc = document) {
    const map = {};
    doc.querySelectorAll("meta[property], meta[name]").forEach((el) => {
      const key = el.getAttribute("property") ?? el.getAttribute("name");
      const value = el.getAttribute("content");
      if (key && value) map[key] = value;
    });
    return map;
  }
  function bestEffortSeasonEpisode(title, url) {
    const fromTitle = parseSeasonEpisode(title);
    if (fromTitle.season != null && fromTitle.episode != null) return fromTitle;
    return parseSeasonEpisode(url);
  }

  // src/content/francetv/detector.ts
  var EMBEDDED_JSON_VARS = ["__data__", "__NEXT_DATA__", "__INITIAL_STATE__"];
  function detectFranceTvEpisode(doc = document, url = location.href) {
    const embedded = extractEmbeddedJson(EMBEDDED_JSON_VARS, doc);
    if (embedded) {
      const found = tryExtractFromEmbedded(embedded, url);
      if (found) return found;
    }
    const ld = extractJsonLd(doc);
    const episodeNode = findJsonLdByType(ld, ["TVEpisode"]);
    if (episodeNode) {
      const seriesTitle = episodeNode.partOfSeries?.name ?? episodeNode.partOfTVSeries?.name;
      const seasonNumber = toInt(episodeNode.partOfSeason?.seasonNumber);
      const episodeNumber = toInt(episodeNode.episodeNumber);
      if (seriesTitle && seasonNumber != null && episodeNumber != null) {
        return {
          platform: "francetv",
          seriesTitle,
          seasonNumber,
          episodeNumber,
          episodeTitle: episodeNode.name,
          url,
          confidence: 0.85,
          detectionMethod: "json-ld"
        };
      }
    }
    const meta = extractMetaTags(doc);
    const ogTitle = meta["og:title"] ?? doc.title;
    if (ogTitle) {
      const { season, episode } = bestEffortSeasonEpisode(ogTitle, url);
      const seriesTitle = ogTitle.split(/\s[-–|]\s/)[0]?.trim();
      if (seriesTitle && season != null && episode != null) {
        return {
          platform: "francetv",
          seriesTitle,
          seasonNumber: season,
          episodeNumber: episode,
          url,
          confidence: 0.55,
          detectionMethod: "meta-tags"
        };
      }
    }
    const urlMatch = url.match(/france\.tv\/[\w-]+\/([\w-]+)\/saison-(\d{1,2})\/\d+-([\w-]+)\.html/i);
    if (urlMatch) {
      return {
        platform: "francetv",
        seriesTitle: slugToTitle(urlMatch[1]),
        seasonNumber: parseInt(urlMatch[2], 10),
        episodeNumber: null,
        episodeTitle: slugToTitle(urlMatch[3]),
        url,
        confidence: 0.3,
        detectionMethod: "url-pattern"
      };
    }
    return null;
  }
  function tryExtractFromEmbedded(state, url) {
    const candidate = deepFind(state, (node) => {
      return node && typeof node === "object" && (typeof node.season === "number" || typeof node.saison === "number") && (typeof node.episode === "number" || typeof node.numeroEpisode === "number");
    });
    if (!candidate) return null;
    const seriesTitle = candidate.programTitle ?? candidate.program?.label ?? candidate.emission?.titre;
    if (!seriesTitle) return null;
    return {
      platform: "francetv",
      seriesTitle,
      seasonNumber: candidate.season ?? candidate.saison,
      episodeNumber: candidate.episode ?? candidate.numeroEpisode,
      episodeTitle: candidate.title ?? candidate.titre,
      url,
      confidence: 0.9,
      detectionMethod: "embedded-json"
    };
  }
  function deepFind(node, predicate, depth = 0, seen = /* @__PURE__ */ new Set()) {
    if (depth > 6 || node == null || typeof node !== "object" || seen.has(node)) return null;
    seen.add(node);
    if (predicate(node)) return node;
    for (const value of Object.values(node)) {
      if (value && typeof value === "object") {
        const found = deepFind(value, predicate, depth + 1, seen);
        if (found) return found;
      }
    }
    return null;
  }
  function toInt(v) {
    const n = typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? v : NaN;
    return Number.isFinite(n) ? n : null;
  }
  function slugToTitle(slug) {
    return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }

  // src/content/francetv/history.ts
  function scanFranceTvHistory(doc = document) {
    const nodes = extractJsonLd(doc);
    const list = nodes.find((n) => n["@type"] === "ItemList" && Array.isArray(n.itemListElement));
    if (!list) return null;
    const episodes = [];
    for (const item of list.itemListElement) {
      const ep = item.item ?? item;
      if (ep?.["@type"] !== "TVEpisode") continue;
      const seriesTitle = ep.partOfSeries?.name ?? ep.partOfTVSeries?.name;
      const seasonNumber = ep.partOfSeason?.seasonNumber ?? parseSeasonEpisode(ep.name ?? "").season;
      const episodeNumber = ep.episodeNumber ?? parseSeasonEpisode(ep.name ?? "").episode;
      if (!seriesTitle || seasonNumber == null || episodeNumber == null) continue;
      episodes.push({
        platform: "francetv",
        seriesTitle,
        seasonNumber,
        episodeNumber,
        episodeTitle: ep.name,
        url: ep.url ?? location.href,
        confidence: 0.7,
        detectionMethod: "history-json-ld"
      });
    }
    return episodes.length > 0 ? episodes : null;
  }

  // src/content/francetv/content-script.ts
  initPlatformContentScript("francetv", () => detectFranceTvEpisode(), () => scanFranceTvHistory());
})();
//# sourceMappingURL=content-script.js.map
