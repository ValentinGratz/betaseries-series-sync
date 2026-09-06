import { describe, expect, it } from "vitest";
import { detectPlatform } from "../../src/detection/platform-detector";

describe("detectPlatform", () => {
  it("recognizes tf1.fr", () => {
    expect(detectPlatform("www.tf1.fr")).toBe("tf1plus");
  });
  it("recognizes m6.fr and 6play.fr", () => {
    expect(detectPlatform("www.m6.fr")).toBe("m6plus");
    expect(detectPlatform("www.6play.fr")).toBe("m6plus");
  });
  it("recognizes france.tv", () => {
    expect(detectPlatform("www.france.tv")).toBe("francetv");
  });
  it("returns null for unrelated hosts", () => {
    expect(detectPlatform("www.netflix.com")).toBeNull();
  });
  it("does not match lookalike domains", () => {
    expect(detectPlatform("www.nottf1.fr.evil.com")).toBeNull();
  });
});
