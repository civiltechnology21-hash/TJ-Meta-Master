"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { DropPrompt, DropZone, PickerButtons } from "@/components/home/DropZone";
import { MarketplaceBar } from "@/components/home/MarketplaceBar";
import { NegativePromptCard } from "@/components/home/NegativePromptCard";
import { FileGrid } from "@/components/home/FileGrid";
import { SliderPanel } from "@/components/home/SliderPanel";
import { Button } from "@/components/ui/Button";
import { ROUTES, SUPPORTED_FORMATS_TEXT } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useBatchStore } from "@/store/batchStore";
import { useFilesStore } from "@/store/filesStore";
import { useSettingsStore } from "@/store/settingsStore";

export default function HomePage() {
  const router = useRouter();
  const files = useFilesStore((s) => s.files);
  const counts = useFilesStore((s) => s.counts);
  const scanning = useFilesStore((s) => s.scanning);
  const ignoredCount = useFilesStore((s) => s.ignoredCount);
  const clear = useFilesStore((s) => s.clear);

  useEffect(() => {
    useSettingsStore.getState().hydrate();
  }, []);

  const total = files.length;
  const preparing = counts.pending > 0;
  const canGenerate = total > 0 && counts.ready > 0 && !preparing && !scanning;

  // Why did previews fail? (first reason, shown under the file count)
  const firstFailure = useMemo(
    () => files.find((f) => f.previewStatus === "failed")?.previewError ?? "",
    [files],
  );

  const handleGenerate = () => {
    const selected = useFilesStore.getState().takeAll();
    useBatchStore.getState().start(selected, useSettingsStore.getState().constraints);
    router.push(ROUTES.results);
  };

  return (
    <div className="mx-auto w-[98%] max-w-[2200px] py-4 md:py-6">
      <DropZone>
        <section
          className={cn(
            "animate-rise relative overflow-hidden rounded-xl border border-line bg-panel shadow-card",
            "p-[clamp(1.375rem,3vw,2.625rem)]",
            // thin light line along the top edge
            "before:pointer-events-none before:absolute before:inset-x-[7.5%] before:top-0 before:h-px",
            "before:bg-linear-to-r before:from-transparent before:via-fg/15 before:to-transparent",
          )}
        >
          <div className="mb-6 flex flex-col items-center gap-2.5 text-center">
            <div
              className="grid h-9 w-9 place-items-center rounded-md border border-brand/25 bg-brand-wash text-brand"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5M6.5 10.5 12 5l5.5 5.5" />
              </svg>
            </div>
            <h1 className="font-display text-[clamp(1.3rem,2vw,1.8rem)] font-bold leading-tight tracking-[-0.045em]">
              Select Files or Folder &amp; Generate SEO-friendly Metadata
            </h1>
            <p className="text-[13px] text-muted">
              Prepare your assets, tune your metadata limits, and exclude terms that don’t belong.
            </p>
          </div>

          <MarketplaceBar />

          <div className="grid w-full gap-8 md:grid-cols-[0.98fr_1.02fr] md:gap-10">
            {/* ---------- left: files ---------- */}
            <div
              className="animate-rise flex min-w-0 flex-col gap-4 [animation-delay:80ms] md:border-r md:border-line md:pr-10"
            >
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-muted-2">
                    Step 01 / Assets
                  </span>
                  <h2 className="font-display text-[17px] font-bold tracking-tight">Source files</h2>
                </div>
                <div className="flex items-center gap-3">
                  <p className="whitespace-nowrap text-[13px] font-bold text-brand">
                    {total} {total === 1 ? "file" : "files"} selected
                  </p>
                  {total > 0 ? (
                    <Button size="sm" onClick={clear} className="animate-fade">
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <path d="M6 6l12 12M18 6 6 18" />
                      </svg>
                      Clear
                    </Button>
                  ) : null}
                </div>
              </div>

              {scanning ? (
                <p className="-mt-2 text-xs text-muted">Scanning folder...</p>
              ) : preparing ? (
                <p className="-mt-2 text-xs text-muted">
                  Preparing previews {total - counts.pending}/{total}
                </p>
              ) : counts.failed > 0 ? (
                <p className="-mt-2 text-xs text-bad-fg">
                  {counts.failed} preview{counts.failed === 1 ? "" : "s"} failed
                  {firstFailure ? `: ${firstFailure}` : ""}
                </p>
              ) : null}

              <PickerButtons />

              <div
                className={cn(
                  "h-[min(44vh,420px)] min-h-64 overflow-hidden rounded-lg border transition-colors duration-200",
                  total > 0
                    ? "border-line bg-field p-3"
                    : "border-dashed border-line-strong bg-[radial-gradient(ellipse_at_50%_40%,var(--c-brand-wash),transparent_62%)] hover:border-brand/50",
                )}
              >
                {total > 0 ? <FileGrid files={files} /> : <DropPrompt />}
              </div>

              <Button
                // A new key restarts the one-time light sweep each time Generate becomes usable.
                key={canGenerate ? "ready" : "waiting"}
                variant="primary"
                size="lg"
                fullWidth
                disabled={!canGenerate}
                onClick={handleGenerate}
                className={cn("text-[13px] font-bold", canGenerate && "tj-sheen")}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                  <path d="M13.2 1.8 4.9 13h5.4l-.8 9.2L19.2 10h-5.5l-.5-8.2Z" />
                </svg>
                Generate metadata
              </Button>
            </div>

            {/* ---------- right: sliders ---------- */}
            <div className="animate-rise min-w-0 space-y-3.5 self-start [animation-delay:160ms]">
              <SliderPanel />
              <NegativePromptCard />
            </div>
          </div>

          <footer className="mt-8 flex flex-col gap-1.5 border-t border-line pt-4 text-[10.5px] text-muted-2">
            <p className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v5m0-8h.01" />
              </svg>
              Supported formats: {SUPPORTED_FORMATS_TEXT}
            </p>
            {ignoredCount > 0 ? (
              <p>
                {ignoredCount} unsupported {ignoredCount === 1 ? "file was" : "files were"} ignored.
              </p>
            ) : null}
          </footer>
        </section>
      </DropZone>
    </div>
  );
}
