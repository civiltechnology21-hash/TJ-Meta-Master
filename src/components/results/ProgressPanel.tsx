interface ProgressPanelProps {
  finished: number;
  total: number;
  /** Left text, e.g. "Processing images..." */
  label: string;
  paused?: boolean;
}

/** Live progress: text on the left, "5/10" on the right, blue bar below. */
export function ProgressPanel({ finished, total, label, paused = false }: ProgressPanelProps) {
  const percent = total > 0 ? Math.min(100, Math.round((finished / total) * 100)) : 0;

  return (
    <div className="border-b border-line bg-panel px-[clamp(1rem,3.15vw,3rem)] py-4">
      <div className="mb-2.5 flex items-center justify-between gap-4 text-sm">
        <span className="min-w-0 truncate text-fg">{label}</span>
        <span className="shrink-0 font-display font-bold tabular-nums text-muted">
          {finished}/{total}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-2 w-full overflow-hidden rounded-full bg-track"
      >
        <div
          className={`h-full rounded-full bg-brand transition-[width,opacity] duration-500 ease-out ${
            paused ? "opacity-60" : "tj-stripes"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
