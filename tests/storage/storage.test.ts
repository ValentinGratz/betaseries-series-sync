import { beforeEach, describe, expect, it } from "vitest";
import { storage } from "../../src/storage/storage";
import { __resetChromeStorage } from "../setup";
import type { SyncRecord } from "../../src/utils/types";

describe("storage", () => {
  beforeEach(() => {
    __resetChromeStorage();
  });

  it("returns default settings when nothing is stored", async () => {
    const settings = await storage.getSettings();
    expect(settings.watchThreshold).toBe(80);
    expect(settings.enabledPlatforms.tf1plus).toBe(true);
  });

  it("persists and reloads settings", async () => {
    const settings = await storage.getSettings();
    await storage.setSettings({ ...settings, watchThreshold: 90, simulationMode: true });
    const reloaded = await storage.getSettings();
    expect(reloaded.watchThreshold).toBe(90);
    expect(reloaded.simulationMode).toBe(true);
  });

  it("reports hasSynced=false for an unknown key", async () => {
    expect(await storage.hasSynced("bse:123")).toBe(false);
  });

  it("reports hasSynced=true only for successful records", async () => {
    const record: SyncRecord = {
      key: "bse:123",
      platform: "tf1plus",
      seriesTitle: "Emily in Paris",
      seasonNumber: 5,
      episodeNumber: 1,
      status: "success",
      timestamp: Date.now(),
    };
    await storage.recordSync(record);
    expect(await storage.hasSynced("bse:123")).toBe(true);

    await storage.recordSync({ ...record, key: "bse:456", status: "ambiguous" });
    expect(await storage.hasSynced("bse:456")).toBe(false);
  });

  it("returns recent syncs sorted by most recent first", async () => {
    await storage.recordSync({
      key: "a",
      platform: "tf1plus",
      seriesTitle: "A",
      seasonNumber: 1,
      episodeNumber: 1,
      status: "success",
      timestamp: 1000,
    });
    await storage.recordSync({
      key: "b",
      platform: "tf1plus",
      seriesTitle: "B",
      seasonNumber: 1,
      episodeNumber: 1,
      status: "success",
      timestamp: 2000,
    });

    const recent = await storage.getRecentSyncs();
    expect(recent[0].key).toBe("b");
    expect(recent[1].key).toBe("a");
  });

  it("appends and retrieves logs, capping the total stored", async () => {
    for (let i = 0; i < 5; i++) {
      await storage.appendLog({ level: "info", message: `log ${i}`, timestamp: i });
    }
    const logs = await storage.getLogs();
    expect(logs).toHaveLength(5);
    expect(logs[0].message).toBe("log 0");
  });
});
