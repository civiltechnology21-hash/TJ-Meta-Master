import { makeImagePreviews } from "./imageThumb";

/** Decodes + shrinks one image per message, off the main thread. */
const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (event: MessageEvent<{ file: File }>) => {
  try {
    const { ai, grid } = await makeImagePreviews(event.data.file);
    ctx.postMessage({ ok: true, ai, grid });
  } catch (error) {
    ctx.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : "Could not read this image.",
    });
  }
};
