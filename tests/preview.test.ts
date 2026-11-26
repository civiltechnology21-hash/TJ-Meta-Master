import { describe, expect, it } from "vitest";
import { decodeEpsi, decodePaletteWithAlpha, parseDosEpsHeader } from "@/features/thumbnail/epsThumb";
import { fitSize, sniffImageSize } from "@/features/thumbnail/imageThumb";

describe("sniffImageSize", () => {
  it("reads PNG size", () => {
    const b = new Uint8Array(32);
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    new DataView(b.buffer).setUint32(16, 1200);
    new DataView(b.buffer).setUint32(20, 800);
    expect(sniffImageSize(b)).toEqual({ width: 1200, height: 800 });
  });
  it("reads GIF size", () => {
    const b = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x2c, 0x01, 0xc8, 0x00, 0, 0]);
    expect(sniffImageSize(b)).toEqual({ width: 300, height: 200 });
  });
  it("reads JPEG size, skipping other segments first", () => {
    const b = new Uint8Array([
      0xff, 0xd8,
      0xff, 0xe1, 0x00, 0x06, 1, 2, 3, 4, // EXIF-like segment (length 6)
      0xff, 0xc0, 0x00, 0x11, 0x08, 0x13, 0x88, 0x1b, 0x58, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0, // SOF0: 7000 x 5000
    ]);
    expect(sniffImageSize(b)).toEqual({ width: 0x1b58, height: 0x1388 });
  });
  it("returns null for unknown data", () => {
    expect(sniffImageSize(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });
});

describe("fitSize", () => {
  it("shrinks the longest side to the limit and keeps the ratio", () => {
    expect(fitSize(7000, 5000, 768)).toEqual({ width: 768, height: 549 });
    expect(fitSize(300, 200, 768)).toEqual({ width: 300, height: 200 }); // never enlarges
  });
});

describe("EPS preview parsing", () => {
  it("reads the DOS EPS header", () => {
    const b = new Uint8Array(30);
    b.set([0xc5, 0xd0, 0xd3, 0xc6]);
    const v = new DataView(b.buffer);
    v.setUint32(4, 30, true);
    v.setUint32(8, 100, true);
    v.setUint32(20, 130, true);
    v.setUint32(24, 5000, true);
    expect(parseDosEpsHeader(b)).toEqual({ psOffset: 30, psLength: 100, tiffOffset: 130, tiffLength: 5000 });
    expect(parseDosEpsHeader(new Uint8Array(30))).toBeNull();
  });
  it("decodes an 8-bit EPSI preview", () => {
    const text = "%!PS\n%%BeginPreview: 2 2 8 2\n% 00ff\n% ff00\n%%EndPreview\n";
    const p = decodeEpsi(text)!;
    expect([p.width, p.height]).toEqual([2, 2]);
    expect(Array.from(p.rgba.slice(0, 8))).toEqual([0, 0, 0, 255, 255, 255, 255, 255]);
  });
  it("decodes a 1-bit EPSI preview (padded rows)", () => {
    const text = "%%BeginPreview: 3 2 1 2\n% a0\n% 40\n%%EndPreview\n";
    const p = decodeEpsi(text)!;
    const gray = (i: number) => p.rgba[i * 4];
    expect([gray(0), gray(1), gray(2)]).toEqual([255, 0, 255]); // 101
    expect([gray(3), gray(4), gray(5)]).toEqual([0, 255, 0]); // 010
  });
  it("returns null when there is no preview", () => {
    expect(decodeEpsi("%!PS-Adobe\nnewpath")).toBeNull();
  });
});

import { dpiFor, parseBoundingBox } from "@/features/thumbnail/epsRender";

describe("EPS bounding box", () => {
  it("reads %%BoundingBox and prefers %%HiResBoundingBox", () => {
    expect(parseBoundingBox("%%BoundingBox: 0 0 600 400\n")).toEqual({ width: 600, height: 400 });
    expect(
      parseBoundingBox("%%BoundingBox: 0 0 600 400\n%%HiResBoundingBox: 0.5 0.5 599.5 399.25\n"),
    ).toEqual({ width: 599, height: 398.75 });
  });
  it("ignores (atend) and finds the real one later", () => {
    expect(parseBoundingBox("%%BoundingBox: (atend)\n...\n%%BoundingBox: 10 20 110 220\n")).toEqual({
      width: 100,
      height: 200,
    });
  });
  it("handles negative origins and missing boxes", () => {
    expect(parseBoundingBox("%%BoundingBox: -50 -50 50 50")).toEqual({ width: 100, height: 100 });
    expect(parseBoundingBox("%!PS-Adobe-3.0")).toBeNull();
  });
  it("picks a resolution that gives a ~768px picture", () => {
    expect(dpiFor({ width: 600, height: 400 }, 768)).toBe(92); // 600pt @92dpi = 767px
    expect(dpiFor(null, 768)).toBe(96);
    expect(dpiFor({ width: 1, height: 1 }, 768)).toBe(600); // never above 600 dpi
  });
});

describe("decodePaletteWithAlpha (Illustrator EPS preview: palette index + alpha per pixel)", () => {
  // 3 x 1 image. Palette: 0 = red, 1 = blue. Pixels: (red, opaque) (blue, opaque) (red, transparent)
  const cmap = new Array<number>(768).fill(0);
  cmap[0] = 255 << 8; // R of index 0
  cmap[512 + 1] = 255 << 8; // B of index 1
  const bytes = new Uint8Array([0, 255, 1, 255, 0, 0]);
  const tags = {
    width: 3,
    height: 1,
    t258: [8],
    t259: [1],
    t262: [3],
    t273: [0],
    t277: [2],
    t279: [6],
    t320: cmap,
    t338: [1],
  };

  it("reads 2 bytes per pixel (not 1) and keeps the alpha", () => {
    const out = decodePaletteWithAlpha(bytes.buffer, tags)!;
    expect([out.width, out.height]).toEqual([3, 1]);
    expect(Array.from(out.rgba)).toEqual([255, 0, 0, 255, 0, 0, 255, 255, 255, 0, 0, 0]);
  });
  it("un-multiplies colors when alpha is already multiplied in", () => {
    const half = new Uint8Array([0, 128]);
    const c = new Array<number>(768).fill(0);
    c[0] = 128 << 8; // premultiplied red at 50% alpha
    const out = decodePaletteWithAlpha(half.buffer, { ...tags, width: 1, t273: [0], t279: [2], t320: c })!;
    expect(out.rgba[0]).toBe(255);
    expect(out.rgba[3]).toBe(128);
  });
  it("returns null for other TIFF kinds and for truncated data", () => {
    expect(decodePaletteWithAlpha(bytes.buffer, { ...tags, t277: [1] })).toBeNull();
    expect(decodePaletteWithAlpha(bytes.buffer, { ...tags, t262: [2] })).toBeNull();
    expect(decodePaletteWithAlpha(bytes.buffer, { ...tags, t259: [5] })).toBeNull();
    expect(decodePaletteWithAlpha(new Uint8Array([0, 255]).buffer, { ...tags, t279: [2] })).toBeNull();
  });
});
