import { previewsFromBitmap } from "./imageThumb";

/**
 * Vector files (SVG, AI) often sit in a huge artboard with lots of empty space around
 * the artwork. Shrinking the whole artboard to 768px would make the artwork tiny, so the
 * empty margin is cropped away first. Pure functions here; the canvas work is below.
 */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A pixel counts as "empty" when it is (almost) transparent or (almost) white. */
const isEmpty = (r: number, g: number, b: number, a: number) =>
  a < 10 || (r >= 248 && g >= 248 && b >= 248);

/** Smallest box that contains every non-empty pixel, or null when the image is blank. */
export function findContentBox(
  data: ArrayLike<number>,
  width: number,
  height: number,
): Box | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      const o = row + x * 4;
      if (!isEmpty(data[o]!, data[o + 1]!, data[o + 2]!, data[o + 3]!)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/**
 * Adds a margin, keeps very thin strips from becoming 1px slivers (aspect stays within
 * 1:4) and returns null when cropping would not remove a meaningful amount of space.
 */
export function paddedCropBox(content: Box, width: number, height: number): Box | null {
  const pad = Math.max(8, Math.round(Math.max(content.w, content.h) * 0.04));
  let x0 = Math.max(0, content.x - pad);
  let y0 = Math.max(0, content.y - pad);
  let x1 = Math.min(width, content.x + content.w + pad);
  let y1 = Math.min(height, content.y + content.h + pad);

  const growTo = (lo: number, hi: number, wanted: number, limit: number): [number, number] => {
    const size = hi - lo;
    if (size >= wanted) return [lo, hi];
    const mid = (lo + hi) / 2;
    let a = Math.round(mid - wanted / 2);
    let b = a + Math.round(wanted);
    if (a < 0) {
      b -= a;
      a = 0;
    }
    if (b > limit) {
      a -= b - limit;
      b = limit;
    }
    return [Math.max(0, a), Math.min(limit, b)];
  };

  const longest = Math.max(x1 - x0, y1 - y0);
  [x0, x1] = growTo(x0, x1, longest / 4, width);
  [y0, y1] = growTo(y0, y1, longest / 4, height);

  const box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  // Less than ~20% of the area would be removed: not worth it.
  if (box.w * box.h >= width * height * 0.8) return null;
  return box;
}

/**
 * Crops the empty margin off a rendered vector bitmap, then builds the two previews
 * (AI + grid). Throws when the picture is completely blank.
 */
export async function previewsWithAutoCrop(
  source: ImageBitmap,
  blankMessage: string,
): Promise<{ ai: Blob[]; grid: Blob }> {
  const canvas = new OffscreenCanvas(source.width, source.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.drawImage(source, 0, 0);
  const { data } = ctx.getImageData(0, 0, source.width, source.height);

  const content = findContentBox(data, source.width, source.height);
  if (!content) throw new Error(blankMessage);
  const crop = paddedCropBox(content, source.width, source.height);

  const bitmap = crop
    ? await createImageBitmap(source, crop.x, crop.y, crop.w, crop.h)
    : source;
  try {
    const { ai, grid } = await previewsFromBitmap(bitmap);
    return { ai: [ai], grid };
  } finally {
    if (bitmap !== source) bitmap.close();
  }
}
