import { EXTENSION_KIND } from "@/lib/constants";
import { getExt } from "@/lib/utils";
import type { MediaKind } from "@/types/files";

export interface AcceptedFile {
  file: File;
  ext: string;
  kind: MediaKind;
}

/** Returns the type of a supported file, or null for anything else. */
export function classifyFile(file: File): { ext: string; kind: MediaKind } | null {
  const ext = getExt(file.name);
  const kind = EXTENSION_KIND[ext];
  return kind ? { ext, kind } : null;
}

/** Keeps supported formats only; everything else is silently ignored (counted). */
export function filterSupported(files: readonly File[]): {
  accepted: AcceptedFile[];
  ignored: number;
} {
  const accepted: AcceptedFile[] = [];
  let ignored = 0;
  for (const file of files) {
    const info = classifyFile(file);
    if (info) accepted.push({ file, ...info });
    else ignored++;
  }
  return { accepted, ignored };
}

/** Identity of a file, used to skip duplicates when the same file is added twice. */
export function fileKey(file: File): string {
  const path =
    (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
  return `${path}|${file.size}|${file.lastModified}`;
}
