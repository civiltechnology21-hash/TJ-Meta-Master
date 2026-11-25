"use client";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { BatchStats } from "@/types/batch";

interface StatsBarProps {
  stats: BatchStats;
  /** Export CSV becomes clickable only when processing is over and something succeeded. */
  canExport: boolean;
  onExport: () => void;
  /** Small status text next to the button, e.g. "Saved to CSV history". */
  saveNote?: { text: string; error: boolean } | null;
}

function Box({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "success" | "danger";
}) {
  return (
    <div
      className={cn(
        "flex min-w-24 flex-col items-center rounded-md border px-5 py-2 transition-colors duration-300",
        tone === "neutral" && "border-line bg-panel-2",
        tone === "success" && "border-ok/40 bg-ok/15",
        tone === "danger" && "border-bad/40 bg-bad/15",
      )}
    >
      <span
        className={cn(
          "text-xs",
          tone === "neutral" && "text-muted",
          tone === "success" && "text-ok-fg",
          tone === "danger" && "text-bad-fg",
        )}
      >
        {label}
      </span>
      {/* A new key replays the small pop each time the number changes. */}
      <span key={value} className="animate-pop font-display text-xl font-bold tabular-nums">
        {value}
      </span>
    </div>
  );
}

export function StatsBar({ stats, canExport, onExport, saveNote }: StatsBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel px-[clamp(1rem,3.15vw,3rem)] py-3">
      <div className="flex items-center gap-3">
        <Box label="Total" value={stats.total} tone="neutral" />
        <Box
          label="Successful"
          value={stats.successful}
          tone={stats.successful > 0 ? "success" : "neutral"}
        />
        <Box label="Failed" value={stats.failed} tone={stats.failed > 0 ? "danger" : "neutral"} />
      </div>

      <div className="flex items-center gap-3">
        {saveNote ? (
          <span className={cn("text-xs", saveNote.error ? "text-bad-fg" : "text-muted")}>
            {saveNote.text}
          </span>
        ) : null}
        <Button size="lg" variant="primary" disabled={!canExport} onClick={onExport}>
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" />
            <path d="M5 16.5v2A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-2" />
          </svg>
          Export CSV
        </Button>
      </div>
    </div>
  );
}
