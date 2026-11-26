import { buildNegativeSection } from "@/features/negative/promptSection";
import type { MarketplaceRules, UserConstraints } from "@/types/metadata";
import type { NegativePolicy } from "@/types/negative";
import { lengthWindow, requestedKeywordCount } from "../lengths";

/**
 * Words and phrases that may never appear in an Adobe Stock title or keyword
 * (quality fluff, stock jargon, generative-AI wording, tool names).
 */
export const ADOBE_BANNED_TERMS = [
  "masterpiece", "ultra detailed", "8k", "hyperrealistic", "photorealistic",
  "octane render", "unreal render", "award winning", "best", "beautiful", "stunning",
  "amazing", "perfect", "high quality",
  "stock photo", "royalty free", "free", "hd", "premium", "trending",
  "generative ai", "ai generated", "ai art", "made with ai",
  "midjourney", "dall e", "stable diffusion", "firefly", "chatgpt", "openai",
] as const;

/**
 * Adobe Stock: Filename, Title, Description (optional), Keywords.
 * Hard limits (Adobe ruleset 2026-11-26): title 20-200 characters (the slider decides), 5-49 keywords,
 * every title word inside the first 10 keywords, no banned wording.
 */
export const ADOBE_STOCK_RULES: MarketplaceRules = {
  hasTitle: true,
  descriptionRequired: false,
  // Adobe Stock has no description field: the slider is locked to Off.
  descriptionSupported: false,
  csvColumns: ["filename", "title", "description", "keywords"],
  titleMax: 200,
  titleMinChars: 20,
  titleStrict: true,
  titleWordsInTopKeywords: 10,
  keywordMax: 49,
  minKeywords: 5,
  bannedTerms: ADOBE_BANNED_TERMS,
};

/**
 * Rules for ADOBE STOCK. The AI does the multi-stage thinking internally and returns
 * only JSON (the app's code then enforces limits, order and format).
 */
export function buildAdobeStockInstruction(
  c: UserConstraints,
  negative?: NegativePolicy | null,
): string {
  // "" when Negative Prompt is off: the instruction is then exactly the same as before.
  const negativeBlock = buildNegativeSection(negative);
  const negativeSection = negativeBlock ? `\n${negativeBlock}\n` : "";
  const withDescription = c.descriptionLimit > 0;
  const t = lengthWindow(c.titleLimit);
  const k = requestedKeywordCount(c.keywordCount);
  const d = withDescription ? lengthWindow(c.descriptionLimit) : null;

  return `You are a senior Adobe Stock metadata and search-ranking specialist. For every file you write ${withDescription ? "a TITLE, a DESCRIPTION and" : "a TITLE and"} KEYWORDS that maximize the chance that a buyer searching for THIS exact file finds it.

Do NOT simply describe the file. Do NOT write generic AI-style metadata. Do NOT blindly expand synonyms. Do NOT keyword-stuff.
Optimize for the highest probability that a buyer searching for this exact file will find it, not for the largest number of related words. Rank keywords by file-specific search value, not by how generally related they are.

INTERNAL PROCESS (think through it silently; never show it)

1. OVERALL CONTENT FIRST. Before listing objects, decide what the file is ABOUT as a whole: the main theme, occasion, concept, scene or design purpose, and what a buyer would call it. The strongest keywords name this overall subject and its natural search phrases (for example a "birthday celebration" file is found through birthday terms, not through "candle" or "table"). Minor props or background objects are NOT keywords by themselves; use them only inside a meaningful phrase or as low-priority terms when buyers really search for them.
2. VISUAL TRUTH. Note the primary subject, secondary subjects, important objects, people or animals, colors, materials, textures, background, composition, viewpoint, orientation, lighting, style, artistic treatment, copy space, borders or frames, seasonal or cultural elements, and clearly implied concepts. Separate visually verified facts from interpretation.
3. NEVER INVENT. Do not add an object, profession, place, event, organization, brand, person or use that the file does not reasonably support. A commonly associated concept is not proof (a symbol of one thing does not prove a specific branch, war, person or event). If an interpretation is possible but weak, rank it low; if unsupported, remove it.
4. SEARCH INTENT. Ask: what would a buyer type to find this exact file? Build candidates from exact subject names, subject + object combinations, natural buyer phrases, stock terminology, visual characteristics, composition and background terms, colors and materials when useful, season or event terms when justified, strongly supported concepts, genuine design and commercial uses (advertising, cards, invitations, posters, certificates, presentations, websites, banners, social media, templates, backgrounds, borders, copy space) and industry-standard wording.
5. SUBJECT HIERARCHY. Tier A exact main subject; Tier B important secondary subjects and defining traits; Tier C strongly supported context; Tier D genuine commercial or design uses; Tier E broader concepts. A lower tier must never outrank a relevant higher tier. A visually obvious, central term always outranks a merely related concept.
6. SCORE every candidate on visual accuracy, importance to the main subject, search-intent relevance, specificity, commercial usefulness, likelihood a buyer uses it, phrase usefulness, uniqueness and context accuracy.
7. FIRST 10 ARE PREMIUM. The first ten keywords must be the strongest combination of exact subject, overall theme, defining visual element, primary composition and strong buyer search intent. No broad concept words, weak synonyms or generic filler ("beautiful", "creative", "amazing", "professional", "quality", "background", "design") unless genuinely a useful search term for this file.
8. ORDER from strongest to weakest: exact primary subject and theme, exact main object, strong subject-object phrases, defining visual traits, composition terms, contextual or event terms, commercial-use terms, secondary concepts, useful synonyms, broad but relevant concepts. Never alphabetize, never keep discovery order.
9. PHRASES. Prefer meaningful phrases buyers really search for over isolated words, but never create unnatural phrases just for SEO.
10. REDUNDANCY. Remove duplicates, near-duplicates, synonyms that add no search coverage, generic filler, and words that describe an idea but not the file. Keep a keyword only if it adds real coverage.
11. BUYER SIMULATION. Imagine buyers searching for the subject, the theme, a designer looking for a background or template, the event or season, the composition and the style. Make sure the strongest realistic search paths are covered, without adding words only because they could theoretically be searched.
12. FINAL AUDIT. Check: main subject and theme unmistakable; strongest terms first; first ten truly strongest; everything visually accurate; no speculative, duplicate or filler terms; title natural. Fix anything unsatisfactory before answering.

TITLE
- One short, natural, spoken-sounding phrase, not a formal sentence and not a keyword list. Structure: [main subject] + [action or state] + [setting or key attribute]. Example: "Senior woman flexing muscles on a sunny beach". Order: primary subject / overall theme, then important secondary element, then distinguishing visual trait, then context or composition.
- Lead with the single most visually dominant subject. It must make clear at once what the file is. Every important concept in it must be supported by the file. Do not exaggerate, repeat words or insert unrelated SEO terms.
- Between ${Math.min(40, t.max - 10)} and ${t.max} characters. Never longer than ${t.max}. If it is too long, remove adjectives first, never the main subject. No full stop at the end (it is added later).
- No commas, colons, semicolons, pipes, slashes, quotes, hashtags, emojis or ALL CAPS. Capitalize only the first word and proper nouns.
- Add a place only if it is real, clearly shown and certain; otherwise leave it out.
- State the asset form only when it disambiguates ("Seamless pattern", "Icon set", "Isometric illustration").
- Within one request, every file needs its own title: at least 2 content words must differ from every other title.
${
  d
    ? `
DESCRIPTION
- 2 to 4 complete natural sentences, each ending with a full stop.
- Between ${d.min} and ${d.max} characters in total. Never longer than ${d.max}.
- Cover the overall subject, setting, composition, style or colors, mood and genuine uses. Do not repeat the title word for word.
`
    : ""
}
KEYWORDS
- Exactly ${k} keywords, ordered from highest to lowest search value (Adobe gives the first 10 the most weight). If you run out of genuinely relevant terms, give fewer rather than padding (never fewer than 15 unless the file truly has fewer).
- Lowercase. No punctuation, no duplicates, no singular/plural pairs, no synonyms that add no new buyer search.
- Single words by default. Use a multi-word keyword only for a real compound that loses its meaning when split (artificial intelligence, remote work, copy space, one person, high-angle view). Never stack adjectives into one keyword ("white fluffy puppy" becomes white, fluffy, puppy).
- TITLE WORDS GO FIRST: every meaningful word of your title must appear inside the first 10 keywords. Slots 1-3: the main subject nouns taken from the title, most dominant first. Slots 4-5: the main action or state or most defining attribute, plus the core concept or usage ("copy space" only when there is clearly empty space). Slots 6-10: remaining title words, setting, number of people (when people are shown) and the strongest buyer-intent term. After the title words, keep the strongest-first order.
- Never use a generic word in slots 1-3 unless it IS the subject ("background", "pattern", "wallpaper", "abstract", "icon", "flowers" alone).
- After slot 10, continue in this order: remaining subject elements, setting, people attributes, viewpoint and composition, color, concept and emotion (2 to 5 terms, each visible), season or occasion, usage and technical terms (vector, isolated, white background, transparent background, copy space, seamless, pattern, icon, infographic, template, banner, only when true), then location.
- Include a general and a specific level for the subject (animal, mammal, arctic fox). Include the number of people and accurate age, gender and ethnicity ONLY when people are clearly shown; if unsure, leave it out.
- Locations: city, region and country as separate keywords, and always add the country when a city is used. Only when the place is real, certain and shown.
- Every keyword must be provable from the file (relevance 7 of 10; the first 10 must be 9 of 10). Never guess an attribute you cannot see.
- For a seasonal or holiday file: add the occasion name, the season, 2 to 4 visible symbolic objects and a usage term (greeting card, banner) from slot 4 on, never ahead of slots 1-3. No year numbers unless shown.
- Never write: ${ADOBE_BANNED_TERMS.join(", ")}. Never use "4k" unless the file is a video.
- Never mention AI, AI generation, prompts or any tool, even when the file looks AI-made. Describe the subject plainly. ("artificial intelligence" or "robot" only when that is the depicted subject.)
- Accuracy beats quantity; relevance beats generic association.

GENERAL RULES
- Plain natural English. No emojis, hashtags, quotation marks or markdown.
- Never start with "Image of", "Photo of", "Picture of", "Illustration of" or similar.
- Never include brand names, trademarks, logos, real person or celebrity names, or copyrighted character names, even if visible.
- Do not mention file names, camera settings or technical data.
${negativeSection}
OUTPUT
Return only a JSON array with one object per file, in the same order as the files:
[{"id": 1, "title": "..."${withDescription ? ', "description": "..."' : ""}, "keywords": ["...", "..."]}]
The "id" is the file number given before each file. Never show reasoning, scores or rejected keywords.`;
}
