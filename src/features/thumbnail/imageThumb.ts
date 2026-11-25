import { PREVIEW } from "@/lib/constants";

/**
 * Image -> small JPEG previews, without ever decoding the full-size picture
 * when it can be avoided. Works in a Web Worker and on the main thread.
 */

export interface ImageSize {
  width: number;
  height: number;
}

export interface ImagePreviews {
  /** ~768px JPEG that is sent to Gemini. */
  ai: Blob;
  /** ~160px JPEG for the grid. */
  grid: Blob;
}

const u32be = (b: Uint8Array, i: number) =>
  ((b[i]! << 24) | (b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!) >>> 0;

/** Reads width/height from the first bytes of a PNG, GIF, WebP or JPEG (no decoding). */
export function sniffImageSize(b: Uint8Array): ImageSize | null {
  // PNG
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return { width: u32be(b, 16), height: u32be(b, 20) };
  }
  // GIF
  if (b.length >= 10 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) {
    return { width: b[6]! | (b[7]! << 8), height: b[8]! | (b[9]! << 8) };
  }
  // WebP: "RIFF" size "WEBP" then a VP8 (lossy), VP8L (lossless) or VP8X (extended) chunk
  if (
    b.length >= 30 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    const fourcc = String.fromCharCode(b[12]!, b[13]!, b[14]!, b[15]!);
    if (fourcc === "VP8 ") {
      return {
        width: (b[26]! | (b[27]! << 8)) & 0x3fff,
        height: (b[28]! | (b[29]! << 8)) & 0x3fff,
      };
    }
    if (fourcc === "VP8L" && b[20] === 0x2f) {
      return {
        width: 1 + (b[21]! | ((b[22]! & 0x3f) << 8)),
        height: 1 + ((b[22]! >> 6) | (b[23]! << 2) | ((b[24]! & 0x0f) << 10)),
      };
    }
    if (fourcc === "VP8X") {
      return {
        width: 1 + (b[24]! | (b[25]! << 8) | (b[26]! << 16)),
        height: 1 + (b[27]! | (b[28]! << 8) | (b[29]! << 16)),
      };
    }
    return null;
  }
  // JPEG: walk the markers until a Start-Of-Frame segment
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = b[i + 1]!;
      if (marker === 0xff) {
        i++;
        continue;
      }
      if (marker === 0xd9) break; // end of image
      if (marker === 0xd8 || marker === 0x01 || marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2;
        continue;
      }
      const length = (b[i + 2]! << 8) | b[i + 3]!;
      const isSof =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) {
        return {
          height: (b[i + 5]! << 8) | b[i + 6]!,
          width: (b[i + 7]! << 8) | b[i + 8]!,
        };
      }
      i += 2 + length;
    }
  }
  return null;
}

export function fitSize(width: number, height: number, maxSide: number): ImageSize {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Draw a bitmap onto a white background, scaled to `maxSide`, and encode as JPEG. */
export async function bitmapToJpeg(
  bitmap: ImageBitmap,
  maxSide: number,
  quality: number,
): Promise<Blob> {
  const { width, height } = fitSize(bitmap.width, bitmap.height, maxSide);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.fillStyle = "#ffffff"; // transparent PNG/GIF areas become white, not black
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvas.convertToBlob({ type: "image/jpeg", quality });
}

/** Both previews (AI + grid) from one decoded bitmap. */
export async function previewsFromBitmap(bitmap: ImageBitmap): Promise<ImagePreviews> {
  const [ai, grid] = await Promise.all([
    bitmapToJpeg(bitmap, PREVIEW.aiMaxSide, PREVIEW.aiJpegQuality),
    bitmapToJpeg(bitmap, PREVIEW.gridMaxSide, PREVIEW.gridJpegQuality),
  ]);
  return { ai, grid };
}

async function decodeScaled(file: Blob, size: ImageSize | null): Promise<ImageBitmap> {
  const max = PREVIEW.aiMaxSide;
  // Large picture: ask the browser to decode it already shrunk (saves RAM).
  if (size && Math.max(size.width, size.height) > max * 1.5) {
    const options: ImageBitmapOptions =
      size.width >= size.height
        ? { resizeWidth: max, resizeQuality: "medium" }
        : { resizeHeight: max, resizeQuality: "medium" };
    try {
      return await createImageBitmap(file, options);
    } catch {
      /* fall through to a normal decode */
    }
  }
  return createImageBitmap(file);
}

export async function makeImagePreviews(file: Blob): Promise<ImagePreviews> {
  const head = new Uint8Array(await file.slice(0, 512 * 1024).arrayBuffer());
  const bitmap = await decodeScaled(file, sniffImageSize(head));
  try {
    return await previewsFromBitmap(bitmap);
  } finally {
    bitmap.close();
  }
}
