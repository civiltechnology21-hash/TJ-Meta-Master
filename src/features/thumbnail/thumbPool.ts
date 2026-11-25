import { PREVIEW } from "@/lib/constants";
import type { MediaKind } from "@/types/files";
import { makeAiPreviews } from "./aiThumb";
import { makeEpsPreviews } from "./epsThumb";
import { makeImagePreviews } from "./imageThumb";
import { makeSvgPreviews } from "./svgThumb";
import { makeVideoPreviews } from "./videoThumb";

export interface PreviewResult {
  /** Blobs sent to Gemini (1 image, or 1-3 video frames). */
  ai: Blob[];
  /** Small thumbnail for the grid. */
  grid: Blob;
}

const JOB_TIMEOUT_MS = 90_000;

/* ------------------------------ worker pool ------------------------------- */

const idleWorkers: Worker[] = [];

function acquireWorker(): Worker | null {
  const idle = idleWorkers.pop();
  if (idle) return idle;
  try {
    return new Worker(new URL("./thumb.worker.ts", import.meta.url), { type: "module" });
  } catch {
    return null;
  }
}

function runImage(file: File): Promise<PreviewResult> {
  const toResult = (r: { ai: Blob; grid: Blob }): PreviewResult => ({
    ai: [r.ai],
    grid: r.grid,
  });

  const worker = acquireWorker();
  if (!worker) return makeImagePreviews(file).then(toResult);

  return new Promise<PreviewResult>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      worker.onmessage = null;
      worker.onerror = null;
    };
    const timer = setTimeout(() => {
      cleanup();
      worker.terminate();
      reject(new Error("Preview timed out."));
    }, JOB_TIMEOUT_MS);

    worker.onmessage = (event: MessageEvent) => {
      cleanup();
      idleWorkers.push(worker);
      const data = event.data as { ok: boolean; ai?: Blob; grid?: Blob; error?: string };
      if (data.ok && data.ai && data.grid) resolve(toResult({ ai: data.ai, grid: data.grid }));
      else reject(new Error(data.error ?? "Could not read this image."));
    };
    worker.onerror = () => {
      // Worker could not start: do the job on the main thread instead.
      cleanup();
      worker.terminate();
      makeImagePreviews(file).then(toResult).then(resolve, reject);
    };
    worker.postMessage({ file });
  });
}

function runJob(file: File, kind: MediaKind): Promise<PreviewResult> {
  if (kind === "image") return runImage(file);
  const task =
    kind === "video"
      ? makeVideoPreviews(file)
      : kind === "svg"
        ? makeSvgPreviews(file)
        : kind === "ai"
          ? makeAiPreviews(file)
          : makeEpsPreviews(file);
  return Promise.race([
    task,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Preview timed out.")), JOB_TIMEOUT_MS),
    ),
  ]);
}

/* -------------------------------- job queue ------------------------------- */

interface Job {
  file: File;
  kind: MediaKind;
  resolve: (result: PreviewResult) => void;
  reject: (error: unknown) => void;
}

const queue: Job[] = [];
let active = 0;

function pump(): void {
  while (active < PREVIEW.concurrency && queue.length > 0) {
    const job = queue.shift()!;
    active++;
    runJob(job.file, job.kind)
      .then(job.resolve, job.reject)
      .finally(() => {
        active--;
        pump();
      });
  }
}

/** Queue a preview. Only `PREVIEW.concurrency` run at the same time. */
export function requestPreview(file: File, kind: MediaKind): Promise<PreviewResult> {
  return new Promise((resolve, reject) => {
    queue.push({ file, kind, resolve, reject });
    pump();
  });
}

/** Drop everything that has not started yet (used by "Clear"). */
export function cancelAllPreviews(): void {
  const waiting = queue.splice(0);
  for (const job of waiting) job.reject(new DOMException("Cancelled", "AbortError"));
}
