/**
 * Watches the page for HTML5 <video> elements and reports playback progress
 * so callers can decide when an episode counts as "watched". Never touches
 * playback itself (no play/pause/seek calls) — purely observational.
 */
export class VideoTracker {
  private observedVideos = new WeakSet<HTMLVideoElement>();
  private mutationObserver: MutationObserver | null = null;
  private pollHandle: number | null = null;
  private currentVideo: HTMLVideoElement | null = null;
  private thresholdReachedForVideo = new WeakSet<HTMLVideoElement>();

  constructor(
    private readonly onThresholdReached: (video: HTMLVideoElement) => void,
    private readonly getThreshold: () => number = () => 0.8
  ) {}

  start(): void {
    this.scanForVideo();
    this.mutationObserver = new MutationObserver(debounce(() => this.scanForVideo(), 500));
    this.mutationObserver.observe(document.documentElement, { childList: true, subtree: true });

    // Fallback poll in case a video is swapped in place (same element,
    // new src) without DOM mutations MutationObserver would catch.
    this.pollHandle = window.setInterval(() => this.scanForVideo(), 3000);
  }

  stop(): void {
    this.mutationObserver?.disconnect();
    this.mutationObserver = null;
    if (this.pollHandle != null) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }

  private scanForVideo(): void {
    const video = document.querySelector("video");
    if (!video || video === this.currentVideo) return;
    this.currentVideo = video;
    this.attach(video);
  }

  private attach(video: HTMLVideoElement): void {
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
}

function debounce<T extends (...args: any[]) => void>(fn: T, wait: number): T {
  let handle: number | null = null;
  return ((...args: Parameters<T>) => {
    if (handle != null) clearTimeout(handle);
    handle = window.setTimeout(() => fn(...args), wait);
  }) as T;
}
