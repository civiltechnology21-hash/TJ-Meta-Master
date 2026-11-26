import { create } from "zustand";
import { effectiveConstraints, getMarketplace } from "@/features/ai/marketplaces";
import { buildNegativePolicy } from "@/features/negative/policy";
import { BatchRunner, type PauseInfo } from "@/features/queue/queueManager";
import { uid } from "@/lib/utils";
import { useSettingsStore } from "@/store/settingsStore";
import type { BatchItem, BatchStats, BatchStatus } from "@/types/batch";
import type { SelectedFile } from "@/types/files";
import type { UserConstraints } from "@/types/metadata";

interface BatchState {
  batchId: string | null;
  status: BatchStatus;
  items: BatchItem[];
  constraints: UserConstraints | null;
  /** Marketplace the batch was started with (decides CSV layout and file name). */
  marketplace: string | null;
  startedAt: string | null;
  /** Set while status === "paused" (key / quota problem). */
  pause: PauseInfo | null;
  /** Live hint while the runner waits ("Gemini is busy..."). */
  note: string | null;

  /** Take the selected files and begin generating. */
  start: (files: SelectedFile[], constraints: UserConstraints) => void;
  /** Red button: stop all requests now. */
  abort: () => void;
  /** After replacing the API key: continue the remaining files. */
  resume: () => void;
  /** Retry ONE failed file. */
  retry: (itemId: string) => void;
  /** Forget the batch and free its memory. */
  reset: () => void;
}

let runner: BatchRunner | null = null;

function revokeThumbs(items: readonly BatchItem[]): void {
  for (const item of items) {
    if (item.thumbUrl) URL.revokeObjectURL(item.thumbUrl);
  }
}

export function computeStats(items: readonly BatchItem[]): BatchStats {
  let successful = 0;
  let failed = 0;
  let cancelled = 0;
  for (const item of items) {
    if (item.status === "success") successful++;
    else if (item.status === "failed") failed++;
    else if (item.status === "cancelled") cancelled++;
  }
  return {
    total: items.length,
    successful,
    failed,
    finished: successful + failed + cancelled,
  };
}

export const useBatchStore = create<BatchState>()((set, get) => ({
  batchId: null,
  status: "idle",
  items: [],
  constraints: null,
  marketplace: null,
  startedAt: null,
  pause: null,
  note: null,

  start: (files, requestedConstraints) => {
    // Only ONE marketplace per batch, frozen now: its rules, its limits, its CSV.
    const marketplace = getMarketplace(useSettingsStore.getState().marketplace).id;
    const constraints = effectiveConstraints(getMarketplace(marketplace).rules, requestedConstraints);

    // A new batch replaces the old one.
    runner?.abort();
    revokeThumbs(get().items);

    const items: BatchItem[] = files.map((f) => {
      const usable = f.previewStatus === "ready" && f.aiPreviews.length > 0;
      return {
        id: uid(),
        fileId: f.id,
        fileName: f.name,
        kind: f.kind,
        thumbUrl: f.gridThumbUrl,
        previews: usable ? f.aiPreviews : [],
        status: usable ? "pending" : "failed",
        attempts: 0,
        error: usable
          ? undefined
          : {
              code: "PREVIEW_FAILED",
              message: f.previewError ?? "A preview could not be created for this file.",
            },
      };
    });

    set({
      batchId: uid(),
      status: "running",
      items,
      constraints,
      marketplace,
      startedAt: new Date().toISOString(),
      pause: null,
    });

    // Frozen now: changing the card later never alters a batch that is already running.
    // null (nothing typed) = Negative Prompt is off and the batch runs exactly as before.
    const negative = buildNegativePolicy(useSettingsStore.getState().negativeInput, {
      withTitles: getMarketplace(marketplace).rules.hasTitle,
    });
    runner = new BatchRunner(
      {
        getItems: () => get().items,
        updateItem: (id, patch) =>
          set((s) => ({ items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) })),
        setStatus: (status, pause = null) => set({ status, pause, note: null }),
        setNote: (note) => set({ note }),
        getApiKey: () => useSettingsStore.getState().apiKey,
        getMarketplace: () => marketplace,
        getNegativePolicy: () => negative,
      },
      constraints,
    );
    runner.start();
  },

  abort: () => runner?.abort(),
  resume: () => runner?.resume(),
  retry: (itemId) => runner?.retry(itemId),

  reset: () => {
    runner?.abort();
    runner = null;
    revokeThumbs(get().items);
    set({
      batchId: null,
      status: "idle",
      items: [],
      constraints: null,
      marketplace: null,
      startedAt: null,
      pause: null,
    });
  },
}));
