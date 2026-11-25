import { create } from "zustand";
import { useBatchStore } from "@/store/batchStore";
import { buildCsv, csvFileName } from "./buildCsv";
import { insertCsv, updateCsv } from "./csvRepository";

/**
 * Saves the finished batch as ONE csv row in the database.
 *  - runs when a batch becomes "done" or "aborted" (partial results are kept),
 *  - after a Retry finishes, the same row is updated (never duplicated).
 */

type SaveState = "idle" | "saving" | "saved" | "error";

export const useCsvSaveStore = create<{ state: SaveState; message: string }>()(() => ({
  state: "idle",
  message: "",
}));

const savedRowByBatch = new Map<string, string>();

async function saveNow(): Promise<void> {
  const { batchId, startedAt, items, marketplace } = useBatchStore.getState();
  if (!batchId || !startedAt) return;

  const ok = items.filter((i) => i.status === "success" && i.meta);
  if (ok.length === 0) return;

  const csv = buildCsv(ok, marketplace);
  useCsvSaveStore.setState({ state: "saving", message: "" });
  try {
    const existing = savedRowByBatch.get(batchId);
    if (existing) {
      await updateCsv(existing, { fileCount: ok.length, csvContent: csv });
    } else {
      const id = await insertCsv({
        kind: items.length === 1 ? "single" : "batch",
        fileCount: ok.length,
        fileName: csvFileName(startedAt, marketplace),
        csvContent: csv,
      });
      savedRowByBatch.set(batchId, id);
    }
    useCsvSaveStore.setState({ state: "saved", message: "" });
  } catch (error) {
    useCsvSaveStore.setState({
      state: "error",
      message: error instanceof Error ? error.message : "Could not save the CSV.",
    });
  }
}

/** Call once (in the app layout). Returns an unsubscribe function. */
export function startCsvAutoSave(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let chain: Promise<void> = Promise.resolve();

  const unsubscribe = useBatchStore.subscribe((state, previous) => {
    if (state.status === previous.status) return;
    if (state.status !== "done" && state.status !== "aborted") return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      chain = chain.then(saveNow);
    }, 500);
  });

  return () => {
    unsubscribe();
    clearTimeout(timer);
  };
}
