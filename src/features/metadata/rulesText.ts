/**
 * Small text helpers used by the per-marketplace checks (banned terms, repeated words,
 * word stems, title words inside the first keywords). Pure functions, no marketplace names here.
 */

export const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "with", "for", "of", "in", "on", "at", "to", "from", "by",
  "over", "under", "into", "onto", "as", "near", "against", "through", "across", "between",
  "during", "while", "is", "are", "its", "it", "their", "his", "her", "that", "this", "up",
  "down", "out", "off", "than", "then", "but", "not", "no", "be", "has", "have", "very", "also",
  "featuring", "showing",
]);

/** Lowercase word tokens (letters, digits, inner apostrophes). */
export function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? []).map((t) =>
    t.replace(/['’]/g, ""),
  );
}

/** Crude English stem: running / runner / runs -> run, glasses -> glass. */
export function stem(word: string): string {
  let s = word.toLowerCase();
  for (const suffix of ["ing", "ers", "ed", "er", "es", "ly", "s"]) {
    if (s.length > suffix.length + 2 && s.endsWith(suffix)) {
      if (suffix === "s" && s.endsWith("ss")) break;
      s = s.slice(0, -suffix.length);
      break;
    }
  }
  if (s.length > 3 && /(.)\1$/.test(s) && !s.endsWith("ss")) s = s.slice(0, -1);
  return s;
}

const isContent = (t: string) => t.length >= 3 && !STOP_WORDS.has(t);

/** Meaningful words of a text, in order, one per stem. */
export function contentWords(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokens(text)) {
    if (!isContent(t)) continue;
    const s = stem(t);
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(t);
  }
  return out;
}

/** Content words (by stem) used more than once in the text, e.g. "blue ... blue". */
export function repeatedWords(text: string): string[] {
  const count = new Map<string, { word: string; n: number }>();
  for (const t of tokens(text)) {
    if (!isContent(t)) continue;
    const s = stem(t);
    const e = count.get(s);
    if (e) e.n++;
    else count.set(s, { word: t, n: 1 });
  }
  return [...count.values()].filter((e) => e.n > 1).map((e) => e.word);
}

const match = (s: string) => ` ${tokens(s.replace(/[-_/]/g, " ")).join(" ")} `;

/** Banned words/phrases found in the text (whole-word match, case and punctuation ignored). */
export function findBanned(text: string, banned: readonly string[] | undefined): string[] {
  if (!banned || banned.length === 0) return [];
  const haystack = match(text);
  return banned.filter((term) => {
    const needle = match(term);
    return needle.trim() !== "" && haystack.includes(needle);
  });
}

/** Removes banned words/phrases from a text (whole words, any case, hyphen or space inside). */
export function stripBanned(text: string, banned: readonly string[] | undefined): string {
  if (!banned || banned.length === 0) return text;
  let out = text;
  for (const term of banned) {
    const words = tokens(term);
    if (words.length === 0) continue;
    const body = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\s\\-_]+");
    out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, "giu"), " ");
  }
  return out.replace(/\s+/g, " ").replace(/\s+([,.])/g, "$1").trim();
}

/** Keeps only letters, digits, spaces, commas, periods, hyphens and apostrophes. */
export function sanitizeSafeText(text: string): string {
  return text
    .replace(/&/g, " and ")
    .replace(/[–—]/g, "-")
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}\s,.\-']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function hasUnsafeChars(text: string): boolean {
  return /[^\p{L}\p{N}\s,.\-']/u.test(text);
}

const TITLE_FORBIDDEN = /[,:;|/\\"“”#@*_`~<>[\]{}!?&()]|\p{Extended_Pictographic}/u;
const TITLE_FORBIDDEN_G = new RegExp(TITLE_FORBIDDEN.source, "gu");

/** Title cleanup: forbidden characters become spaces, SHOUTED words become lowercase. */
export function sanitizeTitleStrict(text: string): string {
  return text
    .replace(TITLE_FORBIDDEN_G, " ")
    .replace(/\b\p{Lu}{4,}\b/gu, (w) => w.toLowerCase())
    .replace(/\s+/g, " ")
    .trim();
}

export function titleBreaksStrict(title: string): string | null {
  const body = title.replace(/\.$/, "");
  if (TITLE_FORBIDDEN.test(body)) return "Title has forbidden characters (commas, colons, slashes, quotes or similar).";
  if (/\b\p{Lu}{4,}\b/u.test(body)) return "Title contains ALL CAPS words.";
  return null;
}

const coversWord = (keyword: string, word: string) => {
  const s = stem(word);
  return tokens(keyword).some((t) => stem(t) === s);
};

/** Meaningful title words that are NOT inside the first `topN` keywords. */
export function titleWordsMissing(title: string, keywords: readonly string[], topN: number): string[] {
  const words = contentWords(title.replace(/\.$/, "")).slice(0, topN);
  const top = keywords.slice(0, topN);
  return words.filter((w) => !top.some((k) => coversWord(k, w)));
}

/**
 * Makes sure every meaningful title word is inside the first `topN` keywords.
 * A keyword that already holds the word is moved up; otherwise the word itself is added.
 * Everything else keeps its order. The list is cut to `max` at the end.
 */
export function alignTitleKeywords(
  title: string,
  keywords: readonly string[],
  topN: number,
  max: number,
): string[] {
  const zone = Math.min(topN, max); // premium slots that really exist
  const words = contentWords(title.replace(/\.$/, "")).slice(0, zone);
  const keep = new Set<number>(); // existing keywords that must sit in the premium zone
  const added: string[] = []; // title words no keyword holds yet
  for (const word of words) {
    const inTop = keywords.findIndex((k, i) => i < zone && coversWord(k, word));
    if (inTop >= 0) {
      keep.add(inTop);
      continue;
    }
    const later = keywords.findIndex((k, i) => i >= zone && !keep.has(i) && coversWord(k, word));
    if (later >= 0) keep.add(later);
    else added.push(word.toLowerCase());
  }
  // Fill the rest of the premium zone with the strongest keywords, in their original order.
  for (let i = 0; i < keywords.length && keep.size + added.length < zone; i++) keep.add(i);

  const premium = keywords.filter((_, i) => keep.has(i));
  const rest = keywords.filter((_, i) => !keep.has(i));
  return [...premium, ...added, ...rest].slice(0, max);
}

/** How many keywords already hold each word stem. Used for the "stem cap". */
export function stemUse(keywords: readonly string[]): Map<string, number> {
  const use = new Map<string, number>();
  for (const k of keywords) {
    for (const s of new Set(tokens(k).filter(isContent).map(stem))) use.set(s, (use.get(s) ?? 0) + 1);
  }
  return use;
}
