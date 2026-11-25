import type { MetaResult } from "@/types/metadata";
import type { NegativeField, NegativeFinding, NegativePolicy } from "@/types/negative";
import { tokenize } from "./normalize";

/**
 * Checks finished metadata against the Negative Prompt rules.
 * Runs locally (no API call). Matching is on whole words, never on parts of words:
 * "tree" matches "Tree", "tree," and "trees", but not "street" or "streetcar".
 */

/** Titles that copy a user example this closely are flagged (shorter overlaps are normal words). */
const MIN_EXAMPLE_TOKENS = 3;

const PLAIN_WORD = /^[a-z]+$/;

/** Same word, or its simple English plural (tree -> trees, box -> boxes). */
function sameWord(text: string, banned: string): boolean {
  if (text === banned) return true;
  if (banned.length >= 3 && PLAIN_WORD.test(banned)) {
    return text === `${banned}s` || text === `${banned}es`;
  }
  return false;
}

/**
 * Does `needle` (the banned words) appear as a whole-word run inside `haystack`?
 * With `allowPlural` the LAST banned word may also appear as its plural.
 */
function containsRun(haystack: readonly string[], needle: readonly string[], allowPlural: boolean): boolean {
  if (needle.length === 0 || haystack.length < needle.length) return false;
  const last = needle.length - 1;
  for (let start = 0; start + needle.length <= haystack.length; start++) {
    let ok = true;
    for (let i = 0; i < needle.length; i++) {
      const text = haystack[start + i]!;
      const banned = needle[i]!;
      const match = i === last && allowPlural ? sameWord(text, banned) : text === banned;
      if (!match) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

/** Every rule violation in one result. Empty array = clean. */
export function findNegativeViolations(meta: MetaResult, policy: NegativePolicy): NegativeFinding[] {
  const findings: NegativeFinding[] = [];

  const titleTokens = tokenize(meta.title);
  const descriptionTokens = tokenize(meta.description);
  const keywordTokens = meta.keywords.map((k) => tokenize(k));

  const textFields: Array<[NegativeField, readonly string[]]> = [
    ["title", titleTokens],
    ["description", descriptionTokens],
  ];

  for (const rule of policy.keywords) {
    for (const [field, tokens] of textFields) {
      if (rule.scope.includes(field) && containsRun(tokens, rule.tokens, true)) {
        findings.push({ field, ruleId: rule.ruleId, matchType: "keyword", matched: rule.original });
      }
    }
    if (rule.scope.includes("keywords") && keywordTokens.some((t) => containsRun(t, rule.tokens, true))) {
      findings.push({ field: "keywords", ruleId: rule.ruleId, matchType: "keyword", matched: rule.original });
    }
  }

  for (const example of policy.titleExamples) {
    // A title that copies the example (whole, or a run of 3+ words of it) is not allowed.
    if (example.tokens.length >= MIN_EXAMPLE_TOKENS && containsRun(titleTokens, example.tokens, false)) {
      findings.push({ field: "title", ruleId: example.ruleId, matchType: "title_example", matched: example.original });
    } else if (example.tokens.length < MIN_EXAMPLE_TOKENS && sameRun(titleTokens, example.tokens)) {
      // Short example (1-2 words): only an identical title counts.
      findings.push({ field: "title", ruleId: example.ruleId, matchType: "title_example", matched: example.original });
    }
  }

  return findings;
}

function sameRun(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((token, i) => token === b[i]);
}

/** The wording to avoid on the next try (unique, in order of first appearance). */
export function violationTerms(findings: readonly NegativeFinding[]): string[] {
  return [...new Set(findings.map((f) => f.matched))];
}

/** Short message for the result card, e.g. `Contains banned wording: "santa claus" (title, keywords).` */
export function describeViolations(findings: readonly NegativeFinding[]): string {
  const where = [...new Set(findings.map((f) => f.field))].join(", ");
  const terms = violationTerms(findings)
    .map((t) => `"${t}"`)
    .join(", ");
  return `Contains banned wording: ${terms} (${where}).`;
}
