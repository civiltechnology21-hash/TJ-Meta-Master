"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for browsers/contexts without the Clipboard API
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

interface MetaBoxProps {
  icon: ReactNode;
  label: string;
  /** "31 words | 198 chars" */
  info: string;
  /** Exactly what is copied when the copy button is pressed. */
  text: string;
}

export function MetaBox({ icon, label, info, text }: MetaBoxProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const handleCopy = async () => {
    if (await copyText(text)) {
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">
          <span className="flex w-5 shrink-0 justify-center text-brand">{icon}</span>
          <span>{label}</span>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted">{info}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={`Copy ${label.toLowerCase()}`}
          title={copied ? "Copied!" : `Copy ${label.toLowerCase()}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-brand transition-[background-color,transform] duration-200 hover:bg-brand-wash active:scale-90"
        >
          {copied ? (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="animate-pop text-ok-fg" aria-hidden="true">
              <path d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="9" width="11" height="11" rx="2" />
              <path d="M5 15V6a2 2 0 0 1 2-2h9" />
            </svg>
          )}
        </button>
      </div>
      <div className="whitespace-pre-wrap break-words rounded-md border border-line bg-field px-4 py-3 text-sm leading-relaxed">
        {text}
      </div>
    </div>
  );
}
