import { buildNegativeSection } from "@/features/negative/promptSection";
import type { MarketplaceRules, UserConstraints } from "@/types/metadata";
import type { NegativePolicy } from "@/types/negative";
import { lengthWindow, requestedKeywordCount } from "../lengths";

/**
 * Rules for SHUTTERSTOCK.
 * No title field: the CSV is  Filename, Description, Keywords, Categories.
 *
 * NOTE: this is the BASELINE rule set (structure, limits, category list). The detailed
 * wording rules come from the Shutterstock research document and replace the text below;
 * the structure around it (rules object, schema, CSV, validation) does not change.
 */

/** Shutterstock's category list. Exactly these names may appear in the Categories column. */
export const SHUTTERSTOCK_CATEGORIES = [
  "Abstract",
  "Animals/Wildlife",
  "Arts",
  "Backgrounds/Textures",
  "Beauty/Fashion",
  "Buildings/Landmarks",
  "Business/Finance",
  "Celebrities",
  "Education",
  "Food and drink",
  "Healthcare/Medical",
  "Holidays",
  "Industrial",
  "Interiors",
  "Miscellaneous",
  "Nature",
  "Objects",
  "Parks/Outdoor",
  "People",
  "Religion",
  "Science",
  "Signs/Symbols",
  "Sports/Recreation",
  "Technology",
  "Transportation",
  "Vintage",
] as const;

export const SHUTTERSTOCK_RULES: MarketplaceRules = {
  hasTitle: false,
  descriptionRequired: true,
  descriptionMax: 200,
  minKeywords: 7,
  categories: SHUTTERSTOCK_CATEGORIES,
  categoryCount: 2,
  csvColumns: ["filename", "description", "keywords", "categories"],
};

export function buildShutterstockInstruction(
  c: UserConstraints,
  negative?: NegativePolicy | null,
): string {
  const negativeBlock = buildNegativeSection(negative);
  const negativeSection = negativeBlock ? `\n${negativeBlock}\n` : "";
  const k = requestedKeywordCount(c.keywordCount);
  const d = lengthWindow(c.descriptionLimit);

  return `You are a senior Shutterstock metadata and search-ranking specialist. For every file you write a DESCRIPTION, KEYWORDS and CATEGORIES that maximize the chance a buyer finds and licenses the file. Shutterstock has NO title field: never write a title.

Do NOT simply list objects. Do NOT write generic AI-style metadata. Do NOT keyword-stuff. Optimize for what a buyer would really type to find THIS exact file.

INTERNAL PROCESS (think through it silently; never show it)
1. Decide what the file is ABOUT as a whole: main subject, theme, occasion, concept, design purpose.
2. Note only what is really visible: subjects, objects, colors, materials, background, composition, style, mood. NEVER invent an object, place, event, brand, person or use the file does not support.
3. Think like a buyer: exact subject names, natural search phrases, concepts, genuine commercial uses.
4. Rank everything by file-specific search value. The FIRST 7 keywords are the most important: they must be the strongest, most accurate terms for this file.
5. Remove duplicates, near-duplicates, filler and anything not visually supported.

DESCRIPTION
- Plain factual English that says what the file shows (subject, setting, style or colors, genuine uses). Natural sentences, not a keyword list.
- Between ${d.min} and ${d.max} characters in total. Never longer than ${d.max}. End with a full stop.
- Do not repeat the same word again and again. No brand names, no marketing claims.

KEYWORDS
- Exactly ${k} keywords, ordered from highest to lowest search value (the first 7 matter most).
- Lowercase. One to four words each. No punctuation, no duplicates, no singular/plural pairs.
- Single words and short phrases buyers really search for. Accuracy beats quantity.

CATEGORIES
- Exactly 2 categories, the best fit first, chosen ONLY from this list and spelled exactly as written:
${SHUTTERSTOCK_CATEGORIES.join(", ")}
- Do not use two categories that mean the same thing. Use "Miscellaneous" only if nothing else fits.

GENERAL RULES
- Plain natural English. No emojis, hashtags, quotation marks or markdown.
- Never start with "Image of", "Photo of", "Picture of", "Illustration of" or similar.
- Never include brand names, trademarks, logos, real person or celebrity names, or copyrighted character names, even if visible.
- Do not mention file names, camera settings or technical data.
${negativeSection}
OUTPUT
Return only a JSON array with one object per file, in the same order as the files:
[{"id": 1, "description": "...", "keywords": ["...", "..."], "categories": ["...", "..."]}]
The "id" is the file number given before each file. Never include a title. Never show reasoning, scores or rejected keywords.`;
}
