import { PREVIEW } from "@/lib/constants";
import { previewsWithAutoCrop } from "./cropContent";
import { dpiFor, readBoundingBox, renderEpsToPng, renderPdfToPng } from "./epsRender";

/**
 * Adobe Illustrator (.ai) -> preview with Ghostscript (WebAssembly), free and in the browser.
 * Modern .ai files are PDF files ("Create PDF Compatible File" on, the default), so they
 * are rendered like a PDF page. Very old .ai files are PostScript and go the EPS way.
 */

const NOT_SUPPORTED =
  "Could not read this AI file. Save it from Illustrator with “Create PDF Compatible File” turned on.";

async function sniff(file: Blob): Promise<"pdf" | "ps" | null> {
  const head = await file.slice(0, 1024).text();
  if (head.includes("%PDF-")) return "pdf";
  if (head.startsWith("%!")) return "ps";
  return null;
}

export async function makeAiPreviews(file: Blob): Promise<{ ai: Blob[]; grid: Blob }> {
  const type = await sniff(file);
  if (!type) throw new Error(NOT_SUPPORTED);

  let png: Uint8Array;
  try {
    if (type === "pdf") {
      png = await renderPdfToPng(file, PREVIEW.vectorRenderSide);
    } else {
      const box = await readBoundingBox(file);
      png = await renderEpsToPng(file, dpiFor(box, PREVIEW.vectorRenderSide));
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    throw new Error(`${NOT_SUPPORTED} (${reason})`);
  }

  const bitmap = await createImageBitmap(new Blob([png as BlobPart], { type: "image/png" }));
  try {
    return await previewsWithAutoCrop(bitmap, "This AI file looks empty.");
  } finally {
    bitmap.close();
  }
}
