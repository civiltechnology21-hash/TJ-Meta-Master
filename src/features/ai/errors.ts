import type { ErrorCode } from "@/types/batch";

export interface AiErrorOptions {
  /** Worth trying again for this file. */
  retriable?: boolean;
  /** Wait this long before the next request (rate limits). */
  retryAfterMs?: number | null;
  /** Problem with the key / quota: stop the WHOLE batch, not just one file. */
  fatal?: boolean;
  /** This model cannot be used (not found, or no free quota): try the next model. */
  modelUnavailable?: boolean;
  /** Google is busy / unreachable (503, timeout, offline). Retry the SAME request later, do not split it. */
  transient?: boolean;
}

export class AiError extends Error {
  readonly code: ErrorCode;
  readonly retriable: boolean;
  readonly retryAfterMs: number | null;
  readonly fatal: boolean;
  readonly modelUnavailable: boolean;
  readonly transient: boolean;

  constructor(code: ErrorCode, message: string, options: AiErrorOptions = {}) {
    super(message);
    this.name = "AiError";
    this.code = code;
    this.retriable = options.retriable ?? false;
    this.retryAfterMs = options.retryAfterMs ?? null;
    this.fatal = options.fatal ?? false;
    this.modelUnavailable = options.modelUnavailable ?? false;
    this.transient = options.transient ?? false;
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: string }).name === "AbortError"
  );
}

/** Any thrown value -> AiError. */
export function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  if (isAbortError(error)) return new AiError("ABORTED", "Cancelled.");
  if (error instanceof TypeError) {
    // fetch() fails with a TypeError when offline / blocked
    return new AiError("NETWORK", "Network error. Check your internet connection.", {
      retriable: true,
      transient: true,
    });
  }
  return new AiError(
    "UNKNOWN",
    error instanceof Error ? error.message : "Unknown error.",
    { retriable: true },
  );
}

interface GoogleErrorBody {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: Array<Record<string, unknown>>;
  };
}

function parseBody(text: string): GoogleErrorBody["error"] {
  try {
    return (JSON.parse(text) as GoogleErrorBody).error;
  } catch {
    return undefined;
  }
}

/** "37s" / "0.5s" -> ms */
function parseDelay(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const n = parseFloat(value);
  return Number.isFinite(n) ? Math.ceil(n * 1000) : null;
}

function findRetryDelay(details: Array<Record<string, unknown>> | undefined): number | null {
  for (const d of details ?? []) {
    const ms = parseDelay(d.retryDelay);
    if (ms !== null) return ms;
  }
  return null;
}

function quotaIds(details: Array<Record<string, unknown>> | undefined): string {
  const ids: string[] = [];
  for (const d of details ?? []) {
    const violations = d.violations;
    if (Array.isArray(violations)) {
      for (const v of violations as Array<Record<string, unknown>>) {
        if (typeof v.quotaId === "string") ids.push(v.quotaId);
        if (typeof v.quotaMetric === "string") ids.push(v.quotaMetric);
      }
    }
  }
  return ids.join(" ").toLowerCase();
}

/** Turns an HTTP error from the Gemini API into an AiError with the right behaviour. */
export function classifyHttpError(
  status: number,
  bodyText: string,
  retryAfterHeader: string | null,
): AiError {
  const body = parseBody(bodyText);
  const message = body?.message ?? `Request failed (HTTP ${status}).`;
  const lower = message.toLowerCase();

  if (status === 429) {
    const ids = quotaIds(body?.details);
    if (lower.includes("limit: 0")) {
      return new AiError("QUOTA_EXHAUSTED", message, { modelUnavailable: true });
    }
    if (ids.includes("perday") || lower.includes("per day") || lower.includes("daily")) {
      // Daily quota is counted per model: this model is done for today, another may still work.
      return new AiError("QUOTA_EXHAUSTED", message, { modelUnavailable: true });
    }
    const headerMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : NaN;
    const wait = findRetryDelay(body?.details) ?? (Number.isFinite(headerMs) ? headerMs : 30_000);
    return new AiError("RATE_LIMIT", "Per-minute limit reached. Waiting...", {
      retriable: true,
      retryAfterMs: Math.max(5_000, wait) + 1_000,
    });
  }

  if (
    status === 401 ||
    status === 403 ||
    lower.includes("api key not valid") ||
    lower.includes("api_key_invalid")
  ) {
    return new AiError(
      "INVALID_KEY",
      "The Gemini API key was rejected. Replace it in Settings, then press Resume.",
      { fatal: true },
    );
  }

  if (status === 404) {
    return new AiError("UNKNOWN", message, { modelUnavailable: true });
  }

  if (status === 400 && (lower.includes("location") || lower.includes("precondition"))) {
    return new AiError("UNKNOWN", `Gemini is not available for this key/region: ${message}`, {
      fatal: true,
    });
  }

  if (status === 413) {
    return new AiError("BAD_RESPONSE", "Request too large.", { retriable: true });
  }

  if (status === 408 || status >= 500) {
    return new AiError("UNKNOWN", message, { retriable: true, transient: true });
  }

  return new AiError("BAD_RESPONSE", message);
}
