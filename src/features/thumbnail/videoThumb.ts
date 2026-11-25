import { PREVIEW } from "@/lib/constants";
import { bitmapToJpeg } from "./imageThumb";

const STEP_TIMEOUT_MS = 20_000;

function waitForEvent(video: HTMLVideoElement, event: string, what: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Video ${what} timed out.`));
    }, STEP_TIMEOUT_MS);
    const onOk = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("This video format/codec is not supported by the browser."));
    };
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener(event, onOk);
      video.removeEventListener("error", onError);
    };
    video.addEventListener(event, onOk, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

async function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  if (Math.abs(video.currentTime - time) < 0.01 && video.readyState >= 2) return;
  const seeked = waitForEvent(video, "seeked", "seek");
  video.currentTime = time;
  await seeked;
}

/**
 * Grabs a few frames (10% / 50% / 90%) from a video file.
 * `ai` = frames for Gemini, `grid` = small thumbnail from the middle frame.
 */
export async function makeVideoPreviews(
  file: File,
): Promise<{ ai: Blob[]; grid: Blob }> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";

  const bitmaps: ImageBitmap[] = [];
  try {
    const metadata = waitForEvent(video, "loadedmetadata", "loading");
    video.src = url;
    await metadata;

    if (!video.videoWidth || !video.videoHeight) {
      throw new Error("No video track found in this file.");
    }
    if (video.readyState < 2) await waitForEvent(video, "loadeddata", "loading");

    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    const lastSafe = Math.max(0, duration - 0.1);
    const times = duration
      ? PREVIEW.videoFramePositions.map((p) => Math.min(lastSafe, p * duration))
      : [0];

    for (const time of times) {
      await seekTo(video, time);
      bitmaps.push(await createImageBitmap(video));
    }

    const ai = await Promise.all(
      bitmaps.map((b) => bitmapToJpeg(b, PREVIEW.videoFrameMaxSide, PREVIEW.aiJpegQuality)),
    );
    const middle = bitmaps[Math.floor(bitmaps.length / 2)]!;
    const grid = await bitmapToJpeg(middle, PREVIEW.gridMaxSide, PREVIEW.gridJpegQuality);
    return { ai, grid };
  } finally {
    bitmaps.forEach((b) => b.close());
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
