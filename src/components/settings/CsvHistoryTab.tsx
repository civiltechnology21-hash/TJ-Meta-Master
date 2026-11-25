"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  deleteCsv,
  getCsvContent,
  listCsv,
  renameCsv,
  type CsvListItem,
} from "@/features/csv/csvRepository";
import { downloadCsv } from "@/features/csv/downloadCsv";
import { charLength, cleanName, clampName, downloadName } from "@/features/csv/fileName";
import { CSV_NAME_MAX } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";

export function CsvHistoryTab() {
  const [rows, setRows] = useState<CsvListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<CsvListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [limitNote, setLimitNote] = useState(false);
  const [savingName, setSavingName] = useState(false);

  const startEdit = (row: CsvListItem) => {
    setEditingId(row.id);
    setDraft(row.file_name);
    setLimitNote(false);
    setError(null);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setLimitNote(false);
  };
  const handleDraft = (value: string) => {
    const clamped = clampName(value);
    setLimitNote(clamped !== value);
    setDraft(clamped);
  };
  const saveName = async (row: CsvListItem) => {
    const name = cleanName(draft);
    if (!name) {
      setError("The file name cannot be empty.");
      return;
    }
    if (name === row.file_name) {
      cancelEdit();
      return;
    }
    setSavingName(true);
    setError(null);
    try {
      await renameCsv(row.id, name);
      setRows((prev) => (prev ?? []).map((r) => (r.id === row.id ? { ...r, file_name: name } : r)));
      cancelEdit();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rename failed.");
    } finally {
      setSavingName(false);
    }
  };

  const load = useCallback(async () => {
    setError(null);
    setRows(null);
    try {
      setRows(await listCsv());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the CSV list.");
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDownload = async (row: CsvListItem) => {
    setBusyId(row.id);
    setError(null);
    try {
      downloadCsv(await getCsvContent(row.id), downloadName(row.file_name));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteCsv(toDelete.id);
      setRows((prev) => (prev ?? []).filter((r) => r.id !== toDelete.id));
      setToDelete(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5 p-6">
      <header className="flex items-center justify-between gap-3 border-b border-line pb-3">
        <h2 className="font-display text-lg font-bold tracking-tight">CSV Export</h2>
        <Button size="sm" onClick={load} disabled={rows === null}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 12a8 8 0 1 1-2.6-5.9" />
            <path d="M20 4v4.5h-4.5" />
          </svg>
          Refresh
        </Button>
      </header>

      <p className="text-sm text-muted">
        Every finished generation is saved here as a CSV file (single file or batch) with the date
        and time it was generated. Download it any time, or delete it permanently.
      </p>

      {error ? (
        <p role="alert" className="animate-row-in rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad-fg">
          {error}
        </p>
      ) : null}

      {rows === null ? (
        <p className="py-10 text-center text-sm text-muted">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-line py-10 text-center text-sm text-muted">
          No saved CSV files yet.
        </p>
      ) : (
        <div className="animate-fade overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-panel-2 text-[11px] uppercase tracking-[0.08em] text-muted-2">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Date &amp; time</th>
                <th className="px-4 py-2.5 font-semibold">Type</th>
                <th className="px-4 py-2.5 font-semibold">Files</th>
                <th className="px-4 py-2.5 font-semibold">File name</th>
                <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => (
                <tr key={row.id} className="transition-colors duration-150 hover:bg-panel-2/60">
                  <td className="whitespace-nowrap px-4 py-3">{formatDateTime(row.created_at)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={row.kind === "single" ? "neutral" : "info"}>
                      {row.kind === "single" ? "Single" : "Batch"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{row.file_count}</td>
                  <td
                    className={
                      editingId === row.id
                        ? "min-w-[280px] px-4 py-3"
                        : "max-w-[260px] truncate px-4 py-3 font-mono text-xs text-muted"
                    }
                    title={editingId === row.id ? undefined : row.file_name}
                  >
                    {editingId === row.id ? (
                      <div className="space-y-1">
                        <input
                          autoFocus
                          value={draft}
                          onChange={(e) => handleDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void saveName(row);
                            if (e.key === "Escape") cancelEdit();
                          }}
                          aria-label="CSV file name"
                          className="h-9 w-full rounded-sm border border-line-strong bg-field px-2 text-sm text-fg transition-[border-color,box-shadow] duration-200 focus:border-brand focus:shadow-[0_0_0_3px_var(--c-brand-wash)] focus:outline-none"
                        />
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className={limitNote ? "text-bad-fg" : "text-muted"}>
                            {limitNote
                              ? `Maximum ${CSV_NAME_MAX} characters allowed. You cannot type more.`
                              : "Any language, numbers, emoji and symbols are allowed."}
                          </span>
                          <span
                            className={`shrink-0 tabular-nums ${limitNote ? "text-bad-fg" : "text-muted"}`}
                          >
                            {charLength(draft)}/{CSV_NAME_MAX}
                          </span>
                        </div>
                      </div>
                    ) : (
                      row.file_name
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {editingId === row.id ? (
                        <>
                          <Button size="sm" variant="primary" disabled={savingName} onClick={() => saveName(row)}>
                            {savingName ? "..." : "Save"}
                          </Button>
                          <Button size="sm" disabled={savingName} onClick={cancelEdit}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" disabled={busyId === row.id} onClick={() => handleDownload(row)}>
                            {busyId === row.id ? (
                              "..."
                            ) : (
                              <>
                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" />
                                  <path d="M5 16.5v2A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-2" />
                                </svg>
                                Download
                              </>
                            )}
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => setToDelete(row)}>
                            Delete
                          </Button>
                          <button
                            type="button"
                            onClick={() => startEdit(row)}
                            aria-label="Rename CSV file"
                            title="Rename"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line-strong bg-field text-fg transition-[border-color,transform] duration-200 hover:border-brand active:scale-95"
                          >
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete CSV permanently?"
        message={
          toDelete
            ? `"${toDelete.file_name}" (${formatDateTime(toDelete.created_at)}) will be deleted from the database for good. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete forever"
        danger
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
