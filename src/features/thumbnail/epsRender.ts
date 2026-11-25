import { PREVIEW } from "@/lib/constants";

/**
 * Real EPS rendering with Ghostscript (WebAssembly) inside a Web Worker.
 * Used when an EPS has no (or only a tiny) embedded preview.
 */

export interface EpsBox {
  width: number;
  height: number;
}

const BOX_REGEX =
  /%%(HiRes)?BoundingBox:\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)/g;

/** Size (in points) of the EPS drawing, from its %%BoundingBox comment. */
export function parseBoundingBox(text: string): EpsBox | null {
  let hires: EpsBox | null = null;
  let normal: EpsBox | null = null;
  for (const m of text.matchAll(BOX_REGEX)) {
    const [llx, lly, urx, ury] = [m[2], m[3], m[4], m[5]].map(Number) as [
      number,
      number,
      number,
      number,
    ];
    const box = { width: urx - llx, height: ury - lly };
    if (!(box.width > 0 && box.height > 0)) continue; // "(atend)" or empty box
    if (m[1]) hires = box;
    else normal = box;
  }
  return hires ?? normal;
}

/** The comment may be at the end of the file ("%%BoundingBox: (atend)"), so read both ends. */
export async function readBoundingBox(file: Blob): Promise<EpsBox | null> {
  const chunk = 128 * 1024;
  const head = await file.slice(0, chunk).text();
  const fromHead = parseBoundingBox(head);
  if (fromHead || file.size <= chunk) return fromHead;
  const tail = await file.slice(Math.max(0, file.size - chunk)).text();
  return parseBoundingBox(tail);
}

/** Resolution that makes the longest side about `targetSide` pixels. */
export function dpiFor(box: EpsBox | null, targetSide: number = PREVIEW.aiMaxSide): number {
  if (!box) return 96;
  const longest = Math.max(box.width, box.height);
  return Math.min(600, Math.max(8, Math.round((targetSide / longest) * 72)));
}

/* ------------------------- worker (one at a time) ------------------------- */

const WORKER_URL = "/gs/gs-worker.js";
const JOB_TIMEOUT_MS = 80_000;
const JOBS_BEFORE_RESTART = 8; // fresh worker now and then = memory is given back

let worker: Worker | null = null;
let jobsDone = 0;
let queue: Promise<unknown> = Promise.resolve();

function stopWorker(): void {
  worker?.terminate();
  worker = null;
  jobsDone = 0;
}

interface RenderJob {
  /** "eps" (default) or "pdf" (Illustrator .ai). */
  mode: "eps" | "pdf";
  /** eps: resolution. */
  dpi?: number;
  /** pdf: the page is fitted into a square of this many pixels. */
  side?: number;
}

function runJob(file: Blob, job: RenderJob): Promise<Uint8Array> {
  if (!worker) worker = new Worker(WORKER_URL, { type: "module" });
  const w = worker;

  return new Promise<Uint8Array>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      w.onmessage = null;
      w.onerror = null;
    };
    const timer = setTimeout(() => {
      cleanup();
      stopWorker();
      reject(new Error("Rendering took too long."));
    }, JOB_TIMEOUT_MS);

    w.onmessage = (event: MessageEvent) => {
      cleanup();
      if (++jobsDone >= JOBS_BEFORE_RESTART) stopWorker();
      const data = event.data as { ok: boolean; png?: Uint8Array; error?: string };
      if (data.ok && data.png) resolve(data.png);
      else reject(new Error(data.error || "Could not render this file."));
    };
    w.onerror = () => {
      cleanup();
      stopWorker();
      reject(new Error("The renderer could not be loaded (public/gs files missing)."));
    };
    w.postMessage({ file, ...job });
  });
}

/** Render an EPS to PNG bytes. Files are processed one by one to keep memory low. */
export function renderEpsToPng(file: Blob, dpi: number): Promise<Uint8Array> {
  const result = queue.then(() => runJob(file, { mode: "eps", dpi }));
  queue = result.catch(() => undefined);
  return result;
}

/** Render page 1 of a PDF-based file (Illustrator .ai) to PNG bytes, fitted into `side` x `side`. */
export function renderPdfToPng(file: Blob, side: number): Promise<Uint8Array> {
  const result = queue.then(() => runJob(file, { mode: "pdf", side }));
  queue = result.catch(() => undefined);
  return result;
}
