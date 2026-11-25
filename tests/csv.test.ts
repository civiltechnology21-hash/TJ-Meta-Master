import { describe, expect, it } from "vitest";
import { buildCsv, csvFileName } from "@/features/csv/buildCsv";
import type { BatchItem } from "@/types/batch";

function item(over: Partial<BatchItem>): BatchItem {
  return {
    id: "1",
    fileId: "f",
    fileName: "a.jpg",
    kind: "image",
    thumbUrl: null,
    previews: [],
    status: "success",
    attempts: 1,
    meta: { title: "A title.", description: "One. Two.", keywords: ["red", "blue"] },
    ...over,
  };
}

describe("buildCsv", () => {
  it("writes a header and one row per successful file", () => {
    const csv = buildCsv([item({}), item({ id: "2", fileName: "b.png" })]);
    expect(csv).toBe(
      'Filename,Title,Description,Keywords\r\na.jpg,A title.,One. Two.,"red, blue"\r\n' +
        'b.png,A title.,One. Two.,"red, blue"\r\n',
    );
  });
  it("skips failed, cancelled and pending files", () => {
    const csv = buildCsv([
      item({ status: "failed", meta: undefined }),
      item({ status: "cancelled", meta: undefined }),
      item({ status: "pending", meta: undefined }),
    ]);
    expect(csv).toBe("Filename,Title,Description,Keywords\r\n");
  });
  it("escapes quotes, commas and line breaks", () => {
    const csv = buildCsv([
      item({
        fileName: 'my "file", v2.jpg',
        meta: { title: 'He said "hi".', description: "Line1\nLine2.", keywords: ["a"] },
      }),
    ]);
    expect(csv).toContain('"my ""file"", v2.jpg"');
    expect(csv).toContain('"He said ""hi""."');
    expect(csv).toContain('"Line1\nLine2."');
  });
  it("blocks spreadsheet formula injection", () => {
    const csv = buildCsv([item({ fileName: "=HYPERLINK(1).jpg" })]);
    expect(csv.split("\r\n")[1]!.startsWith("'=HYPERLINK")).toBe(true);
  });
  it("keeps non-English file names", () => {
    expect(buildCsv([item({ fileName: "ছবি_১.jpg" })])).toContain("ছবি_১.jpg");
  });
});

describe("csvFileName", () => {
  it("uses a 12-hour clock with AM/PM", () => {
    expect(csvFileName("2026-10-06T18:16:05")).toBe("tj-meta-2026-10-06_06-16-05PM.csv");
    expect(csvFileName("2026-10-06T00:07:09")).toBe("tj-meta-2026-10-06_12-07-09AM.csv");
    expect(csvFileName("2026-10-06T12:00:00")).toBe("tj-meta-2026-10-06_12-00-00PM.csv");
  });
  it("builds a sortable name", () => {
    expect(csvFileName("2026-10-06T05:25:30")).toBe("tj-meta-2026-10-06_05-25-30AM.csv");
  });
});
