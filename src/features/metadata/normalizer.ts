import type { MarketplaceRules, MetaResult, UserConstraints } from "@/types/metadata";

/**
 * Hard-enforces the output rules, whatever the AI returned:
 *  - title: <= limit chars, ends with ONE full stop
 *  - description: whole sentences, each ending ". ", total <= limit, ends with a full stop
 *  - keywords: lowercase, no duplicates, at most `count`, joined with ", " (no trailing comma)
 */

const CONNECTORS = new Set([
  "and", "or", "with", "for", "of", "in", "on", "at", "to", "from", "by", "a", "an",
  "the", "over", "under", "into", "onto", "as", "near", "against", "through", "across",
  "between", "during", "while", "featuring", "showing", "is", "are",
]);

function squash(text: string): string {
  return text
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripWrapping(text: string): string {
  return text
    .replace(/[*_`#]+/g, "")
    .replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, "")
    .trim();
}

function capitalizeFirst(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** Longest prefix of `text` that is <= maxLen and does not cut a word in half. */
function cutToWord(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  let cut = text.slice(0, maxLen);
  const nextIsSpace = /\s/.test(text.charAt(maxLen));
  if (!nextIsSpace) {
    const i = cut.lastIndexOf(" ");
    if (i > 0) cut = cut.slice(0, i);
  }
  return cut.trimEnd();
}

/** Remove trailing punctuation and dangling words like "and", "with", "of". */
function trimTail(text: string): string {
  let t = text;
  for (;;) {
    t = t.replace(/[\s,;:\-–—.!?'"]+$/, "");
    const words = t.split(" ");
    const last = (words[words.length - 1] ?? "").toLowerCase();
    if (words.length > 3 && CONNECTORS.has(last)) {
      words.pop();
      t = words.join(" ");
    } else {
      return t;
    }
  }
}

export function normalizeTitle(raw: string, limit: number): string {
  let t = stripWrapping(squash(raw)).replace(/[.!?\s]+$/, "");
  const room = limit - 1; // one character is kept for the final full stop
  t = t.length > room ? trimTail(cutToWord(t, room)) : t.replace(/[\s,;:\-–—]+$/, "");
  t = capitalizeFirst(t);
  return t ? `${t}.` : "";
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/);
}

export function normalizeDescription(raw: string, limit: number): string {
  const cleaned = stripWrapping(squash(raw));
  const seen = new Set<string>();
  const sentences: string[] = [];
  for (const s of splitSentences(cleaned)) {
    const body = s.replace(/[\s,;:\-–—.!?]+$/, "").trim();
    const key = body.toLowerCase();
    if (!body || seen.has(key)) continue;
    seen.add(key);
    sentences.push(body);
  }

  let out = "";
  for (const s of sentences) {
    const piece = `${capitalizeFirst(s)}.`;
    const next = out ? `${out} ${piece}` : piece;
    if (next.length > limit) break;
    out = next;
  }

  // Even the first sentence is too long: cut it at a word boundary.
  if (!out && sentences[0]) {
    const cut = trimTail(cutToWord(sentences[0], limit - 1));
    out = cut ? `${capitalizeFirst(cut)}.` : "";
  }
  return out;
}

export function normalizeKeywords(raw: string[] | string | undefined, count: number): string[] {
  const parts = Array.isArray(raw)
    ? raw.flatMap((k) => String(k).split(/[,;\n]+/))
    : String(raw ?? "").split(/[,;\n]+/);

  const seen = new Set<string>();
  const out: string[] = [];

  for (const part of parts) {
    let k = squash(part)
      .toLowerCase()
      .replace(/^(?:\d+[.)]\s+|[-–—•*#]\s*)/, "") // list markers
      .replace(/[^\p{L}\p{N}\s'’-]/gu, "") // drop odd characters
      .replace(/^[\s'’-]+|[\s'’-]+$/g, "");
    k = squash(k);

    if (k.length < 2 || k.length > 40 || k.split(" ").length > 4) continue;

    const key = k.length > 3 ? k.replace(/s$/, "") : k; // flag / flags count as one
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(k);
    if (out.length >= count) break;
  }
  return out;
}

/**
 * Keeps only names from the marketplace's category list (matched without regard to case or
 * spaces around "/"), returns them spelled exactly as in the list, no duplicates, at most `max`.
 */
export function normalizeCategories(
  raw: string[] | string | undefined,
  allowed: readonly string[],
  max: number,
): string[] {
  const key = (s: string) => squash(s).toLowerCase().replace(/\s*\/\s*/g, "/");
  const byKey = new Map(allowed.map((name) => [key(name), name]));
  const parts = Array.isArray(raw)
    ? raw.flatMap((c) => String(c).split(/[,;\n]+/))
    : String(raw ?? "").split(/[,;\n]+/);
  const out: string[] = [];
  for (const part of parts) {
    const name = byKey.get(key(stripWrapping(part)));
    if (name && !out.includes(name)) out.push(name);
    if (out.length >= max) break;
  }
  return out;
}

export function formatKeywords(keywords: readonly string[]): string {
  return keywords.join(", ");
}

export interface RawMeta {
  title: string;
  description?: string;
  keywords: string[] | string;
  categories?: string[] | string;
}

/** `rules` = the marketplace's structure. Left out = the original title + description + keywords. */
export function normalizeMeta(raw: RawMeta, c: UserConstraints, rules?: MarketplaceRules): MetaResult {
  const meta: MetaResult = {
    title: rules && !rules.hasTitle ? "" : normalizeTitle(raw.title, c.titleLimit),
    description: c.descriptionLimit > 0 ? normalizeDescription(raw.description ?? "", c.descriptionLimit) : "",
    keywords: normalizeKeywords(raw.keywords, c.keywordCount),
  };
  if (rules?.categories) {
    meta.categories = normalizeCategories(raw.categories, rules.categories, rules.categoryCount ?? 2);
  }
  return meta;
}
