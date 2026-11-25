import { PREVIEW } from "@/lib/constants";
import { previewsWithAutoCrop } from "./cropContent";

/**
 * SVG -> preview, entirely in the browser (free, no server):
 *   1. read the drawing size (viewBox / width / height) and write an explicit size
 *      into the SVG so every browser draws it the same way,
 *   2. load it through <img> (scripts and outside resources are NOT run or fetched),
 *   3. draw it big on a canvas, crop the empty margin, shrink to the preview size.
 */

const MAX_SVG_BYTES = 60 * 1024 * 1024;
const FALLBACK_SIZE = 1000;

export interface SvgFrame {
  /** Drawing size in its own units (viewBox when present, else width/height). */
  width: number;
  height: number;
  /** True when the file had no viewBox and one must be added. */
  needsViewBox: boolean;
}

/** A number like "120", "120.5px" or "3in"; percentages and junk give null. */
function lengthValue(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = /^\s*(-?\d*\.?\d+(?:e[-+]?\d+)?)\s*([a-z]*)\s*$/i.exec(raw);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Decides the drawing size from the root <svg> attributes. */
export function svgFrame(attrs: {
  viewBox?: string | null;
  width?: string | null;
  height?: string | null;
}): SvgFrame {
  if (attrs.viewBox) {
    const p = attrs.viewBox.trim().split(/[\s,]+/).map(Number);
    if (p.length === 4 && p.every(Number.isFinite) && p[2]! > 0 && p[3]! > 0) {
      return { width: p[2]!, height: p[3]!, needsViewBox: false };
    }
  }
  const w = lengthValue(attrs.width);
  const h = lengthValue(attrs.height);
  if (w && h) return { width: w, height: h, needsViewBox: true };
  return { width: w ?? h ?? FALLBACK_SIZE, height: h ?? w ?? FALLBACK_SIZE, needsViewBox: true };
}

/** Scales (up or down) so the longest side is `side` pixels. */
export function sizeForSide(frame: SvgFrame, side: number): { width: number; height: number } {
  const scale = side / Math.max(frame.width, frame.height);
  return {
    width: Math.max(1, Math.round(frame.width * scale)),
    height: Math.max(1, Math.round(frame.height * scale)),
  };
}

/** Returns SVG text with an explicit width/height (and viewBox if it had none). */
function prepareSvg(text: string, side: number): { svg: string; width: number; height: number } {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== "svg" || doc.getElementsByTagName("parsererror").length) {
    throw new Error("This is not a valid SVG file.");
  }
  const frame = svgFrame({
    viewBox: root.getAttribute("viewBox"),
    width: root.getAttribute("width"),
    height: root.getAttribute("height"),
  });
  const size = sizeForSide(frame, side);
  if (frame.needsViewBox) root.setAttribute("viewBox", `0 0 ${frame.width} ${frame.height}`);
  root.setAttribute("width", String(size.width));
  root.setAttribute("height", String(size.height));
  return { svg: new XMLSerializer().serializeToString(root), ...size };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The browser could not draw this SVG."));
    img.src = url;
  });
}

export async function makeSvgPreviews(file: Blob): Promise<{ ai: Blob[]; grid: Blob }> {
  if (file.size > MAX_SVG_BYTES) throw new Error("This SVG file is too large to preview.");
  const { svg, width, height } = prepareSvg(await file.text(), PREVIEW.vectorRenderSide);

  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = await loadImage(url);
    const canvas = new OffscreenCanvas(width, height); // transparent: margins are detectable
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available in this browser.");
    ctx.drawImage(img, 0, 0, width, height);
    const bitmap = await createImageBitmap(canvas);
    try {
      return await previewsWithAutoCrop(bitmap, "This SVG looks empty.");
    } finally {
      bitmap.close();
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}
