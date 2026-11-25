import { describe, expect, it } from "vitest";
import {
  formatKeywords,
  normalizeDescription,
  normalizeKeywords,
  normalizeMeta,
  normalizeTitle,
} from "@/features/metadata/normalizer";
import { validateMeta } from "@/features/metadata/validator";

describe("normalizeTitle", () => {
  it("adds exactly one full stop", () => {
    expect(normalizeTitle("Red poppy flowers on stone steps", 200)).toBe(
      "Red poppy flowers on stone steps.",
    );
    expect(normalizeTitle("Red poppy flowers...", 200)).toBe("Red poppy flowers.");
  });
  it("never exceeds the limit, cuts at a word and drops dangling words", () => {
    const raw = "Remembrance day memorial with american flag poppies and military medals on concrete steps";
    for (const limit of [40, 60, 61, 75]) {
      const t = normalizeTitle(raw, limit);
      expect(t.length).toBeLessThanOrEqual(limit);
      expect(t.endsWith(".")).toBe(true);
      expect(t.endsWith("..")).toBe(false);
      expect(/\b(and|with|of|on)\.$/i.test(t)).toBe(false);
    }
  });
  it("strips quotes and markdown", () => {
    expect(normalizeTitle('"**Blue** ocean wave"', 100)).toBe("Blue ocean wave.");
  });
});

describe("normalizeDescription", () => {
  it("makes every sentence end with '. ' and the whole text end with '.'", () => {
    const d = normalizeDescription("First sentence! second one here? Third one", 300);
    expect(d).toBe("First sentence. Second one here. Third one.");
  });
  it("drops whole sentences that do not fit and stays within the limit", () => {
    const raw = "A close view of red flowers. Soft morning light over the grounds. A symbolic tribute for remembrance day.";
    const d = normalizeDescription(raw, 70);
    expect(d.length).toBeLessThanOrEqual(70);
    expect(d.endsWith(".")).toBe(true);
    expect(d).toBe("A close view of red flowers. Soft morning light over the grounds.");
  });
  it("cuts a single over-long sentence at a word boundary", () => {
    const d = normalizeDescription("One two three four five six seven eight nine ten", 25);
    expect(d.length).toBeLessThanOrEqual(25);
    expect(d.endsWith(".")).toBe(true);
  });
  it("removes duplicate sentences", () => {
    expect(normalizeDescription("Nice view. Nice view. Other thing.", 200)).toBe("Nice view. Other thing.");
  });
});

describe("normalizeKeywords", () => {
  it("lowercases, dedupes (incl. plural) and limits the count", () => {
    const k = normalizeKeywords(["Flag", "flags", "Poppy", "poppy flower", "  medal.", "Flag"], 4);
    expect(k).toEqual(["flag", "poppy", "poppy flower", "medal"]);
  });
  it("accepts a comma string and list markers", () => {
    expect(normalizeKeywords("1. red, - blue, green;yellow", 10)).toEqual(["red", "blue", "green", "yellow"]);
  });
  it("formats with comma + space and no trailing comma", () => {
    expect(formatKeywords(["a", "b", "c"])).toBe("a, b, c");
  });
});

describe("normalizeMeta + validateMeta", () => {
  it("produces valid output from messy input", () => {
    const c = { titleLimit: 80, descriptionLimit: 120, keywordCount: 8 };
    const meta = normalizeMeta(
      {
        title: "A very long title about a beautiful sunset over the calm ocean with silhouette of palm trees and boats",
        description: "Sunset over the ocean. Palm trees frame the scene! Warm orange and pink colors fill the sky and water for travel designs",
        keywords: ["sunset", "ocean", "palm tree", "boat", "orange", "sky", "travel", "calm", "beach", "extra"],
      },
      c,
    );
    const v = validateMeta(meta, c);
    expect(v.issues).toEqual([]);
    expect(v.ok).toBe(true);
    expect(meta.keywords).toHaveLength(8);
  });
  it("flags empty results", () => {
    const c = { titleLimit: 80, descriptionLimit: 120, keywordCount: 8 };
    expect(validateMeta(normalizeMeta({ title: "", description: "", keywords: [] }, c), c).ok).toBe(false);
  });
});
