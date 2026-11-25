"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { testApiKey } from "@/features/ai/geminiClient";
import { maskKey } from "@/lib/utils";
import { useBatchStore } from "@/store/batchStore";
import { useSettingsStore } from "@/store/settingsStore";

const inputClass =
  "h-11 w-full rounded-md border border-line-strong bg-field px-3 text-sm text-fg " +
  "placeholder:text-muted-2 transition-[border-color,box-shadow] duration-200 " +
  "hover:border-muted-2/60 focus:border-brand focus:shadow-[0_0_0_3px_var(--c-brand-wash)] focus:outline-none";

function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l9-9M16 7l3 3" />
    </svg>
  );
}

export function ApiKeyTab() {
  const apiKey = useSettingsStore((s) => s.apiKey);
  const setApiKey = useSettingsStore((s) => s.setApiKey);
  const removeApiKey = useSettingsStore((s) => s.removeApiKey);

  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const saveKey = (key: string) => {
    if (!setApiKey(key)) {
      setError("Could not save the key in this browser (storage is blocked).");
      return;
    }
    setDraft("");
    setError(null);
    setRevealed(false);

    // A batch that stopped because of the old key / quota continues with the new key.
    const { status, pause, resume } = useBatchStore.getState();
    if (status === "paused" && pause && pause.reason !== "rate") resume();
  };

  const handleSave = async () => {
    const key = draft.trim();
    if (!key) return;
    setChecking(true);
    setError(null);
    const result = await testApiKey(key);
    setChecking(false);
    if (result.ok) saveKey(key);
    else setError(result.message);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard not available */
    }
  };

  return (
    <div className="max-w-2xl space-y-6 p-6">
      <header className="flex items-center gap-2.5 border-b border-line pb-3 font-display text-lg font-bold tracking-tight">
        <span className="text-brand">
          <KeyIcon />
        </span>
        API Configuration
      </header>

      <section className="space-y-3">
        <h3 className="text-[13px] font-medium text-muted">Gemini API Key</h3>

        {apiKey ? (
          <div className="animate-fade flex items-center gap-3 rounded-lg border border-line bg-panel-2 px-4 py-3">
            <span className="text-brand">
              <KeyIcon />
            </span>
            <code className="min-w-0 flex-1 truncate font-mono text-sm">
              {revealed ? apiKey : maskKey(apiKey)}
            </code>
            <Button size="sm" variant="ghost" onClick={() => setRevealed((v) => !v)}>
              {revealed ? "Hide" : "Show"}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCopy}>
              {copied ? "Copied ✓" : "Copy"}
            </Button>
            {confirmRemove ? (
              <>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    removeApiKey();
                    setConfirmRemove(false);
                    setRevealed(false);
                  }}
                >
                  Remove
                </Button>
                <Button size="sm" onClick={() => setConfirmRemove(false)}>
                  Keep
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(true)} aria-label="Remove API key" title="Remove API key">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
                </svg>
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={draft}
              placeholder="Paste your Gemini API key"
              onChange={(e) => {
                setDraft(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSave();
              }}
              className={inputClass}
              aria-label="Gemini API key"
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" disabled={!draft.trim() || checking} onClick={handleSave}>
                {checking ? "Checking key..." : "+ Save API Key"}
              </Button>
              {error ? (
                <Button disabled={!draft.trim() || checking} onClick={() => saveKey(draft)}>
                  Save anyway
                </Button>
              ) : null}
            </div>
            {error ? (
              <p role="alert" className="animate-row-in text-sm text-bad-fg">
                {error}
              </p>
            ) : null}
          </div>
        )}
      </section>

      <ul className="list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-muted-2 marker:text-muted-2">
        <li>Only one key is used. When its limit is finished, remove it and save a new one.</li>
        <li>
          Google counts limits per <strong>project</strong>, not per key. A new key from the
          same Google project has the same limit. Create it in a different project or account.
        </li>
        <li>
          The key is stored only in this browser. It is never saved in the database, and files
          are sent from your browser straight to Google.
        </li>
        <li>If a batch stopped because of the old key, saving a new key continues it automatically.</li>
      </ul>
    </div>
  );
}
