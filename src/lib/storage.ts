import { emptyNegativeInput, sanitizeNegativeInput } from "@/features/negative/policy";
import { DEFAULT_CONSTRAINTS, SLIDER_LIMITS, STORAGE_KEYS } from "@/lib/constants";
import { clamp } from "@/lib/utils";
import type { UserConstraints } from "@/types/metadata";
import type { NegativePromptInput } from "@/types/negative";

/**
 * Safe localStorage wrapper. Reads/writes never throw (private mode,
 * blocked storage, server-side rendering all just return "nothing").
 * The Gemini API key and slider values live ONLY here - never in the database.
 */
function store(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function read(key: string): string | null {
  try {
    return store()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, value: string): boolean {
  try {
    const s = store();
    if (!s) return false;
    s.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function remove(key: string): void {
  try {
    store()?.removeItem(key);
  } catch {
    /* ignore */
  }
}

/* -------------------------------- API key ---------------------------------- */

export function loadApiKey(): string {
  return read(STORAGE_KEYS.apiKey)?.trim() ?? "";
}

export function saveApiKey(key: string): boolean {
  const trimmed = key.trim();
  if (!trimmed) return false;
  return write(STORAGE_KEYS.apiKey, trimmed);
}

export function clearApiKey(): void {
  remove(STORAGE_KEYS.apiKey);
}

/* ------------------------------- Constraints ------------------------------- */

/** Force every value into its allowed range (whole numbers only). */
export function sanitizeConstraints(
  input: Partial<UserConstraints>,
): UserConstraints {
  const pick = (
    value: unknown,
    limits: { min: number; max: number },
    fallback: number,
  ): number => {
    const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
    return clamp(Math.round(n), limits.min, limits.max);
  };
  return {
    titleLimit: pick(
      input.titleLimit,
      SLIDER_LIMITS.title,
      DEFAULT_CONSTRAINTS.titleLimit,
    ),
    descriptionLimit: pick(
      input.descriptionLimit,
      SLIDER_LIMITS.description,
      DEFAULT_CONSTRAINTS.descriptionLimit,
    ),
    keywordCount: pick(
      input.keywordCount,
      SLIDER_LIMITS.keywords,
      DEFAULT_CONSTRAINTS.keywordCount,
    ),
  };
}

export function loadConstraints(): UserConstraints {
  const raw = read(STORAGE_KEYS.constraints);
  if (!raw) return { ...DEFAULT_CONSTRAINTS };
  try {
    return sanitizeConstraints(JSON.parse(raw) as Partial<UserConstraints>);
  } catch {
    return { ...DEFAULT_CONSTRAINTS };
  }
}

export function saveConstraints(constraints: UserConstraints): void {
  write(STORAGE_KEYS.constraints, JSON.stringify(sanitizeConstraints(constraints)));
}

/* ------------------------------- Marketplace ------------------------------- */

export function loadMarketplace(): string | null {
  return read(STORAGE_KEYS.marketplace);
}

export function saveMarketplace(id: string): void {
  write(STORAGE_KEYS.marketplace, id);
}

/* ----------------------------- Negative Prompt ----------------------------- */

export function loadNegativeInput(): NegativePromptInput {
  const raw = read(STORAGE_KEYS.negativePrompt);
  if (!raw) return emptyNegativeInput();
  try {
    return sanitizeNegativeInput(JSON.parse(raw));
  } catch {
    return emptyNegativeInput();
  }
}

export function saveNegativeInput(input: NegativePromptInput): void {
  write(STORAGE_KEYS.negativePrompt, JSON.stringify(sanitizeNegativeInput(input)));
}
