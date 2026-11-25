import { create } from "zustand";
import { fileKey, filterSupported } from "@/features/ingest/filterFormats";
import { cancelAllPreviews, requestPreview } from "@/features/thumbnail/thumbPool";
import { uid } from "@/lib/utils";
import type { SelectedFile } from "@/types/files";

interface Counts {
  ready: number;
  failed: number;
  pending: number;
}

interface FilesState {
  files: SelectedFile[];
  /** True while a dropped folder is being scanned. */
  scanning: boolean;
  /** Unsupported files that were skipped. */
  ignoredCount: number;
  counts: Counts;
  setScanning: (value: boolean) => void;
  addFiles: (incoming: File[]) => void;
  /** Remove everything and free all previews. */
  clear: () => void;
  /** Hand all files (with their previews) to the batch and reset, without freeing them. */
  takeAll: () => SelectedFile[];
}

/* ---- module state (not React state) ---- */
const knownKeys = new Set<string>();
const pendingPatches = new Map<string, Partial<SelectedFile>>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
/** Bumped by clear()/takeAll() so late preview results are thrown away. */
let epoch = 0;

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const EMPTY_COUNTS: Counts = { ready: 0, failed: 0, pending: 0 };

function countFiles(files: readonly SelectedFile[]): Counts {
  const counts = { ...EMPTY_COUNTS };
  for (const f of files) {
    if (f.previewStatus === "ready") counts.ready++;
    else if (f.previewStatus === "failed") counts.failed++;
    else counts.pending++;
  }
  return counts;
}

export const useFilesStore = create<FilesState>()((set, get) => {
  /** Apply all buffered preview results in ONE state update. */
  const flush = () => {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (pendingPatches.size === 0) return;
    const patches = new Map(pendingPatches);
    pendingPatches.clear();
    const files = get().files.map((f) => {
      const patch = patches.get(f.id);
      return patch ? { ...f, ...patch } : f;
    });
    set({ files, counts: countFiles(files) });
  };

  /** Buffer results so 1000 finished previews do not cause 1000 re-renders. */
  const queuePatch = (id: string, patch: Partial<SelectedFile>) => {
    pendingPatches.set(id, patch);
    if (!flushTimer) flushTimer = setTimeout(flush, 120);
  };

  const startPreview = (entry: SelectedFile, myEpoch: number) => {
    requestPreview(entry.file, entry.kind)
      .then((result) => {
        if (myEpoch !== epoch) return;
        queuePatch(entry.id, {
          previewStatus: "ready",
          gridThumbUrl: URL.createObjectURL(result.grid),
          aiPreviews: result.ai,
        });
      })
      .catch((error: unknown) => {
        if (myEpoch !== epoch) return;
        queuePatch(entry.id, {
          previewStatus: "failed",
          previewError:
            error instanceof Error ? error.message : "Could not create a preview.",
        });
      });
  };

  return {
    files: [],
    scanning: false,
    ignoredCount: 0,
    counts: { ...EMPTY_COUNTS },

    setScanning: (value) => set({ scanning: value }),

    addFiles: (incoming) => {
      const { accepted, ignored } = filterSupported(incoming);

      const fresh: SelectedFile[] = [];
      for (const item of accepted) {
        const key = fileKey(item.file);
        if (knownKeys.has(key)) continue; // same file added twice
        knownKeys.add(key);
        fresh.push({
          id: uid(),
          file: item.file,
          name: item.file.name,
          ext: item.ext,
          kind: item.kind,
          size: item.file.size,
          previewStatus: "pending",
          gridThumbUrl: null,
          aiPreviews: [],
        });
      }
      fresh.sort((a, b) => collator.compare(a.name, b.name));

      flush();
      const files = [...get().files, ...fresh];
      set({
        files,
        ignoredCount: get().ignoredCount + ignored,
        counts: countFiles(files),
      });

      const myEpoch = epoch;
      for (const entry of fresh) startPreview(entry, myEpoch);
    },

    clear: () => {
      epoch++;
      cancelAllPreviews();
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = null;
      pendingPatches.clear();
      knownKeys.clear();
      for (const f of get().files) {
        if (f.gridThumbUrl) URL.revokeObjectURL(f.gridThumbUrl);
      }
      set({ files: [], ignoredCount: 0, scanning: false, counts: { ...EMPTY_COUNTS } });
    },

    takeAll: () => {
      flush();
      const files = get().files;
      epoch++;
      knownKeys.clear();
      set({ files: [], ignoredCount: 0, scanning: false, counts: { ...EMPTY_COUNTS } });
      return files;
    },
  };
});
