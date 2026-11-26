import type { MediaKind } from "@/types/files";
import type { UserConstraints } from "@/types/metadata";

export const APP_NAME = "TJ Meta Master";

export const ROUTES = {
  login: "/login",
  home: "/",
  results: "/results",
} as const;

/** Routes that can be opened without logging in. */
export const PUBLIC_ROUTES: readonly string[] = [ROUTES.login];

/* ----------------------------- Sliders / limits ---------------------------- */

export const SLIDER_LIMITS = {
  title: { min: 60, max: 200, default: 200 },
  /** 0 = no description at all (Title + Keywords only). */
  description: { min: 0, max: 400, default: 250 },
  keywords: { min: 10, max: 50, default: 50 },
} as const;

export const DEFAULT_CONSTRAINTS: UserConstraints = {
  titleLimit: SLIDER_LIMITS.title.default,
  descriptionLimit: SLIDER_LIMITS.description.default,
  keywordCount: SLIDER_LIMITS.keywords.default,
};

/* ------------------------------ Negative Prompt ---------------------------- */

export const NEGATIVE_LIMITS = {
  /** Title example rows. */
  maxTitles: 5,
  /** Negative keyword tags. */
  maxKeywords: 30,
  /** Longest title example (characters). */
  maxTitleChars: 300,
  /** Longest single keyword or phrase (characters). */
  maxKeywordChars: 100,
} as const;

/* --------------------------- Supported file types -------------------------- */

export const EXTENSION_KIND: Readonly<Record<string, MediaKind>> = {
  jpg: "image",
  jpeg: "image",
  png: "image",
  gif: "image",
  webp: "image",
  eps: "eps",
  svg: "svg",
  ai: "ai",
  mp4: "video",
  mov: "video",
};

export const SUPPORTED_EXTENSIONS: readonly string[] = Object.keys(EXTENSION_KIND);

/** Value for <input accept="..."> */
export const FILE_INPUT_ACCEPT = SUPPORTED_EXTENSIONS.map((e) => `.${e}`).join(",");

export const SUPPORTED_FORMATS_TEXT =
  "JPG, JPEG, PNG, GIF, WebP, SVG, EPS, AI (image) and MP4, MOV (video)";

/* ------------------------------ Local previews ----------------------------- */

export const PREVIEW = {
  /** Longest side of the image sent to Gemini (px). */
  aiMaxSide: 768,
  aiJpegQuality: 0.72,
  /** Longest side of the small grid / result-card thumbnail (px). */
  gridMaxSide: 256,
  gridJpegQuality: 0.75,
  /** Video: positions (fraction of duration) of the frames sent to Gemini. */
  videoFramePositions: [0.1, 0.5, 0.9],
  videoFrameMaxSide: 640,
  /**
   * Vector files (SVG, AI) are first drawn this big (longest side, px), then the empty
   * margin around the artwork is cropped away before the final shrink.
   */
  vectorRenderSide: 2048,
  /** How many previews are generated at the same time. */
  concurrency: 2,
} as const;

/* ------------------------------------ AI ----------------------------------- */

export const AI = {
  endpoint: "https://generativelanguage.googleapis.com/v1beta",
  /**
   * Models to use, best first. The app asks Google which of these exist for the
   * key and silently falls to the next one if a model is unavailable (not found,
   * or no free quota). Update this list when Google releases newer models.
   */
  modelPreference: [
    "gemini-3.5-flash",
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash-lite",
  ],
  /** Files per request (more files per request = fewer requests). */
  batchSize: 4,
  /** Stay below the free-tier per-minute limit (Flash models: ~10 per minute). */
  maxRequestsPerMinute: 10,
  /** Requests running at the same time (1 = no bursts, fewer 429 errors). */
  concurrency: 2,
  /** Tries per file before it is marked Failed (rate-limit waits do not count). */
  maxAttempts: 3,
  requestTimeoutMs: 120_000,
} as const;

/* ------------------------------------- CSV --------------------------------- */

export const CSV_COLUMNS = ["Filename", "Title", "Description", "Keywords"] as const;
/** Same, when Description is switched off (slider at 0). */
export const CSV_COLUMNS_NO_DESCRIPTION = ["Filename", "Title", "Keywords"] as const;

/** Longest CSV file name a user may type when renaming (characters). */
export const CSV_NAME_MAX = 300;

/* --------------------------- Browser storage keys -------------------------- */

export const STORAGE_KEYS = {
  marketplace: "tjmm.marketplace",
  apiKey: "tjmm.geminiApiKey",
  constraints: "tjmm.constraints",
  negativePrompt: "tjmm.negativePrompt",
} as const;

/* -------------------------------- Environment ------------------------------ */

/**
 * NEXT_PUBLIC_* variables must be referenced literally so Next.js can inline
 * them into the browser bundle.
 */
export function getSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Copy .env.example to .env.local and fill in both values.",
    );
  }
  return { url, anonKey };
}
