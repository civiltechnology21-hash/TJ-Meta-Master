"use client";

import { memo, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatKeywords } from "@/features/metadata/normalizer";
import { getMetaCounts } from "@/features/metadata/validator";
import type { BatchItem } from "@/types/batch";
import { MetaBox } from "./MetaBox";

const iconTitle = (
  <span className="font-display text-base font-bold leading-none" aria-hidden="true">T</span>
);
const iconCategories = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" />
  </svg>
);
const iconDescription = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
    <path d="M4 6h16M4 12h16M4 18h10" />
  </svg>
);
const iconKeywords = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
    <circle cx="7.5" cy="7.5" r="1.2" />
  </svg>
);

function badgeFor(status: BatchItem["status"]) {
  switch (status) {
    case "success":
      return <Badge tone="success">Success</Badge>;
    case "failed":
      return <Badge tone="danger">Failed</Badge>;
    case "processing":
      return <Badge tone="info">Processing...</Badge>;
    case "cancelled":
      return <Badge>Cancelled</Badge>;
    default:
      return <Badge>Waiting</Badge>;
  }
}

/**
 * The badge pops when the status CHANGES while the card is on screen. A card that is only
 * being scrolled back into view (the list is virtualized) shows its badge without the pop.
 */
function StatusBadge({ status }: { status: BatchItem["status"] }) {
  const previous = useRef(status);
  const changed = previous.current !== status;
  useEffect(() => {
    previous.current = status;
  });
  return (
    <span key={status} className={changed ? "animate-pop inline-flex" : "inline-flex"}>
      {badgeFor(status)}
    </span>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="tj-skeleton h-5 w-1/4 rounded-sm" />
      <div className="tj-skeleton h-14 rounded-md" />
      <div className="tj-skeleton h-5 w-1/4 rounded-sm" />
      <div className="tj-skeleton h-20 rounded-md" />
    </div>
  );
}

interface ResultCardProps {
  item: BatchItem;
  onRetry: (id: string) => void;
}

export const ResultCard = memo(function ResultCard({ item, onRetry }: ResultCardProps) {
  const { meta } = item;
  const counts = meta ? getMetaCounts(meta) : null;
  const canRetry =
    (item.status === "failed" || item.status === "cancelled") && item.previews.length > 0;

  return (
    <article className="flex flex-col gap-5 rounded-lg border border-line bg-panel p-4 md:flex-row md:p-5">
      <div className="h-48 w-full shrink-0 overflow-hidden rounded-md border border-line bg-field md:h-52 md:w-52">
        {item.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.thumbUrl} alt={item.fileName} className="h-full w-full object-cover" />
        ) : null}
      </div>

      <div className="min-w-0 flex-1 space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="min-w-0 flex-1 truncate text-[15px] font-medium" title={item.fileName}>
            {item.fileName}
          </h3>
          <div className="flex items-center gap-2">
            <StatusBadge status={item.status} />
            {canRetry ? (
              <Button size="sm" onClick={() => onRetry(item.id)}>
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 12a8 8 0 1 1-2.6-5.9" />
                  <path d="M20 4v4.5h-4.5" />
                </svg>
                Retry
              </Button>
            ) : null}
          </div>
        </header>

        {item.status === "success" && meta && counts ? (
          <div className="animate-fade space-y-4">
            {meta.title ? (
              <MetaBox
                icon={iconTitle}
                label="Title"
                info={`${counts.titleWords} words | ${counts.titleChars} chars`}
                text={meta.title}
              />
            ) : null}
            {meta.description ? (
              <MetaBox
                icon={iconDescription}
                label="Description"
                info={`${counts.descriptionWords} words | ${counts.descriptionChars} chars`}
                text={meta.description}
              />
            ) : null}
            <MetaBox
              icon={iconKeywords}
              label="Keywords"
              info={`${counts.keywordCount} keywords`}
              text={formatKeywords(meta.keywords)}
            />
            {meta.categories && meta.categories.length > 0 ? (
              <MetaBox
                icon={iconCategories}
                label="Categories"
                info={`${meta.categories.length} categories`}
                text={meta.categories.join(", ")}
              />
            ) : null}
          </div>
        ) : item.status === "failed" || item.status === "cancelled" ? (
          <div className="animate-fade rounded-md border border-line bg-field px-4 py-3 text-sm">
            <p className={item.status === "failed" ? "text-bad-fg" : "text-muted"}>
              {item.status === "cancelled"
                ? "Stopped before this file was processed."
                : (item.error?.message ?? "Could not generate metadata for this file.")}
            </p>
            {item.status === "failed" && item.attempts > 0 ? (
              <p className="mt-1 text-xs text-muted">Tried {item.attempts} time(s).</p>
            ) : null}
          </div>
        ) : (
          <Skeleton />
        )}
      </div>
    </article>
  );
});
