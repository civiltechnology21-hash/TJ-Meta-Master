"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_THEME, getActiveTheme, nextTheme, setTheme, subscribeTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * The square dark / light button that sits next to Settings.
 * Dark shows a sun (click for light); light shows a moon (click for dark).
 * The two icons are both in the DOM and cross-fade with CSS (see .theme-toggle in globals.css),
 * so the server and the browser always render the same markup.
 */
export function ThemeToggle({ className }: { className?: string }) {
  // The server cannot know the saved theme, so it renders the default; React then switches to
  // the real value right after hydration without a mismatch warning.
  const theme = useSyncExternalStore(subscribeTheme, getActiveTheme, () => DEFAULT_THEME);
  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme(getActiveTheme()))}
      aria-label={label}
      title={label}
      className={cn(
        "theme-toggle relative h-10 w-10 shrink-0 rounded-md border border-line-strong bg-panel-2 text-fg",
        "transition-[background-color,border-color,transform] duration-200 ease-out",
        "hover:-translate-y-px hover:bg-panel-3 active:translate-y-0 active:scale-[0.97]",
        className,
      )}
    >
      <svg
        className="theme-icon theme-icon-sun"
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="3.6" />
        <path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2.5 12h2m15 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      <svg
        className="theme-icon theme-icon-moon"
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.2 14.2A8.4 8.4 0 0 1 9.8 3.8 8.5 8.5 0 1 0 20.2 14.2Z" />
        <path d="m16.8 4.4.4 1.2 1.2.4-1.2.4-.4 1.2-.4-1.2-1.2-.4 1.2-.4.4-1.2Z" strokeWidth="1.2" />
      </svg>
    </button>
  );
}
