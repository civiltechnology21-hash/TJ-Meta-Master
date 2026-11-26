import { describe, expect, it } from "vitest";
import { buildResponseSchema, parseModelText } from "@/features/ai/schema";
import {
  descriptionRange,
  effectiveConstraints,
  getMarketplace,
  MARKETPLACES,
} from "@/features/ai/marketplaces";
import { SHUTTERSTOCK_CATEGORIES } from "@/features/ai/marketplaces/shutterstock";
import { buildCsv, csvFileName } from "@/features/csv/buildCsv";
import { normalizeCategories, normalizeMeta } from "@/features/metadata/normalizer";
import { softIssues, validateMeta } from "@/features/metadata/validator";
import type { BatchItem } from "@/types/batch";
import type { UserConstraints } from "@/types/metadata";

const SS = getMarketplace("shutterstock").rules;
const AS = getMarketplace("adobe-stock").rules;
const c: UserConstraints = { titleLimit: 200, descriptionLimit: 250, keywordCount: 50 };

const item = (over: Partial<BatchItem> & { meta: NonNullable<BatchItem["meta"]> }): BatchItem => ({
  id: "1",
  fileId: "f",
  fileName: "bokeh_001.jpg",
  kind: "image",
  thumbUrl: null,
  previews: [],
  status: "success",
  attempts: 1,
  ...over,
});

describe("marketplace registry", () => {
  it("has Adobe Stock first (default) and Shutterstock", () => {
    expect(MARKETPLACES.map((m) => m.id)).toEqual(["adobe-stock", "shutterstock"]);
    expect(getMarketplace("nope").id).toBe("adobe-stock");
  });
  it("Shutterstock has no title and uses categories", () => {
    expect(SS.hasTitle).toBe(false);
    expect(SS.categories).toBe(SHUTTERSTOCK_CATEGORIES);
    expect(AS.hasTitle).toBe(true);
    expect(AS.categories).toBeUndefined();
  });
  it("the Shutterstock instruction asks for no title and lists the categories", () => {
    const text = getMarketplace("shutterstock").buildInstruction({ ...c, descriptionLimit: 150 });
    expect(text).toContain("NEVER a separate title");
    expect(text).toContain("Backgrounds/Textures");
    expect(text).toContain('"categories"');
    expect(text).not.toContain('"title"');
  });
});

describe("effectiveConstraints", () => {
  it("Adobe Stock: title at most 70, keywords at most 49, description locked Off (no description field)", () => {
    expect(effectiveConstraints(AS, c)).toEqual({ titleLimit: 70, descriptionLimit: 0, keywordCount: 49 });
    expect(effectiveConstraints(AS, { ...c, titleLimit: 64 }).titleLimit).toBe(64);
  });
  it("Shutterstock: description at most 150, never Off, keywords at most 50", () => {
    expect(effectiveConstraints(SS, c).descriptionLimit).toBe(150);
    expect(effectiveConstraints(SS, { ...c, descriptionLimit: 0 }).descriptionLimit).toBe(150);
    expect(effectiveConstraints(SS, { ...c, descriptionLimit: 20 }).descriptionLimit).toBe(50);
    expect(effectiveConstraints(SS, c).keywordCount).toBe(50);
    expect(descriptionRange(SS)).toEqual({ min: 50, max: 150 });
  });
});

describe("response schema", () => {
  it("is unchanged for Adobe Stock", () => {
    const s = buildResponseSchema(true) as { items: { required: string[] } };
    expect(s.items.required).toEqual(["id", "title", "description", "keywords"]);
  });
  it("has no title but categories for Shutterstock", () => {
    const s = buildResponseSchema(true, { withTitle: false, withCategories: true }) as {
      items: { required: string[] };
    };
    expect(s.items.required).toEqual(["id", "description", "keywords", "categories"]);
  });
  it("parses an answer without a title", () => {
    const map = parseModelText(
      '[{"id":1,"description":"A d.","keywords":["a","b"],"categories":["Abstract"]}]',
    );
    expect(map.get(1)?.categories).toEqual(["Abstract"]);
    expect(map.get(1)?.title).toBe("");
  });
});

describe("normalizeCategories", () => {
  it("matches names to the list, any case, no duplicates, at most 2", () => {
    expect(
      normalizeCategories(["abstract", "Backgrounds / Textures", "ABSTRACT", "Nature"], SHUTTERSTOCK_CATEGORIES, 2),
    ).toEqual(["Abstract", "Backgrounds/Textures"]);
  });
  it("drops unknown names and accepts a comma string", () => {
    expect(normalizeCategories("Made up, food and drink", SHUTTERSTOCK_CATEGORIES, 2)).toEqual([
      "Food and Drink",
    ]);
    expect(normalizeCategories(undefined, SHUTTERSTOCK_CATEGORIES, 2)).toEqual([]);
  });
});

describe("Shutterstock normalize + validate", () => {
  const eff = effectiveConstraints(SS, { ...c, keywordCount: 10 });
  const raw = {
    title: "SHOULD BE IGNORED",
    description: "Soft blue bokeh backdrop with glowing circles. Suitable for winter and medical designs",
    keywords: ["blue", "bokeh", "background", "light", "soft", "abstract", "glow", "winter", "water"],
    categories: ["Abstract", "Backgrounds/Textures"],
  };
  it("drops the title and keeps categories", () => {
    const meta = normalizeMeta(raw, eff, SS);
    expect(meta.title).toBe("");
    expect(meta.categories).toEqual(["Abstract", "Backgrounds/Textures"]);
    expect(validateMeta(meta, eff, SS)).toMatchObject({ ok: true });
  });
  it("flags a missing category (soft: one more try) and rejects too few keywords", () => {
    const noCat = normalizeMeta({ ...raw, categories: ["Nonsense"] }, eff, SS);
    expect(softIssues(noCat, SS)).toContain("No valid category.");
    const few = normalizeMeta({ ...raw, keywords: ["a1", "b1", "c1"] }, eff, SS);
    expect(validateMeta(few, eff, SS).issues).toContain("Too few keywords.");
  });
  it("Adobe Stock behaves exactly as before (rules optional)", () => {
    const meta = normalizeMeta({ title: "A red car on a road", keywords: ["car", "red"] }, { ...c, descriptionLimit: 0, keywordCount: 10 });
    expect(meta.categories).toBeUndefined();
    expect(meta.title).toBe("A red car on a road.");
  });
});

describe("CSV layouts and file names", () => {
  const ss = item({
    meta: {
      title: "",
      description: "Soft blue bokeh.",
      keywords: ["blue", "bokeh"],
      categories: ["Abstract", "Backgrounds/Textures"],
    },
  });
  it("Shutterstock: Filename, Description, Keywords, Categories (no title)", () => {
    expect(buildCsv([ss], "shutterstock")).toBe(
      'Filename,Description,Keywords,Categories\r\nbokeh_001.jpg,Soft blue bokeh.,"blue, bokeh","Abstract,Backgrounds/Textures"\r\n',
    );
  });
  it("Adobe Stock layout is unchanged", () => {
    const adobe = item({ meta: { title: "A title.", description: "", keywords: ["a", "b"] } });
    expect(buildCsv([adobe], "adobe-stock")).toBe('Filename,Title,Keywords\r\nbokeh_001.jpg,A title.,"a, b"\r\n');
    expect(buildCsv([adobe])).toBe(buildCsv([adobe], "adobe-stock"));
  });
  it("puts the marketplace name in the file name", () => {
    expect(csvFileName("2026-10-06T18:16:05", "shutterstock")).toBe(
      "tj-meta-shutterstock-2026-10-06_06-16-05PM.csv",
    );
    expect(csvFileName("2026-10-06T18:16:05", "adobe-stock")).toBe(
      "tj-meta-adobe-stock-2026-10-06_06-16-05PM.csv",
    );
    expect(csvFileName("2026-10-06T18:16:05")).toBe("tj-meta-2026-10-06_06-16-05PM.csv");
  });
});
