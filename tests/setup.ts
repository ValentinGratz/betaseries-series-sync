// Minimal in-memory mock of the chrome.* APIs the codebase touches, so unit
// tests can run under Node/jsdom without a real browser extension host.
import { vi } from "vitest";

const store = new Map<string, unknown>();

const chromeMock = {
  storage: {
    local: {
      get: (keys: string[], callback: (result: Record<string, unknown>) => void) => {
        const result: Record<string, unknown> = {};
        for (const key of keys) {
          if (store.has(key)) result[key] = store.get(key);
        }
        callback(result);
      },
      set: (items: Record<string, unknown>, callback?: () => void) => {
        for (const [key, value] of Object.entries(items)) {
          store.set(key, value);
        }
        callback?.();
      },
    },
  },
  runtime: {
    lastError: undefined,
    sendMessage: vi.fn(),
    onMessage: { addListener: vi.fn() },
    onInstalled: { addListener: vi.fn() },
    openOptionsPage: vi.fn(),
  },
  identity: {
    getRedirectURL: () => "https://test-extension-id.chromiumapp.org/",
    launchWebAuthFlow: vi.fn(),
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
    create: vi.fn(),
  },
};

// @ts-expect-error - partial mock is sufficient for the unit tests
globalThis.chrome = chromeMock;

export function __resetChromeStorage(): void {
  store.clear();
}
