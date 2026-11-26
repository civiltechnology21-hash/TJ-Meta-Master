import { describe, expect, it } from "vitest";
import { getMarketplace } from "@/features/ai/marketplaces";
import { normalizeKeywords, normalizeMeta } from "@/features/metadata/normalizer";
import {
  alignTitleKeywords,
  findBanned,
  repeatedWords,
  sanitizeSafeText,
  sanitizeTitleStrict,
  stem,
  titleWordsMissing,
} from "@/features/metadata/rulesText";
import { validateMeta } from "@/features/metadata/validator";
import type { UserConstraints } from "@/types/metadata";

const AS = getMarketplace("adobe-stock").rules;
const SS = getMarketplace("shutterstock").rules;
const adobeC: UserConstraints = { titleLimit: 70, descriptionLimit: 0, keywordCount: 30 };
const ssC: UserConstraints = { titleLimit: 70, descriptionLimit: 150, keywordCount: 30 };

describe("text helpers", () => {
  it("stems common word forms alike", () => {
    expect(stem("running")).toBe(stem("runner"));
    expect(stem("running")).toBe(stem("run"));
    expect(stem("glasses")).toBe(stem("glass"));
    expect(stem("sunset")).not.toBe(stem("sun"));
  });
  it("finds repeated content words but not repeated small words", () => {
    expect(repeatedWords("Blue bokeh with glowing blue circles")).toEqual(["blue"]);
    expect(repeatedWords("A dog runs and a runner is running")).toContain("runs");
    expect(repeatedWords("A cat on a mat in a house")).toEqual([]);
  });
  it("matches banned phrases as whole words, ignoring case and punctuation", () => {
    const banned = ["ai generated", "best", "hd", "dall e"];
    expect(findBanned("AI-generated art", banned)).toEqual(["ai generated"]);
    expect(findBanned("The BEST view", banned)).toEqual(["best"]);
    expect(findBanned("DALL-E picture", banned)).toEqual(["dall e"]);
    expect(findBanned("bestseller shed", banned)).toEqual([]);
    expect(findBanned("anything", undefined)).toEqual([]);
  });
  it("cleans text to the safe character set", () => {
    expect(sanitizeSafeText("Cats & dogs/pets: “cute”!")).toBe("Cats and dogs pets cute");
    expect(sanitizeSafeText("Woman’s hand – close-up")).toBe("Woman's hand - close-up");
  });
  it("cleans a title for Adobe", () => {
    expect(sanitizeTitleStrict("Senior woman: FLEXING muscles, on a beach!")).toBe(
      "Senior woman flexing muscles on a beach",
    );
    expect(sanitizeTitleStrict("USA flag")).toBe("USA flag");
  });
});

describe("title words inside the first keywords", () => {
  it("finds the missing ones", () => {
    expect(titleWordsMissing("Senior woman on a sunny beach.", ["woman", "senior", "beach", "sea"], 10)).toEqual([
      "sunny",
    ]);
  });
  it("moves or adds title words into the top slots", () => {
    const kw = ["woman", "ocean", "sand", "waves", "sky", "summer", "travel", "relax", "sea", "fit", "beach", "sunny"];
    const out = alignTitleKeywords("Senior woman on a sunny beach", kw, 10, 30);
    expect(titleWordsMissing("Senior woman on a sunny beach", out, 10)).toEqual([]);
    expect(out.slice(0, 10)).toContain("senior");
    expect(new Set(out).size).toBe(out.length);
    expect(out.length).toBeLessThanOrEqual(30);
  });
});

describe("Adobe Stock rules", () => {
  const raw = {
    title: "Senior woman: FLEXING muscles, on a sunny beach",
    keywords: ["woman", "beach", "beautiful", "stock photo", "ocean", "sand", "sky", "summer", "fit", "relax", "waves", "travel"],
  };
  it("cleans the title, drops banned keywords and puts title words first", () => {
    const meta = normalizeMeta(raw, adobeC, AS);
    expect(meta.title).toBe("Senior woman flexing muscles on a sunny beach.");
    expect(meta.keywords).not.toContain("beautiful");
    expect(meta.keywords).not.toContain("stock photo");
    expect(titleWordsMissing(meta.title, meta.keywords, 10)).toEqual([]);
    expect(validateMeta(meta, adobeC, AS)).toMatchObject({ ok: true });
  });
  it("rejects a too-short title and banned wording", () => {
    const short = { title: "A cat.", description: "", keywords: ["cat", "pet", "animal", "fur", "cute", "kitten"] };
    expect(validateMeta(short, adobeC, AS).issues).toContain("Title is too short.");
    const bad = { ...short, title: "Stunning cat sitting on a wooden table." };
    expect(validateMeta(bad, adobeC, AS).issues.join(" ")).toMatch(/banned wording/);
  });
  it("rejects a title that still has forbidden characters", () => {
    const m = { title: "Cat, sitting on a wooden table.", description: "", keywords: ["cat", "table", "wooden", "pet", "sitting"] };
    expect(validateMeta(m, adobeC, AS).issues.join(" ")).toMatch(/forbidden characters/);
  });
});

describe("Shutterstock rules", () => {
  it("cleans the description to the allowed characters", () => {
    const meta = normalizeMeta(
      {
        title: "",
        description: "Soft blue backdrop with glowing circles & sparkles / modern look",
        keywords: ["blue", "backdrop", "glow", "circles", "sparkles", "modern", "soft"],
        categories: ["Abstract"],
      },
      ssC,
      SS,
    );
    expect(meta.description).toBe("Soft blue backdrop with glowing circles and sparkles modern look.");
    expect(validateMeta(meta, ssC, SS)).toMatchObject({ ok: true });
  });
  it("rejects repeated words, too few words, banned wording", () => {
    const base = { title: "", keywords: ["a1", "b1", "c1", "d1", "e1", "f1", "g1"], categories: ["Nature"] };
    expect(validateMeta({ ...base, description: "Blue sea with blue sky." }, ssC, SS).issues.join(" ")).toMatch(
      /repeats a word: blue/,
    );
    expect(validateMeta({ ...base, description: "Blue sea." }, ssC, SS).issues.join(" ")).toMatch(/at least 5 words/);
    expect(validateMeta({ ...base, description: "The best blue sea at sunrise." }, ssC, SS).issues.join(" ")).toMatch(
      /banned wording/,
    );
  });
  it("keeps a word stem in at most 3 keywords and drops filler keywords", () => {
    const out = normalizeKeywords(
      ["ski lodge", "ski resort", "ski lift", "ski jump", "photo", "nice", "mountain"],
      20,
      { stemCap: 3, dropped: ["photo", "nice"] },
    );
    expect(out).toEqual(["ski lodge", "ski resort", "ski lift", "mountain"]);
  });
  it("uses at most 2 categories and none of the video-only ones for video", () => {
    const raw = { title: "", description: "x", keywords: [], categories: ["Abstract", "Technology", "Nature"] };
    expect(normalizeMeta(raw, ssC, SS).categories).toEqual(["Abstract", "Technology"]);
    expect(normalizeMeta(raw, ssC, SS, { kind: "video" }).categories).toEqual(["Technology", "Nature"]);
    const meta = { title: "", description: "Soft blue sea at sunrise today.", keywords: ["a1","b1","c1","d1","e1","f1","g1"], categories: ["Abstract"] };
    expect(validateMeta(meta, ssC, SS, { kind: "video" }).issues).toContain("A category is not available for video.");
  });
});
