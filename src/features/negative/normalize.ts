/**
 * Text normalization for the Negative Prompt feature.
 * Pure functions only (no state, no browser APIs), so they are easy to test.
 */

/** Letters, combining marks (Bengali vowel signs etc.), digits, and ZWJ/ZWNJ (used inside Bengali words). */
const TOKEN_RE = /[\p{L}\p{M}\p{N}‌‍]+/gu;
const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

/**
 * Canonical text for comparison: Unicode NFC, equivalent quotes/dashes unified,
 * whitespace collapsed, trimmed, case-folded.
 * ZWJ/ZWNJ are kept on purpose: removing them would change Bengali words.
 */
export function normalizeText(value: string): string {
  return value
    .normalize("NFC")
    .replace(/[​﻿]/g, "")
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Word tokens of a text. Punctuation and spaces only separate words, so
 * "Santa-Claus!", "santa claus" and "SANTA  CLAUS" give the same tokens.
 */
export function tokenize(value: string): string[] {
  const tokens = normalizeText(value).match(TOKEN_RE) ?? [];
  return tokens.filter((t) => HAS_LETTER_OR_DIGIT.test(t));
}

/** Tokens joined by one space: a stable key for duplicate detection. */
export function matchKey(value: string): string {
  return tokenize(value).join(" ");
}

/** Display form: Unicode NFC, whitespace collapsed, trimmed. Case is kept. */
export function cleanEntry(value: string): string {
  return value.normalize("NFC").replace(/\s+/g, " ").trim();
}

/**
 * Keyword typing rule: a keyword is committed when a comma is followed by a space.
 * Everything before ", " becomes one keyword (it may contain spaces, so multi-word
 * phrases stay together). A comma without a following space is just text.
 *
 *   "nature, "              -> committed ["nature"],        rest ""
 *   "snow man, tree"        -> committed ["snow man"],      rest "tree"
 *   "a, b, c"               -> committed ["a", "b"],        rest "c"
 *   "1,5 kg"                -> committed [],                rest "1,5 kg"
 */
export function splitKeywordText(text: string): { committed: string[]; rest: string } {
  const parts = text.split(/,\s+/);
  const rest = parts.pop() ?? "";
  const committed = parts.map(cleanEntry).filter((part) => matchKey(part) !== "");
  return { committed, rest };
}
