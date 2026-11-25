import type { MediaKind } from "./files";
import type { MetaResult, UserConstraints } from "./metadata";

export type ItemStatus =
  | "pending"
  | "processing"
  | "success"
  | "failed"
  | "cancelled";

export type BatchStatus = "idle" | "running" | "paused" | "done" | "aborted";

/** Why a file (or the whole batch) failed. */
export type ErrorCode =
  | "RATE_LIMIT" // per-minute limit: wait and retry automatically
  | "QUOTA_EXHAUSTED" // daily limit: pause the batch, user must replace the key
  | "INVALID_KEY" // key rejected: pause the batch
  | "NO_API_KEY" // no key saved yet
  | "BLOCKED" // Gemini safety block / empty answer for this file
  | "BAD_RESPONSE" // answer was not valid JSON / schema
  | "VALIDATION" // answer broke the length/format rules even after repair
  | "NEGATIVE_POLICY" // answer still used a banned term / copied a negative title after all tries
  | "PREVIEW_FAILED" // local preview could not be created
  | "NETWORK"
  | "ABORTED"
  | "UNKNOWN";

export interface ItemError {
  code: ErrorCode;
  message: string;
}

/** One file inside a running / finished batch (lives in memory only). */
export interface BatchItem {
  id: string;
  fileId: string;
  fileName: string;
  kind: MediaKind;
  /** blob: URL for the result card thumbnail. */
  thumbUrl: string | null;
  /** Previews sent to Gemini. Released when the item succeeds. */
  previews: Blob[];
  status: ItemStatus;
  meta?: MetaResult;
  error?: ItemError;
  attempts: number;
  /** Banned wording found in earlier answers; sent with the retry so it is avoided. */
  avoid?: string[];
}

export interface BatchStats {
  total: number;
  successful: number;
  failed: number;
  /** success + failed + cancelled - used for the "5/10" counter. */
  finished: number;
}

export interface BatchSnapshot {
  id: string;
  status: BatchStatus;
  constraints: UserConstraints;
  startedAt: string;
}

export type CsvExportKind = "single" | "batch";

/** A row of the `csv_exports` table. */
export interface CsvExportRecord {
  id: string;
  user_id: string;
  kind: CsvExportKind;
  file_count: number;
  file_name: string;
  csv_content: string;
  created_at: string;
  updated_at: string;
}
