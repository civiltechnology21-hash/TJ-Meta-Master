"use client";

import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { matchKey, splitKeywordText } from "@/features/negative/normalize";
import { cn } from "@/lib/utils";

interface TagInputProps {
  tags: readonly string[];
  onChange: (tags: string[]) => void;
  /** Maximum number of tags. The text field is disabled when it is reached. */
  max: number;
  /** Longest single tag (characters). */
  maxTagChars: number;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}

/**
 * Tag field. A tag is created when a comma is followed by a space:
 * everything before ", " becomes ONE tag (multi-word phrases stay together).
 * Text that was not followed by ", " is not a tag and is not saved.
 */
export function TagInput({
  tags,
  onChange,
  max,
  maxTagChars,
  placeholder = "Type a keyword...",
  ariaLabel = "Keywords",
  className,
}: TagInputProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const full = tags.length >= max;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { committed, rest } = splitKeywordText(e.target.value);
    if (committed.length === 0) {
      setText(rest);
      return;
    }
    const next = [...tags];
    const known = new Set(next.map(matchKey));
    for (const raw of committed) {
      if (next.length >= max) break;
      const tag = raw.slice(0, maxTagChars).trim();
      const key = matchKey(tag);
      if (!key || known.has(key)) continue; // duplicate: ignored
      known.add(key);
      next.push(tag);
    }
    onChange(next);
    setText(next.length >= max ? "" : rest);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && text === "" && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const removeAt = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
    inputRef.current?.focus();
  };

  return (
    <div
      className={cn(
        "rounded-sm border border-line-strong bg-field p-2 text-sm text-fg",
        "transition-[border-color,box-shadow] duration-200 hover:border-muted-2/60",
        "focus-within:border-brand focus-within:shadow-[0_0_0_3px_var(--c-brand-wash)]",
        className,
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {tags.length > 0 ? (
        <ul className="mb-1 flex flex-wrap gap-1.5">
          {tags.map((tag, index) => (
            <li
              // Tags are unique (duplicates are refused), so the text itself is a stable key:
              // only a newly added tag plays the pop-in, the others keep still.
              key={tag}
              className="animate-pop flex max-w-full items-center gap-1 rounded-sm border border-brand/25 bg-brand-wash px-2 py-1 text-xs font-medium text-brand"
            >
              <span className="min-w-0 break-words">{tag}</span>
              <button
                type="button"
                aria-label={`Remove ${tag}`}
                className="shrink-0 text-muted transition-colors hover:text-fg"
                onClick={(e) => {
                  e.stopPropagation();
                  removeAt(index);
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        ref={inputRef}
        type="text"
        value={text}
        disabled={full}
        maxLength={maxTagChars * 2}
        autoComplete="off"
        spellCheck={false}
        aria-label={ariaLabel}
        placeholder={full ? `Limit of ${max} reached` : placeholder}
        className="h-7 w-full bg-transparent px-1 text-sm text-fg placeholder:text-muted focus:outline-none disabled:cursor-not-allowed"
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
