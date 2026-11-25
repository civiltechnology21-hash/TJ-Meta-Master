/** How a file is turned into a preview. */
export type MediaKind = "image" | "video" | "eps" | "svg" | "ai";

export type PreviewStatus = "pending" | "ready" | "failed";

/**
 * A file the user selected on the Home page.
 * The original `File` is only a reference - its bytes are never read in full.
 */
export interface SelectedFile {
  id: string;
  file: File;
  /** Original file name (may contain any characters). */
  name: string;
  /** Lower-case extension without the dot, e.g. "jpg". */
  ext: string;
  kind: MediaKind;
  size: number;
  previewStatus: PreviewStatus;
  /** Tiny blob: URL for the Home grid (~160px). */
  gridThumbUrl: string | null;
  /** Blobs sent to Gemini: 1 for images, 1-3 frames for videos (~768px JPEG). */
  aiPreviews: Blob[];
  previewError?: string;
}
