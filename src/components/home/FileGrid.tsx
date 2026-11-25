"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { memo, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { SelectedFile } from "@/types/files";

const TILE = 112; // px
const GAP = 12; // px

const Tile = memo(function Tile({ file }: { file: SelectedFile }) {
  const badge = file.kind === "image" ? null : file.ext.toUpperCase();
  return (
    <div
      title={file.previewError ? `${file.name}\n${file.previewError}` : file.name}
      className={cn(
        "relative overflow-hidden rounded-sm border bg-field",
        file.previewStatus === "failed" ? "border-bad" : "border-line",
      )}
      style={{ width: TILE, height: TILE }}
    >
      {file.previewStatus === "ready" && file.gridThumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={file.gridThumbUrl}
          alt={file.name}
          draggable={false}
          className="animate-fade h-full w-full object-cover"
        />
      ) : file.previewStatus === "failed" ? (
        <div className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center">
          <span className="text-xl text-bad-fg">!</span>
          <span className="line-clamp-2 text-[10px] leading-tight text-muted">
            {file.name}
          </span>
        </div>
      ) : (
        <div className="tj-skeleton h-full w-full" />
      )}
      {badge ? (
        <span className="absolute bottom-1 left-1 rounded-[5px] bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {badge}
        </span>
      ) : null}
    </div>
  );
});

/** Virtualized thumbnail grid: only the visible rows are in the DOM (fast with 1000s of files). */
export function FileGrid({ files }: { files: SelectedFile[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(4);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const width = el.clientWidth;
      setColumns(Math.max(1, Math.floor((width + GAP) / (TILE + GAP))));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const rowCount = Math.ceil(files.length / columns);
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => TILE + GAP,
    overscan: 4,
  });

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto pr-1">
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((row) => {
          const start = row.index * columns;
          const slice = files.slice(start, start + columns);
          return (
            <div
              key={row.key}
              className="absolute left-0 top-0 grid"
              style={{
                transform: `translateY(${row.start}px)`,
                height: TILE,
                gap: GAP,
                gridTemplateColumns: `repeat(${columns}, ${TILE}px)`,
              }}
            >
              {slice.map((file) => (
                <Tile key={file.id} file={file} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
