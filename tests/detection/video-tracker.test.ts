import { afterEach, describe, expect, it, vi } from "vitest";
import { VideoTracker } from "../../src/detection/video-tracker";

function addVideo(): HTMLVideoElement {
  const video = document.createElement("video");
  document.body.appendChild(video);
  return video;
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("VideoTracker", () => {
  it("does not fire below the configured threshold", () => {
    const video = addVideo();
    const onThreshold = vi.fn();
    const tracker = new VideoTracker(onThreshold, () => 0.8);
    tracker.start();

    Object.defineProperty(video, "duration", { value: 100, configurable: true });
    Object.defineProperty(video, "currentTime", { value: 50, configurable: true });
    video.dispatchEvent(new Event("timeupdate"));

    expect(onThreshold).not.toHaveBeenCalled();
    tracker.stop();
  });

  it("fires once the threshold ratio is reached", () => {
    const video = addVideo();
    const onThreshold = vi.fn();
    const tracker = new VideoTracker(onThreshold, () => 0.8);
    tracker.start();

    Object.defineProperty(video, "duration", { value: 100, configurable: true });
    Object.defineProperty(video, "currentTime", { value: 81, configurable: true });
    video.dispatchEvent(new Event("timeupdate"));

    expect(onThreshold).toHaveBeenCalledTimes(1);
    tracker.stop();
  });

  it("does not fire twice for the same video once threshold is reached", () => {
    const video = addVideo();
    const onThreshold = vi.fn();
    const tracker = new VideoTracker(onThreshold, () => 0.8);
    tracker.start();

    Object.defineProperty(video, "duration", { value: 100, configurable: true });
    Object.defineProperty(video, "currentTime", { value: 90, configurable: true, writable: true });
    video.dispatchEvent(new Event("timeupdate"));
    video.dispatchEvent(new Event("timeupdate"));
    video.dispatchEvent(new Event("ended"));

    expect(onThreshold).toHaveBeenCalledTimes(1);
    tracker.stop();
  });

  it("fires on 'ended' even if the ratio threshold was never technically reached", () => {
    const video = addVideo();
    const onThreshold = vi.fn();
    const tracker = new VideoTracker(onThreshold, () => 0.8);
    tracker.start();

    Object.defineProperty(video, "duration", { value: 100, configurable: true });
    Object.defineProperty(video, "currentTime", { value: 10, configurable: true });
    video.dispatchEvent(new Event("ended"));

    expect(onThreshold).toHaveBeenCalledTimes(1);
    tracker.stop();
  });

  it("ignores videos with no usable duration", () => {
    const video = addVideo();
    const onThreshold = vi.fn();
    const tracker = new VideoTracker(onThreshold, () => 0.8);
    tracker.start();

    Object.defineProperty(video, "duration", { value: NaN, configurable: true });
    Object.defineProperty(video, "currentTime", { value: 10, configurable: true });
    video.dispatchEvent(new Event("timeupdate"));

    expect(onThreshold).not.toHaveBeenCalled();
    tracker.stop();
  });
});
