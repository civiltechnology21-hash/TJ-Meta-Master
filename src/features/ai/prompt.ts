import type { MediaKind } from "@/types/files";

export { lengthWindow, requestedKeywordCount } from "./lengths";

export function describeFile(id: number, kind: MediaKind, previewCount: number): string {
  switch (kind) {
    case "video":
      return `File ${id}: ${previewCount} frame${previewCount === 1 ? "" : "s"} taken in time order from ONE video clip. Write metadata for the video footage as a whole (mention motion or action where visible).`;
    case "eps":
      return `File ${id}: a vector illustration or graphic (preview rendered from an EPS file).`;
    case "svg":
      return `File ${id}: a vector illustration or graphic (preview rendered from an SVG file).`;
    case "ai":
      return `File ${id}: a vector illustration or graphic (preview rendered from an Adobe Illustrator file).`;
    default:
      return `File ${id}: a photo, illustration or graphic.`;
  }
}

export function buildIntro(fileCount: number): string {
  return `Write metadata for the following ${fileCount} file${fileCount === 1 ? "" : "s"}. Each file is introduced by a "File N" label, followed by its image${fileCount === 1 ? "" : "s"}.`;
}
