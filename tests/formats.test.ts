import { describe, expect, it } from "vitest";
import { findContentBox, paddedCropBox } from "@/features/thumbnail/cropContent";
import { sniffImageSize } from "@/features/thumbnail/imageThumb";
import { sizeForSide, svgFrame } from "@/features/thumbnail/svgThumb";
import { EXTENSION_KIND, FILE_INPUT_ACCEPT } from "@/lib/constants";

const bytes = (b64: string) => new Uint8Array(Buffer.from(b64, "base64"));

// Real 173 x 91 WebP files made with libwebp: lossy (VP8), lossless (VP8L), with alpha (VP8X).
const WEBP_LOSSY = "UklGRoIAAABXRUJQVlA4IHYAAAAQBwCdASqtAFsAPp1OpE4lpCOiIIgAsBOJaW7hdVDl3AAAT22IvEFSB9tWUUcOcgjYgqOe2IvEFRz2xF4gqOewgAD+/tdb/9CjZRMU//+oM/8TZ/xNnzeJSZBWIh84yA5Ehk3ycuCnLgpy4KctycgFPIAAAAAA";
const WEBP_LOSSLESS = "UklGRiIAAABXRUJQVlA4TBYAAAAvrIAWAAcQRY7+hwFICP//KxH9T6ED";
const WEBP_EXTENDED = "UklGRq4AAABXRUJQVlA4WAoAAAAQAAAArAAAWgAAQUxQSBEAAAABB1CyiAgDkBD+/1ci+p9CBwBWUDggdgAAABAHAJ0BKq0AWwA+nU6kTiWkI6IgiACwE4lpbuF1UOXcAABPbYi8QVIH21ZRRw5yCNiCo57Yi8QVHPbEXiCo57CAAP7+11v/0KNlExT//6gz/xNn/E2fN4lJkFYiHzjIDkSGTfJy4KcuCnLgpy3JyAU8gAAAAAA=";

describe("WebP", () => {
  it("reads the size of lossy, lossless and extended files", () => {
    expect(sniffImageSize(bytes(WEBP_LOSSY))).toEqual({ width: 173, height: 91 });
    expect(sniffImageSize(bytes(WEBP_LOSSLESS))).toEqual({ width: 173, height: 91 });
    expect(sniffImageSize(bytes(WEBP_EXTENDED))).toEqual({ width: 173, height: 91 });
  });
  it("is accepted as an image", () => {
    expect(EXTENSION_KIND.webp).toBe("image");
    expect(FILE_INPUT_ACCEPT).toContain(".webp");
  });
});

describe("supported vector formats", () => {
  it("maps svg and ai to their own kinds", () => {
    expect(EXTENSION_KIND.svg).toBe("svg");
    expect(EXTENSION_KIND.ai).toBe("ai");
    expect(FILE_INPUT_ACCEPT).toContain(".svg");
    expect(FILE_INPUT_ACCEPT).toContain(".ai");
  });
});

describe("svgFrame", () => {
  it("prefers the viewBox", () => {
    expect(svgFrame({ viewBox: "0 0 3000 2000", width: "10", height: "10" })).toEqual({
      width: 3000,
      height: 2000,
      needsViewBox: false,
    });
    expect(svgFrame({ viewBox: "0,0,50,25" }).width).toBe(50);
  });
  it("falls back to width/height with units and asks for a viewBox", () => {
    expect(svgFrame({ width: "120px", height: "60.5" })).toEqual({
      width: 120,
      height: 60.5,
      needsViewBox: true,
    });
  });
  it("handles missing or percentage sizes", () => {
    expect(svgFrame({ width: "100%", height: "100%" })).toEqual({
      width: 1000,
      height: 1000,
      needsViewBox: true,
    });
    expect(svgFrame({ width: "200" })).toMatchObject({ width: 200, height: 200 });
    expect(svgFrame({ viewBox: "0 0 0 0", width: "30", height: "10" }).width).toBe(30);
  });
  it("scales so the longest side matches", () => {
    expect(sizeForSide({ width: 40, height: 20, needsViewBox: true }, 2048)).toEqual({
      width: 2048,
      height: 1024,
    });
  });
});

describe("findContentBox / paddedCropBox", () => {
  const image = (w: number, h: number, paint: (x: number, y: number) => number[] | null) => {
    const d = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const c = paint(x, y) ?? [255, 255, 255, 255];
        d.set(c, (y * w + x) * 4);
      }
    return d;
  };

  it("finds artwork inside a white margin", () => {
    const d = image(100, 100, (x, y) => (x >= 40 && x < 60 && y >= 30 && y < 70 ? [0, 0, 0, 255] : null));
    expect(findContentBox(d, 100, 100)).toEqual({ x: 40, y: 30, w: 20, h: 40 });
  });
  it("treats transparent pixels as empty", () => {
    const d = image(10, 10, (x, y) => (x === 3 && y === 4 ? [10, 10, 10, 255] : [0, 0, 0, 0]));
    expect(findContentBox(d, 10, 10)).toEqual({ x: 3, y: 4, w: 1, h: 1 });
  });
  it("returns null for a blank picture", () => {
    expect(findContentBox(image(8, 8, () => null), 8, 8)).toBeNull();
  });
  it("crops with a margin", () => {
    const box = paddedCropBox({ x: 400, y: 400, w: 200, h: 200 }, 1000, 1000)!;
    expect(box.x).toBeLessThan(400);
    expect(box.x + box.w).toBeGreaterThan(600);
    expect(box.x).toBeGreaterThanOrEqual(0);
  });
  it("does not crop when the artwork already fills the picture", () => {
    expect(paddedCropBox({ x: 2, y: 2, w: 96, h: 96 }, 100, 100)).toBeNull();
  });
  it("keeps thin strips from becoming slivers (aspect within 1:4)", () => {
    const box = paddedCropBox({ x: 100, y: 500, w: 800, h: 2 }, 1000, 1000)!;
    expect(box.h).toBeGreaterThanOrEqual(box.w / 4 - 1);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.h).toBeLessThanOrEqual(1000);
  });
});
