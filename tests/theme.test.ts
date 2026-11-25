import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  THEME_COLORS,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  nextTheme,
  parseTheme,
  readStoredTheme,
  writeStoredTheme,
} from "@/lib/theme";

/** Minimal stand-ins for the browser objects the theme code touches. */
function fakeBrowser(options: { stored?: string | null; storageThrows?: boolean; hasMeta?: boolean }) {
  const attrs: Record<string, string> = {};
  const meta = { content: "", setAttribute: (_: string, v: string) => (meta.content = v) };
  const writes: Array<[string, string]> = [];
  const storage = {
    getItem: (key: string) => {
      if (options.storageThrows) throw new Error("blocked");
      return key === THEME_STORAGE_KEY ? (options.stored ?? null) : null;
    },
    setItem: (key: string, value: string) => {
      if (options.storageThrows) throw new Error("blocked");
      writes.push([key, value]);
    },
  };
  const listeners: Array<() => void> = [];
  const document = {
    documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) },
    querySelector: () => (options.hasMeta === false ? null : meta),
    addEventListener: (_: string, fn: () => void) => listeners.push(fn),
  };
  return { attrs, meta, writes, storage, document, listeners };
}

function runInitScript(env: ReturnType<typeof fakeBrowser>) {
  new Function("document", "localStorage", THEME_INIT_SCRIPT)(env.document, env.storage);
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("theme helpers", () => {
  it("defaults to dark", () => {
    expect(DEFAULT_THEME).toBe("dark");
  });

  it("accepts only light and dark", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    for (const bad of [null, undefined, "", "LIGHT", "system", 1, {}]) {
      expect(parseTheme(bad)).toBe("dark");
    }
  });

  it("toggles between the two themes", () => {
    expect(nextTheme("dark")).toBe("light");
    expect(nextTheme("light")).toBe("dark");
  });

  it("has a toolbar colour for each theme", () => {
    expect(THEME_COLORS.dark).toMatch(/^#[0-9a-f]{6}$/i);
    expect(THEME_COLORS.light).toMatch(/^#[0-9a-f]{6}$/i);
    expect(THEME_COLORS.dark).not.toBe(THEME_COLORS.light);
  });
});

describe("saved theme", () => {
  it("is dark on the server (no window)", () => {
    expect(readStoredTheme()).toBe("dark");
    expect(() => writeStoredTheme("light")).not.toThrow();
  });

  it("reads and writes localStorage", () => {
    const env = fakeBrowser({ stored: "light" });
    (globalThis as { window?: unknown }).window = { localStorage: env.storage };
    expect(readStoredTheme()).toBe("light");
    writeStoredTheme("dark");
    expect(env.writes).toEqual([[THEME_STORAGE_KEY, "dark"]]);
  });

  it("falls back to dark for junk or blocked storage", () => {
    (globalThis as { window?: unknown }).window = {
      localStorage: fakeBrowser({ stored: "purple" }).storage,
    };
    expect(readStoredTheme()).toBe("dark");

    (globalThis as { window?: unknown }).window = {
      localStorage: fakeBrowser({ storageThrows: true }).storage,
    };
    expect(readStoredTheme()).toBe("dark");
    expect(() => writeStoredTheme("light")).not.toThrow();
  });
});

describe("first-paint script", () => {
  it("applies dark when nothing is saved", () => {
    const env = fakeBrowser({ stored: null });
    runInitScript(env);
    expect(env.attrs["data-theme"]).toBe("dark");
    expect(env.meta.content).toBe(THEME_COLORS.dark);
  });

  it("applies a saved light theme and its toolbar colour", () => {
    const env = fakeBrowser({ stored: "light" });
    runInitScript(env);
    expect(env.attrs["data-theme"]).toBe("light");
    expect(env.meta.content).toBe(THEME_COLORS.light);
  });

  it("ignores junk and survives blocked storage", () => {
    const junk = fakeBrowser({ stored: "neon" });
    runInitScript(junk);
    expect(junk.attrs["data-theme"]).toBe("dark");

    const blocked = fakeBrowser({ storageThrows: true });
    expect(() => runInitScript(blocked)).not.toThrow();
    expect(blocked.attrs["data-theme"]).toBe("dark");
  });

  it("sets the toolbar colour later if the tag is not in the page yet", () => {
    const env = fakeBrowser({ stored: "light", hasMeta: false });
    runInitScript(env);
    expect(env.attrs["data-theme"]).toBe("light");
    expect(env.listeners).toHaveLength(1);
  });
});
