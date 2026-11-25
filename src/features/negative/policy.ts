import { NEGATIVE_LIMITS } from "@/lib/constants";
import type {
  NegativeKeywordRule,
  NegativePolicy,
  NegativePromptInput,
  NegativeTitleExample,
} from "@/types/negative";
import { cleanEntry, tokenize } from "./normalize";

/** Bump when the rule shape or the way rules are built changes. */
export const NEGATIVE_POLICY_VERSION = 1;

/** What the card shows when nothing was typed: one empty title row, no keywords. */
export function emptyNegativeInput(): NegativePromptInput {
  return { titles: [""], keywords: [] };
}

/**
 * Forces any value (e.g. old or edited localStorage data) into a valid input:
 * at most 5 title rows (at least 1), at most 15 unique keywords, capped lengths.
 * Title rows are NOT trimmed or de-duplicated here, so typing a space or two
 * similar rows never makes a row jump while the user types.
 */
export function sanitizeNegativeInput(input: unknown): NegativePromptInput {
  const raw = (input && typeof input === "object" ? input : {}) as {
    titles?: unknown;
    keywords?: unknown;
  };

  const titles = (Array.isArray(raw.titles) ? raw.titles : [])
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.slice(0, NEGATIVE_LIMITS.maxTitleChars))
    .slice(0, NEGATIVE_LIMITS.maxTitles);

  const keywords: string[] = [];
  const seen = new Set<string>();
  for (const value of Array.isArray(raw.keywords) ? raw.keywords : []) {
    if (typeof value !== "string") continue;
    const keyword = cleanEntry(value).slice(0, NEGATIVE_LIMITS.maxKeywordChars).trim();
    const key = tokenize(keyword).join(" ");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    keywords.push(keyword);
    if (keywords.length >= NEGATIVE_LIMITS.maxKeywords) break;
  }

  return { titles: titles.length > 0 ? titles : [""], keywords };
}

/** True when there is nothing to apply (no usable title example and no usable keyword). */
export function isNegativeInputEmpty(input: NegativePromptInput | null | undefined): boolean {
  if (!input) return true;
  return (
    !input.titles.some((t) => tokenize(t).length > 0) &&
    !input.keywords.some((k) => tokenize(k).length > 0)
  );
}

const ruleNumber = (n: number) => String(n).padStart(3, "0");

/**
 * Builds the rules for one batch from the user's input.
 * Returns `null` when the input is empty: Negative Prompt is then OFF and the
 * tool must behave exactly as it did before this feature existed.
 */
export function buildNegativePolicy(
  input: NegativePromptInput | null | undefined,
): NegativePolicy | null {
  if (!input) return null;
  const clean = sanitizeNegativeInput(input);

  const keywords: NegativeKeywordRule[] = [];
  const seenKeywords = new Set<string>();
  for (const original of clean.keywords) {
    const tokens = tokenize(original);
    const key = tokens.join(" ");
    if (!key || seenKeywords.has(key)) continue;
    seenKeywords.add(key);
    keywords.push({
      ruleId: `neg_kw_${ruleNumber(keywords.length + 1)}`,
      source: "user_negative_keyword",
      ruleType: tokens.length > 1 ? "exact_phrase" : "exact_term",
      original: cleanEntry(original),
      normalized: key,
      tokens,
      scope: ["title", "description", "keywords"],
      severity: "hard_block",
    });
  }

  const titleExamples: NegativeTitleExample[] = [];
  const seenTitles = new Set<string>();
  for (const row of clean.titles) {
    const tokens = tokenize(row);
    const key = tokens.join(" ");
    if (!key || seenTitles.has(key)) continue;
    seenTitles.add(key);
    titleExamples.push({
      ruleId: `neg_title_${ruleNumber(titleExamples.length + 1)}`,
      source: "user_title_example",
      original: cleanEntry(row),
      normalized: key,
      tokens,
      scope: ["title"],
      severity: "guidance",
    });
  }

  if (keywords.length === 0 && titleExamples.length === 0) return null;
  return { version: NEGATIVE_POLICY_VERSION, keywords, titleExamples };
}
