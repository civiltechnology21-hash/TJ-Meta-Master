"use client";

import { useEffect, useRef, useState } from "react";
import { TagInput } from "@/components/ui/TagInput";
import { NEGATIVE_LIMITS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/store/settingsStore";

const inputClass =
  "h-10 w-full min-w-0 rounded-sm border border-line-strong bg-field px-3 text-[13px] text-fg " +
  "placeholder:text-muted-2 transition-[border-color,box-shadow] duration-200 " +
  "hover:border-muted-2/60 focus:border-brand focus:shadow-[0_0_0_3px_var(--c-brand-wash)] focus:outline-none";

/** Small text button that empties a section. Disabled while the section is already empty. */
function ClearButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-7 rounded-sm border border-line px-2.5 text-[11px] font-medium text-muted transition-colors duration-200",
        "hover:border-line-strong hover:bg-panel-3 hover:text-fg active:scale-[0.97]",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:bg-transparent disabled:hover:text-muted",
      )}
    >
      Clear
    </button>
  );
}

/**
 * "Negative Prompts" card (right column, under the sliders).
 *  - Title: up to 5 example titles to avoid. Every row has an x (remove) and the section has Clear.
 *  - Keywords: up to 30 words or phrases that must not appear (comma + space makes a tag). Has Clear.
 * Everything is saved in this browser. Empty = the feature does nothing.
 */
export function NegativePromptCard() {
  const input = useSettingsStore((s) => s.negativeInput);
  const setNegativeInput = useSettingsStore((s) => s.setNegativeInput);

  const { titles, keywords } = input;
  const canAdd = titles.length < NEGATIVE_LIMITS.maxTitles;
  const hasTitleText = titles.some((t) => t !== "");

  const rowRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [focusRow, setFocusRow] = useState<number | null>(null);

  // After "+" put the cursor into the new row.
  useEffect(() => {
    if (focusRow === null) return;
    rowRefs.current[focusRow]?.focus();
    setFocusRow(null);
  }, [focusRow, titles.length]);

  const setTitle = (index: number, value: string) =>
    setNegativeInput({ titles: titles.map((t, i) => (i === index ? value : t)) });

  const addRow = () => {
    if (!canAdd) return;
    setNegativeInput({ titles: [...titles, ""] });
    setFocusRow(titles.length);
  };

  // x on a row removes it. The last remaining row is emptied instead (one row always stays).
  const removeRow = (index: number) =>
    setNegativeInput({ titles: titles.length <= 1 ? [""] : titles.filter((_, i) => i !== index) });

  return (
    <section
      aria-labelledby="negative-prompts-heading"
      className="rounded-lg border border-line bg-panel-2 p-5 md:p-6"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line pb-4">
        <h2
          id="negative-prompts-heading"
          className="flex items-center gap-2.5 font-display text-sm font-bold tracking-tight"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-muted" aria-hidden="true">
            <circle cx="12" cy="12" r="8.5" />
            <path d="m9 9 6 6m0-6-6 6" />
          </svg>
          Negative prompts
        </h2>
        <span className="text-[10px] text-muted-2">AI exclusions</span>
      </div>

      {/* ---------------- Title ---------------- */}
      <div className="border-b border-line py-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-xs font-medium text-fg">Titles</h3>
          <div className="flex items-center gap-2">
            <ClearButton
              label="Clear all titles"
              disabled={!hasTitleText && titles.length === 1}
              onClick={() => setNegativeInput({ titles: [""] })}
            />
            <button
              type="button"
              aria-label="Add another title"
              title={canAdd ? "Add another title" : `Maximum ${NEGATIVE_LIMITS.maxTitles} titles`}
              disabled={!canAdd}
              onClick={addRow}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-sm bg-brand text-lg leading-none text-white",
                "transition-[background-color,transform] duration-200 enabled:hover:-translate-y-px enabled:hover:bg-brand-hover enabled:active:scale-95",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              +
            </button>
          </div>
        </div>

        <ul className="space-y-2.5">
          {titles.map((title, index) => (
            <li key={index} className="animate-row-in flex items-center gap-2">
              <span className="w-5 shrink-0 text-[11px] font-semibold text-muted">{index + 1}.</span>
              <input
                ref={(el) => {
                  rowRefs.current[index] = el;
                }}
                type="text"
                value={title}
                maxLength={NEGATIVE_LIMITS.maxTitleChars}
                autoComplete="off"
                aria-label={`Negative title ${index + 1}`}
                placeholder="Enter a title to avoid..."
                className={inputClass}
                onChange={(e) => setTitle(index, e.target.value)}
              />
              <button
                type="button"
                aria-label={`Remove title ${index + 1}`}
                onClick={() => removeRow(index)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-lg leading-none text-muted-2 transition-colors duration-200 hover:bg-panel-3 hover:text-fg active:scale-95"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[10px] text-muted-2">Up to {NEGATIVE_LIMITS.maxTitles} title exclusions</p>
      </div>

      {/* ---------------- Keywords ---------------- */}
      <div className="pt-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-xs font-medium text-fg">Keywords</h3>
          <ClearButton
            label="Clear all keywords"
            disabled={keywords.length === 0}
            onClick={() => setNegativeInput({ keywords: [] })}
          />
        </div>
        <TagInput
          tags={keywords}
          onChange={(next) => setNegativeInput({ keywords: next })}
          max={NEGATIVE_LIMITS.maxKeywords}
          maxTagChars={NEGATIVE_LIMITS.maxKeywordChars}
          placeholder="Type a keyword..."
          ariaLabel="Negative keywords"
          className="min-h-[5.5rem] p-2.5"
        />
        <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-muted-2">
          <span>Finish each keyword with a comma and a space</span>
          <span className="tabular-nums" aria-live="polite">
            {keywords.length} / {NEGATIVE_LIMITS.maxKeywords} keywords
          </span>
        </div>
      </div>
    </section>
  );
}
