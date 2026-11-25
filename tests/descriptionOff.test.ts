import { describe, expect, it } from "vitest";
import { MARKETPLACES, getMarketplace } from "@/features/ai/marketplaces";
import { buildResponseSchema } from "@/features/ai/schema";
import { buildCsv } from "@/features/csv/buildCsv";
import { charLength, cleanName, clampName, downloadName } from "@/features/csv/fileName";
import { normalizeMeta } from "@/features/metadata/normalizer";
import { validateMeta } from "@/features/metadata/validator";
import { sanitizeConstraints } from "@/lib/storage";
import type { BatchItem } from "@/types/batch";

const off = { titleLimit: 100, descriptionLimit: 0, keywordCount: 6 };
const on = { ...off, descriptionLimit: 200 };

describe("description switched off (slider at 0)", () => {
  it("slider value 0 is kept", () => {
    expect(sanitizeConstraints({ descriptionLimit: 0 }).descriptionLimit).toBe(0);
  });
  it("no description is produced or required", () => {
    const meta = normalizeMeta(
      { title: "Red apple on wood", description: "Should be ignored.", keywords: ["apple", "red", "fruit", "wood", "food", "fresh"] },
      off,
    );
    expect(meta.description).toBe("");
    expect(validateMeta(meta, off).ok).toBe(true);
  });
  it("title and keyword rules are unchanged", () => {
    const meta = normalizeMeta({ title: "", keywords: [] }, off);
    expect(validateMeta(meta, off).ok).toBe(false);
  });
  it("schema and prompt leave the description out", () => {
    const keys = (w: boolean) => Object.keys((buildResponseSchema(w).items as { properties: object }).properties);
    expect(keys(false)).toEqual(["id", "title", "keywords"]);
    expect(keys(true)).toContain("description");
    const adobe = getMarketplace("adobe-stock");
    expect(adobe.buildInstruction(off)).not.toContain("DESCRIPTION");
    expect(adobe.buildInstruction(on)).toContain("DESCRIPTION");
  });
  it("CSV has no Description column", () => {
    const item = (over: Partial<BatchItem> = {}): BatchItem => ({
      id: "1", fileId: "f", fileName: "a.jpg", kind: "image", thumbUrl: null, previews: [],
      status: "success", attempts: 1,
      meta: { title: "A title.", description: "", keywords: ["red", "blue"] },
      ...over,
    });
    expect(buildCsv([item()])).toBe('Filename,Title,Keywords\r\na.jpg,A title.,"red, blue"\r\n');
  });
});

describe("marketplaces", () => {
  it("Adobe Stock is the default and unknown ids fall back to it", () => {
    expect(MARKETPLACES[0]!.id).toBe("adobe-stock");
    expect(getMarketplace("nope").id).toBe("adobe-stock");
    expect(getMarketplace(null).id).toBe("adobe-stock");
  });
});

describe("CSV rename helpers", () => {
  it("counts characters like a person (emoji = 1)", () => {
    expect(charLength("ab😀")).toBe(3);
  });
  it("never allows more than 300 characters", () => {
    expect(charLength(clampName("😀".repeat(400)))).toBe(300);
    expect(charLength(cleanName(" " + "x".repeat(500)))).toBe(300);
  });
  it("accepts any language and symbols; empty is empty", () => {
    expect(cleanName("  বাংলা + 12 - ✓  ")).toBe("বাংলা + 12 - ✓");
    expect(cleanName("   ")).toBe("");
  });
  it("download name always ends with .csv", () => {
    expect(downloadName("my file")).toBe("my file.csv");
    expect(downloadName("my file.CSV")).toBe("my file.CSV");
  });
});
