import { PREVIEW } from "@/lib/constants";
import { dpiFor, readBoundingBox, renderEpsToPng } from "./epsRender";
import { bitmapToJpeg, previewsFromBitmap } from "./imageThumb";

/**
 * EPS cannot be drawn by a browser, so:
 *   1. use the preview many EPS files carry inside them (DOS-EPS TIFF, or ASCII "EPSI"),
 *      but only if it is big enough to be useful,
 *   2. otherwise render the real drawing with Ghostscript (WebAssembly),
 *   3. if Ghostscript fails but a small embedded preview exists, use that.
 */

export interface RawPreview {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
}

export interface DosEpsHeader {
  tiffOffset: number;
  tiffLength: number;
  psOffset: number;
  psLength: number;
}

const NO_PREVIEW_MESSAGE =
  "No embedded preview found in this EPS. Re-save it with a TIFF or EPSI preview.";

const u32le = (b: Uint8Array, i: number) =>
  (b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16) | (b[i + 3]! << 24)) >>> 0;

/** Parses the 30-byte DOS EPS header, or returns null for a normal text EPS. */
export function parseDosEpsHeader(b: Uint8Array): DosEpsHeader | null {
  if (b.length < 30) return null;
  if (b[0] !== 0xc5 || b[1] !== 0xd0 || b[2] !== 0xd3 || b[3] !== 0xc6) return null;
  return {
    psOffset: u32le(b, 4),
    psLength: u32le(b, 8),
    tiffOffset: u32le(b, 20),
    tiffLength: u32le(b, 24),
  };
}

/** Decodes an ASCII EPSI preview (gray, 1/2/4/8 bits per pixel). */
export function decodeEpsi(text: string): RawPreview | null {
  const m = /%%BeginPreview:\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/.exec(text);
  if (!m) return null;
  const width = Number(m[1]);
  const height = Number(m[2]);
  const depth = Number(m[3]);
  if (!width || !height || ![1, 2, 4, 8].includes(depth)) return null;
  if (width * height > 25_000_000) return null;

  const bodyStart = text.indexOf("\n", m.index);
  if (bodyStart < 0) return null;
  const bodyEnd = text.indexOf("%%EndPreview", bodyStart);
  if (bodyEnd < 0) return null;

  const hex = text
    .slice(bodyStart + 1, bodyEnd)
    .split(/\r\n|\r|\n/)
    .map((line) => line.replace(/^%\s?/, ""))
    .join("")
    .replace(/[^0-9a-fA-F]/g, "");

  const rowBytes = Math.ceil((width * depth) / 8);
  if (hex.length < rowBytes * height * 2) return null;

  const perByte = 8 / depth;
  const mask = (1 << depth) - 1;
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const byteIndex = y * rowBytes + Math.floor(x / perByte);
      const byte = parseInt(hex.substr(byteIndex * 2, 2), 16);
      const shift = 8 - depth * ((x % perByte) + 1);
      const gray = Math.round((((byte >> shift) & mask) / mask) * 255);
      const o = (y * width + x) * 4;
      rgba[o] = gray;
      rgba[o + 1] = gray;
      rgba[o + 2] = gray;
      rgba[o + 3] = 255;
    }
  }
  return { width, height, rgba };
}

/** The TIFF tags we read. UTIF stores each tag as an array under "t<number>". */
interface TiffTags {
  width: number;
  height: number;
  t258?: number[]; // bits per sample
  t259?: number[]; // compression
  t262?: number[]; // photometric (3 = palette)
  t273?: number[]; // strip offsets
  t277?: number[]; // samples per pixel
  t279?: number[]; // strip byte counts
  t320?: number[]; // color map (16 bit R..., G..., B...)
  t338?: number[]; // extra samples (1 = alpha already multiplied in)
}

/**
 * Palette TIFF with an extra alpha sample per pixel (index + alpha, 2 bytes each).
 * Illustrator writes its EPS preview this way. UTIF reads 1 byte per pixel here, which
 * doubles and smears the picture, so this case is decoded by hand.
 * Returns null when the TIFF is not of this kind (UTIF handles everything else).
 */
export function decodePaletteWithAlpha(buffer: ArrayBuffer, t: TiffTags): RawPreview | null {
  const samples = t.t277?.[0] ?? 1;
  if (t.t262?.[0] !== 3 || samples < 2 || (t.t258?.[0] ?? 8) !== 8 || (t.t259?.[0] ?? 1) !== 1) return null;
  const cmap = t.t320;
  const offsets = t.t273;
  const counts = t.t279;
  if (!cmap || !offsets || !counts || cmap.length < 3 * 256) return null;

  const { width, height } = t;
  const bytes = new Uint8Array(buffer);
  const rgba = new Uint8ClampedArray(width * height * 4);
  const premultiplied = t.t338?.[0] === 1;
  let pixel = 0;
  const total = width * height;
  for (let s = 0; s < offsets.length && pixel < total; s++) {
    const start = offsets[s]!;
    const end = Math.min(start + counts[s]!, bytes.length);
    for (let i = start; i + samples <= end && pixel < total; i += samples, pixel++) {
      const index = bytes[i]!;
      const a = bytes[i + 1]!;
      let r = cmap[index]! >> 8;
      let g = cmap[256 + index]! >> 8;
      let b = cmap[512 + index]! >> 8;
      if (premultiplied && a > 0 && a < 255) {
        r = Math.min(255, Math.round((r * 255) / a));
        g = Math.min(255, Math.round((g * 255) / a));
        b = Math.min(255, Math.round((b * 255) / a));
      }
      const o = pixel * 4;
      rgba[o] = r;
      rgba[o + 1] = g;
      rgba[o + 2] = b;
      rgba[o + 3] = a;
    }
  }
  if (pixel < total) return null; // truncated data: let Ghostscript render it instead
  return { width, height, rgba };
}

async function decodeTiff(buffer: ArrayBuffer): Promise<RawPreview> {
  const mod = await import("utif");
  const UTIF = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const ifds = UTIF.decode(buffer);
  const first = ifds[0];
  if (!first) throw new Error(NO_PREVIEW_MESSAGE);
  const tags = first as unknown as TiffTags;
  const palette = decodePaletteWithAlpha(buffer, tags);
  if (palette) return palette;
  // Palette + extra samples that we could not decode ourselves (e.g. compressed): UTIF would
  // misread it silently, so say "no usable preview" and let Ghostscript draw the real file.
  if (tags.t262?.[0] === 3 && (tags.t277?.[0] ?? 1) > 1) throw new Error(NO_PREVIEW_MESSAGE);
  UTIF.decodeImage(buffer, first);
  const rgba = UTIF.toRGBA8(first);
  return {
    width: first.width,
    height: first.height,
    rgba: new Uint8ClampedArray(rgba),
  };
}

async function findPreview(file: Blob): Promise<RawPreview> {
  const head = new Uint8Array(await file.slice(0, 1024 * 1024).arrayBuffer());

  const dos = parseDosEpsHeader(head);
  if (dos && dos.tiffOffset > 0 && dos.tiffLength > 0) {
    const tiff = await file
      .slice(dos.tiffOffset, dos.tiffOffset + dos.tiffLength)
      .arrayBuffer();
    return decodeTiff(tiff);
  }

  const text = new TextDecoder("latin1").decode(head);
  const epsi = decodeEpsi(text);
  if (epsi) return epsi;

  throw new Error(NO_PREVIEW_MESSAGE);
}

/** An embedded preview at least this big (longest side, px) is used without rendering. */
const GOOD_PREVIEW_SIDE = 600;

async function previewsFromRaw(raw: RawPreview): Promise<{ ai: Blob[]; grid: Blob }> {
  const image = new ImageData(new Uint8ClampedArray(raw.rgba), raw.width, raw.height);
  const bitmap = await createImageBitmap(image);
  try {
    const { ai, grid } = await previewsFromBitmap(bitmap);
    return { ai: [ai], grid };
  } finally {
    bitmap.close();
  }
}

async function previewsFromGhostscript(file: Blob): Promise<{ ai: Blob[]; grid: Blob }> {
  const box = await readBoundingBox(file);
  const png = await renderEpsToPng(file, dpiFor(box, PREVIEW.aiMaxSide));
  const bitmap = await createImageBitmap(new Blob([png as BlobPart], { type: "image/png" }));
  try {
    const { ai, grid } = await previewsFromBitmap(bitmap);
    return { ai: [ai], grid };
  } finally {
    bitmap.close();
  }
}

export async function makeEpsPreviews(file: Blob): Promise<{ ai: Blob[]; grid: Blob }> {
  let embedded: RawPreview | null = null;
  try {
    embedded = await findPreview(file);
  } catch {
    embedded = null;
  }

  if (embedded && Math.max(embedded.width, embedded.height) >= GOOD_PREVIEW_SIDE) {
    return previewsFromRaw(embedded);
  }

  try {
    return await previewsFromGhostscript(file);
  } catch (error) {
    if (embedded) return previewsFromRaw(embedded); // small, but better than nothing
    const reason = error instanceof Error ? error.message : "unknown error";
    throw new Error(`Could not read this EPS file (${reason})`);
  }
}

export { bitmapToJpeg };
