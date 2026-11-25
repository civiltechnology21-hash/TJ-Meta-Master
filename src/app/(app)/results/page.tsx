"use client";

import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { ProgressPanel } from "@/components/results/ProgressPanel";
import { ResultCard } from "@/components/results/ResultCard";
import { StatsBar } from "@/components/results/StatsBar";
import { Button } from "@/components/ui/Button";
import { buildCsv, csvFileName } from "@/features/csv/buildCsv";
import { useCsvSaveStore } from "@/features/csv/autoSave";
import { downloadCsv } from "@/features/csv/downloadCsv";
import { ROUTES } from "@/lib/constants";
import { computeStats, useBatchStore } from "@/store/batchStore";
import { useUiStore } from "@/store/uiStore";

export default function ResultsPage() {
  const router = useRouter();
  const items = useBatchStore((s) => s.items);
  const status = useBatchStore((s) => s.status);
  const pause = useBatchStore((s) => s.pause);
  const note = useBatchStore((s) => s.note);
  const startedAt = useBatchStore((s) => s.startedAt);
  const marketplace = useBatchStore((s) => s.marketplace);
  const retry = useBatchStore((s) => s.retry);
  const resume = useBatchStore((s) => s.resume);
  const saveState = useCsvSaveStore((s) => s.state);
  const saveMessage = useCsvSaveStore((s) => s.message);

  const stats = useMemo(() => computeStats(items), [items]);
  const processing = status === "running" || status === "paused";

  // No batch in memory (page opened directly or refreshed): back to Home.
  useEffect(() => {
    if (status === "idle" && items.length === 0) router.replace(ROUTES.home);
  }, [status, items.length, router]);

  // Warn before closing the tab while files are still being processed.
  useEffect(() => {
    if (status !== "running") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [status]);

  /* ---- virtualized list: only the visible cards are rendered ---- */
  const listRef = useRef<HTMLDivElement>(null);
  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => 420,
    overscan: 3,
    scrollMargin: listRef.current?.offsetTop ?? 0,
    getItemKey: (index) => items[index]?.id ?? index,
  });

  if (items.length === 0) return null;

  const handleExport = () => {
    downloadCsv(
      buildCsv(items, marketplace),
      csvFileName(startedAt ?? new Date().toISOString(), marketplace),
    );
  };

  const saveNote =
    saveState === "saving"
      ? { text: "Saving to CSV history...", error: false }
      : saveState === "saved"
        ? { text: "✓ Saved to CSV history", error: false }
        : saveState === "error"
          ? { text: `Not saved: ${saveMessage}`, error: true }
          : null;

  return (
    <div className="pb-10">
      {processing ? (
        <ProgressPanel
          finished={stats.finished}
          total={stats.total}
          label={status === "paused" ? "Paused" : note ?? "Processing images..."}
          paused={status === "paused"}
        />
      ) : null}

      {status === "paused" && pause ? (
        <div
          role="alert"
          className="animate-row-in flex flex-wrap items-center justify-between gap-3 border-b border-bad/40 bg-bad/10 px-[clamp(1rem,3.15vw,3rem)] py-3 text-sm"
        >
          <p className="min-w-0 flex-1 text-bad-fg">{pause.message}</p>
          <div className="flex gap-2">
            {pause.reason === "key" || pause.reason === "quota" ? (
              <Button size="sm" onClick={() => useUiStore.getState().openSettings()}>
                Open Settings
              </Button>
            ) : null}
            <Button size="sm" variant="primary" onClick={resume}>
              Resume
            </Button>
          </div>
        </div>
      ) : null}

      <div>
        <StatsBar
          stats={stats}
          canExport={!processing && stats.successful > 0}
          onExport={handleExport}
          saveNote={!processing ? saveNote : null}
        />
      </div>

      <div ref={listRef} className="mx-auto mt-4 w-full max-w-[1500px] px-3">
        <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((row) => {
            const item = items[row.index];
            if (!item) return null;
            return (
              <div
                key={row.key}
                data-index={row.index}
                ref={virtualizer.measureElement}
                className="absolute left-0 top-0 w-full pb-3"
                style={{ transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)` }}
              >
                <ResultCard item={item} onRetry={retry} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
