import { countWords } from "@/lib/utils";
import type { MediaKind } from "@/types/files";
import type { MarketplaceRules, MetaCounts, MetaResult, UserConstraints } from "@/types/metadata";
import {
  findBanned,
  hasUnsafeChars,
  repeatedWords,
  stemUse,
  titleBreaksStrict,
  titleWordsMissing,
} from "./rulesText";

export interface ValidationResult {
  /** false = must NOT be accepted (retry / fail). */
  ok: boolean;
  issues: string[];
  /** Accepted, but worth knowing (e.g. fewer keywords than requested). */
  warnings: string[];
}

/** Final safety check of the rules, run after normalizing. */
export function validateMeta(
  meta: MetaResult,
  c: UserConstraints,
  rules?: MarketplaceRules,
  opts: { kind?: MediaKind } = {},
): ValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];

  // title (marketplaces without a title field skip this)
  if (rules && !rules.hasTitle) {
    if (meta.title) issues.push("Title must be empty.");
  } else if (!meta.title) issues.push("Title is empty.");
  else {
    if (meta.title.length > c.titleLimit) issues.push("Title is longer than the limit.");
    if (!meta.title.endsWith(".") || meta.title.endsWith("..")) {
      issues.push("Title must end with a single full stop.");
    }
    if (rules?.titleMinChars && meta.title.length < rules.titleMinChars) {
      issues.push("Title is too short.");
    }
    if (rules?.titleStrict) {
      const problem = titleBreaksStrict(meta.title);
      if (problem) issues.push(problem);
    }
  }
  const banned = (text: string) => findBanned(text, rules?.bannedTerms);
  if (banned(meta.title).length > 0) issues.push(`Title uses banned wording: ${banned(meta.title).join(", ")}.`);

  // description (only when it is switched on)
  if (c.descriptionLimit <= 0) {
    if (meta.description) issues.push("Description must be empty.");
  } else if (!meta.description) issues.push("Description is empty.");
  else {
    if (meta.description.length > c.descriptionLimit) {
      issues.push("Description is longer than the limit.");
    }
    if (!meta.description.endsWith(".")) issues.push("Description must end with a full stop.");
    if (/\.\.|\s\./.test(meta.description)) issues.push("Description has a punctuation error.");
    if (rules?.descriptionMinWords && countWords(meta.description) < rules.descriptionMinWords) {
      issues.push(`Description needs at least ${rules.descriptionMinWords} words.`);
    }
    if (rules?.descriptionSafeChars && hasUnsafeChars(meta.description)) {
      issues.push("Description has characters that are not allowed.");
    }
    if (banned(meta.description).length > 0) {
      issues.push(`Description uses banned wording: ${banned(meta.description).join(", ")}.`);
    }
    if (rules?.noRepeatedDescriptionWords) {
      const repeated = repeatedWords(meta.description);
      if (repeated.length > 0) issues.push(`Description repeats a word: ${repeated.slice(0, 3).join(", ")}.`);
    }
  }

  // keywords
  const minKeywords = Math.min(rules?.minKeywords ?? 5, c.keywordCount);
  if (meta.keywords.length < minKeywords) issues.push("Too few keywords.");
  if (meta.keywords.length > c.keywordCount) issues.push("Too many keywords.");
  if (meta.keywords.some((k) => !k || k.includes(","))) issues.push("A keyword is malformed.");
  if (new Set(meta.keywords.map((k) => k.toLowerCase())).size !== meta.keywords.length) {
    issues.push("Duplicate keywords.");
  }
  if (rules?.bannedTerms && meta.keywords.some((k) => banned(k).length > 0)) {
    issues.push("A keyword uses banned wording.");
  }
  if (rules?.stemCap) {
    const over = [...stemUse(meta.keywords).entries()].filter(([, n]) => n > rules.stemCap!);
    if (over.length > 0) issues.push(`A word appears in more than ${rules.stemCap} keywords.`);
  }
  if (rules?.titleWordsInTopKeywords && meta.title) {
    if (titleWordsMissing(meta.title, meta.keywords, rules.titleWordsInTopKeywords).length > 0) {
      issues.push(`Every title word must be in the first ${rules.titleWordsInTopKeywords} keywords.`);
    }
  }

  // categories (only for marketplaces that use them; names were matched to the list already)
  if (rules?.categories) {
    const cats = meta.categories ?? [];
    if (cats.length < 1) issues.push("No valid category.");
    if (cats.length > (rules.categoryCount ?? 2)) issues.push("Too many categories.");
    if (cats.some((x) => !rules.categories!.includes(x))) issues.push("Unknown category.");
    if (opts.kind === "video" && cats.some((x) => rules.categoriesNotForVideo?.includes(x))) {
      issues.push("A category is not available for video.");
    }
  }
  if (issues.length === 0 && meta.keywords.length < Math.floor(c.keywordCount * 0.9)) {
    warnings.push(`Only ${meta.keywords.length} of ${c.keywordCount} keywords.`);
  }

  return { ok: issues.length === 0, issues, warnings };
}

/** Numbers shown above each text box in a result card. */
export function getMetaCounts(meta: MetaResult): MetaCounts {
  return {
    titleWords: countWords(meta.title),
    titleChars: meta.title.length,
    descriptionWords: countWords(meta.description),
    descriptionChars: meta.description.length,
    keywordCount: meta.keywords.length,
  };
}
