import { describe, expect, it } from "vitest";
import { getMetaCounts, validateMeta } from "@/features/metadata/validator";

const c = { titleLimit: 60, descriptionLimit: 100, keywordCount: 6 };
const good = {
  title: "Blue ocean wave under bright sky.",
  description: "A blue ocean wave. Bright sky above.",
  keywords: ["ocean", "wave", "blue", "sky", "water", "sea"],
};

describe("validateMeta", () => {
  it("accepts a correct result", () => {
    expect(validateMeta(good, c)).toEqual({ ok: true, issues: [], warnings: [] });
  });
  it("rejects a title that is too long, has no full stop, or ends with '..'", () => {
    expect(validateMeta({ ...good, title: "x".repeat(70) + "." }, c).ok).toBe(false);
    expect(validateMeta({ ...good, title: "No full stop" }, c).ok).toBe(false);
    expect(validateMeta({ ...good, title: "Double stop.." }, c).ok).toBe(false);
  });
  it("rejects a bad description", () => {
    expect(validateMeta({ ...good, description: "" }, c).ok).toBe(false);
    expect(validateMeta({ ...good, description: "No stop at the end" }, c).ok).toBe(false);
    expect(validateMeta({ ...good, description: "Space before .  Next ." }, c).ok).toBe(false);
    expect(validateMeta({ ...good, description: "x".repeat(120) + "." }, c).ok).toBe(false);
  });
  it("rejects bad keyword lists", () => {
    expect(validateMeta({ ...good, keywords: ["a"] }, c).ok).toBe(false); // too few
    expect(validateMeta({ ...good, keywords: [...good.keywords, "extra"] }, c).ok).toBe(false); // too many
    expect(validateMeta({ ...good, keywords: ["a", "A", "b", "c", "d", "e"] }, c).ok).toBe(false); // duplicate
    expect(validateMeta({ ...good, keywords: ["a, b", "c", "d", "e", "f", "g"] }, c).ok).toBe(false); // comma inside
  });
  it("only warns when a bit fewer keywords than requested", () => {
    const big = { ...c, keywordCount: 50 };
    const meta = { ...good, keywords: Array.from({ length: 40 }, (_, i) => `kw${i}`) };
    const r = validateMeta(meta, big);
    expect(r.ok).toBe(true);
    expect(r.warnings).toHaveLength(1);
  });
});

describe("getMetaCounts", () => {
  it("counts words, characters and keywords", () => {
    expect(getMetaCounts(good)).toEqual({
      titleWords: 6,
      titleChars: good.title.length,
      descriptionWords: 7,
      descriptionChars: good.description.length,
      keywordCount: 6,
    });
  });
});
