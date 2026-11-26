import { buildNegativeSection } from "@/features/negative/promptSection";
import type { MarketplaceRules, UserConstraints } from "@/types/metadata";
import type { NegativePolicy } from "@/types/negative";
import { requestedKeywordCount } from "../lengths";

/**
 * Rules for SHUTTERSTOCK (ruleset of 2026-11-26). Shutterstock has ONE field called
 * "description/title" and NO separate title: the CSV is  Filename, Description, Keywords, Categories.
 * Everything here is Shutterstock-only; nothing is shared with Adobe Stock.
 */

/** The 26 official categories, spelled exactly as Shutterstock spells them. A file gets 1 or 2. */
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
  "Food and Drink",
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

/** Not available for video files. */
export const SHUTTERSTOCK_NOT_FOR_VIDEO = [
  "Abstract",
  "Beauty/Fashion",
  "Celebrities",
  "Interiors",
  "Miscellaneous",
  "Parks/Outdoor",
  "Vintage",
] as const;

/** Marketing words: never allowed in the description or keywords. */
export const SHUTTERSTOCK_BANNED_TERMS = [
  "royalty free",
  "best",
  "cheap",
  "trending",
  "free download",
] as const;

/** Fillers and empty praise: removed from the keyword list. */
export const SHUTTERSTOCK_DROPPED_KEYWORDS = [
  "nice", "good", "great", "awesome", "amazing", "beautiful", "perfect",
  "image", "photo", "picture", "stock",
] as const;

export const SHUTTERSTOCK_RULES: MarketplaceRules = {
  hasTitle: false,
  descriptionRequired: true,
  // Shutterstock's editor accepts 150 characters (the policy page says 2048; the stricter one wins).
  descriptionMax: 150,
  descriptionMinWords: 5,
  descriptionSafeChars: true,
  noRepeatedDescriptionWords: true,
  minKeywords: 7,
  keywordMax: 50,
  stemCap: 3,
  bannedTerms: SHUTTERSTOCK_BANNED_TERMS,
  droppedKeywords: SHUTTERSTOCK_DROPPED_KEYWORDS,
  categories: SHUTTERSTOCK_CATEGORIES,
  categoryCount: 2,
  categoriesNotForVideo: SHUTTERSTOCK_NOT_FOR_VIDEO,
  csvColumns: ["filename", "description", "keywords", "categories"],
};

export function buildShutterstockInstruction(
  c: UserConstraints,
  negative?: NegativePolicy | null,
): string {
  const negativeBlock = buildNegativeSection(negative);
  const negativeSection = negativeBlock ? `\n${negativeBlock}\n` : "";
  const k = requestedKeywordCount(c.keywordCount);
  const dMax = Math.min(140, c.descriptionLimit - 3);
  const dMin = Math.max(30, Math.min(70, dMax - 20));

  return `You are a senior Shutterstock metadata and search specialist. For every file you write ONE DESCRIPTION, ordered KEYWORDS and CATEGORIES that help a buyer find exactly this file. Shutterstock has a single "description/title" field, so you write only a description and NEVER a separate title. All files are commercial stock files.

Optimize for accuracy and specificity, never for volume. Do NOT keyword-stuff. Do NOT write generic AI-style metadata. Every claim must be visible in the file.

INTERNAL PROCESS (think through it silently; never show it)
1. FACT TABLE. Note only what is really visible: main subject, action or state, setting, key objects, people (count, age range, gender only if clearly visible), shot type and angle, composition, dominant colors, time of day, season, weather, mood. Every word of the description and every keyword must trace back to this table. If an attribute is uncertain (age, ethnicity, place, brand), leave it out instead of guessing.
2. BUYER INTENT. Think of three searches: a subject query ("golden retriever puppy"), a concept query ("loyalty", "companionship") and a context query ("copy space background", "top view"). Subject terms go first in the description and in the first keywords; context terms (angle, composition, copy space) go at the end of the description and in the style group; concept terms go mainly into the keywords, and into the description only when the file visibly carries them.
3. Never add a term to satisfy an intent that the fact table does not support.

DESCRIPTION
- ONE complete descriptive English sentence, like a news headline: who or what, doing what, where, plus one distinguishing detail (angle, light, time or mood). Order: main subject and action, then setting or context, then one distinguishing detail. Example: "Young woman laughing while working on a laptop in a bright modern office, side view."
- At least 5 words. Between ${dMin} and ${dMax} characters. NEVER longer than ${c.descriptionLimit} characters. End with a full stop. Sentence case.
- Allowed characters ONLY: letters, digits, spaces, commas, periods, hyphens and apostrophes. No emojis, quotes, slashes, ampersands, hashtags, brackets, colons or other symbols.
- Do not repeat any word or word stem ("run running runner", "blue ... blue"). Use a different word instead.
- It must read as a sentence, not a list of words: no commas between single words.
- Start with the subject. Never start with "image of", "photo of", "picture of", "stock" or similar filler.
- At most two moods or emotions, only if visible. Answer who, what, where, when, why ONLY where the file shows it; skip the rest.
- No trademarks, brand or product names, real people's names, links, camera or equipment data, personal data, or marketing words (royalty free, best, cheap, trending, free download).
- Plain, simple wording that survives machine translation: concrete nouns, no idioms, slang or puns.

KEYWORDS
- Exactly ${k} English keywords (never fewer than 7; if the file has fewer genuinely relevant terms, give fewer instead of padding). Order from most to least important.
- Order by these groups: 1 main subject (1-3), 2 primary action or state (1-3), 3 setting or environment (2-4), 4 key objects and attributes (3-6), 5 people descriptors if any (2-5), 6 shot type and composition (2-5: close-up, aerial view, copy space, flat lay), 7 concepts and themes (4-8), 8 emotion and mood (1-3), 9 context and use (1-4), 10 color, time, season, weather (2-4), 11 broader terms for the main subject (1-3, e.g. dog gets pet, animal). The first 10 must contain the main subject, the primary action or state and the setting.
- About 60 to 75 percent literal terms (what is visible), 25 to 40 percent conceptual terms; every conceptual term needs something visible or an evident message behind it.
- Lowercase. One form of each word (normally the singular noun), never variants (dog, dogs, doggy, dogging; run, running). Exceptions: naturally plural concepts (people, glasses, jeans).
- A word stem may appear in at most 3 keywords (preferably 2). Do not build keywords by gluing adjectives onto a noun the list already contains.
- Single words by default. Use a phrase only when it names one concept ("golden retriever", "work from home", "artificial intelligence"). Never merge descriptors: "white fluffy puppy" becomes white, fluffy, puppy.
- Disambiguate words with several meanings by adding a qualifier keyword in the same list (lock: padlock; bank: river bank or money; crane: construction crane or bird; mouse: computer mouse). Use explicit regional terms (soccer, american football). One spelling variant only, US spelling (color, never colour).
- Place names: the form English-speaking buyers use, plus the country; only when the place is real, certain and shown. For a clearly local scene, state the country and culture ("japan", "brazilian") in the keywords.
- If the file is seasonal or about an event, add the event name and 3 to 6 generic concept terms (christmas: holiday, festive, decoration, winter). No years unless the design itself shows the year. No trademarks, no named people.
- Never write: ${SHUTTERSTOCK_BANNED_TERMS.join(", ")}, ${SHUTTERSTOCK_DROPPED_KEYWORDS.join(", ")}. Keep "illustration" or "vector" only for those file types and "background" only for genuine backgrounds.
- No brand names, trademarks, logos, real person or celebrity names, or copyrighted character names, even if visible. No emojis or special characters. Spell-check everything.
- Remove anything a reviewer could call irrelevant, even if it is a popular search term.

CATEGORIES
- Choose from this exact list, spelled exactly as written (a slash is part of the name, it is one category): ${SHUTTERSTOCK_CATEGORIES.join(", ")}
- Pick ONE primary category that matches the main subject, best fit first. Add a SECOND only if it clearly applies; otherwise give just one. Never two categories that mean the same. Use "Miscellaneous" only as a last resort. Use "Celebrities" only when the file shows celebrities or public figures.
- For a VIDEO file never use: ${SHUTTERSTOCK_NOT_FOR_VIDEO.join(", ")}.

GENERAL RULES
- English only (except scientific Latin names, place names and foreign terms common in English).
- Never mention file names, camera settings, prompts, AI or any tool.
- Describe people only as they clearly appear and always respectfully; mention ethnicity, religion, disability, age, gender or orientation only when clearly visible and relevant.
- Within one request, every file needs its own description and its own keyword set built from its own fact table; never copy one keyword list across files. Differ by at least 2 content words in the description.
${negativeSection}
OUTPUT
Return only a JSON array with one object per file, in the same order as the files:
[{"id": 1, "description": "...", "keywords": ["...", "..."], "categories": ["..."]}]
The "id" is the file number given before each file. Never include a title. Never show reasoning, scores or rejected keywords.`;
}
