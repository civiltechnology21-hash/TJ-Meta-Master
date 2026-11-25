/**
 * Dark / light theme.
 *
 * The theme lives in two places only: the `data-theme` attribute on <html> (what the CSS reads)
 * and `localStorage` (so the choice survives a reload). Nothing else - no store, no database.
 * Dark is the default.
 */

export type Theme = "dark" | "light";

export const THEMES: readonly Theme[] = ["dark", "light"];
export const DEFAULT_THEME: Theme = "dark";
export const THEME_STORAGE_KEY = "tjmm.theme";

/** Browser toolbar colour (the <meta name="theme-color"> tag) for each theme. Same as --c-bg. */
export const THEME_COLORS: Readonly<Record<Theme, string>> = {
  dark: "#111313",
  light: "#f1f0ec",
};

/** How long the colour cross-fade lasts after a click (keep in step with globals.css). */
const SWITCH_MS = 360;

export function parseTheme(value: unknown): Theme {
  return value === "light" || value === "dark" ? value : DEFAULT_THEME;
}

export function nextTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}

/* ------------------------------ localStorage ------------------------------- */

/** Never throws: private mode, blocked storage and server-side rendering all give the default. */
export function readStoredTheme(): Theme {
  try {
    if (typeof window === "undefined") return DEFAULT_THEME;
    return parseTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

export function writeStoredTheme(theme: Theme): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* storage unavailable: the theme still changes, it just is not remembered */
  }
}

/* ---------------------------------- DOM ------------------------------------ */

/** The theme currently shown. Reads the attribute so it always matches what the user sees. */
export function getActiveTheme(): Theme {
  if (typeof document === "undefined") return DEFAULT_THEME;
  return parseTheme(document.documentElement.getAttribute("data-theme"));
}

/** Set the attribute and the browser toolbar colour. Does not touch localStorage. */
export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLORS[theme]);
}

let switchTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Change the theme after a click: fade the colours (the class only exists for a moment, so
 * normal hover and layout transitions are never affected), apply, and remember it.
 */
export function setTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.add("theme-switching");
  applyTheme(theme);
  writeStoredTheme(theme);
  clearTimeout(switchTimer);
  switchTimer = setTimeout(() => root.classList.remove("theme-switching"), SWITCH_MS);
}

/**
 * For useSyncExternalStore: tells React when the theme changes - from this tab's button,
 * from another toggle on the page, or from another tab (the `storage` event).
 */
export function subscribeTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) applyTheme(parseTheme(event.newValue));
  };
  window.addEventListener("storage", onStorage);

  return () => {
    observer.disconnect();
    window.removeEventListener("storage", onStorage);
  };
}

/* --------------------------- first-paint script ---------------------------- */

/**
 * Runs inside <head> before the page is painted, so a saved light theme never flashes dark.
 * It must stay self-contained (it is inlined as text), so the values are baked in here.
 */
export const THEME_INIT_SCRIPT = `(function(){
var d=document.documentElement,t="${DEFAULT_THEME}";
try{var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(s==="light"||s==="dark")t=s}catch(e){}
d.setAttribute("data-theme",t);
var c=${JSON.stringify(THEME_COLORS)};
function m(){var e=document.querySelector('meta[name="theme-color"]');if(e)e.setAttribute("content",c[t]);return!!e}
if(!m())document.addEventListener("DOMContentLoaded",m)
})();`;
