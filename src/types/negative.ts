/**
 * Negative Prompt types.
 *
 * `NegativePromptInput` is what the user typed (kept in localStorage).
 * `NegativePolicy` is the cleaned, structured rule set built from it for ONE batch.
 */

/** Output fields a rule can apply to. */
export type NegativeField = "title" | "description" | "keywords";

/** Raw user input of the "Negative Prompts" card. */
export interface NegativePromptInput {
  /** Title example rows (1 to NEGATIVE_LIMITS.maxTitles). Rows may be empty while typing. */
  titles: string[];
  /** Committed keyword tags (0 to NEGATIVE_LIMITS.maxKeywords). */
  keywords: string[];
}

/** A term/phrase the user explicitly banned. Hard rule: must not appear in the covered fields. */
export interface NegativeKeywordRule {
  ruleId: string;
  source: "user_negative_keyword";
  /** One word = exact_term, several words = exact_phrase. */
  ruleType: "exact_term" | "exact_phrase";
  /** Exactly as the user typed it (whitespace cleaned only). Kept for display and audit. */
  original: string;
  /** Case-folded, punctuation-normalized text. */
  normalized: string;
  /** Word tokens used for token-boundary matching. */
  tokens: string[];
  scope: NegativeField[];
  severity: "hard_block";
}

/** A title the user wants to avoid. It is an example of a style, not a list of banned words. */
export interface NegativeTitleExample {
  ruleId: string;
  source: "user_title_example";
  original: string;
  normalized: string;
  tokens: string[];
  scope: ["title"];
  severity: "guidance";
}

/** The rules of one batch. `null` instead of a policy means "Negative Prompt is off". */
export interface NegativePolicy {
  version: number;
  keywords: NegativeKeywordRule[];
  titleExamples: NegativeTitleExample[];
}

/** One rule violation found in a generated result. */
export interface NegativeFinding {
  field: NegativeField;
  ruleId: string;
  matchType: "keyword" | "title_example";
  /** The user's original banned term (or example title) that was matched. */
  matched: string;
}
