// Renders ONE EPS file (or page 1 of a PDF-based .ai file) to a PNG with Ghostscript (WebAssembly), off the main thread.
// gs.js / gs.wasm sit next to this file (copied by scripts/prepare-assets.mjs).
import Module from "./gs.js";

const base = new URL("./", import.meta.url);

self.onmessage = async (event) => {
  const { file, dpi, mode, side } = event.data;
  const isPdf = mode === "pdf";
  const log = [];
  try {
    // A fresh Ghostscript instance per file (it cannot be re-run after it finishes).
    const gs = await Module({
      locateFile: (path) => new URL(path, base).href,
      print: (text) => log.push(String(text)),
      printErr: (text) => log.push(String(text)),
    });

    const input = isPdf ? "/in.pdf" : "/in.eps";
    gs.FS.writeFile(input, new Uint8Array(await file.arrayBuffer()));

    const args = isPdf
      ? [
          "-q",
          "-dNOPAUSE",
          "-dBATCH",
          "-dSAFER",
          "-dFirstPage=1",
          "-dLastPage=1",
          "-dUseCropBox",
          "-dPDFFitPage",
          `-g${side}x${side}`,
          "-sDEVICE=png16m",
          "-dTextAlphaBits=4",
          "-dGraphicsAlphaBits=4",
          "-sOutputFile=/out.png",
          input,
        ]
      : [
          "-q",
          "-dNOPAUSE",
          "-dBATCH",
          "-dSAFER",
          "-dEPSCrop",
          "-sDEVICE=png16m",
          `-r${dpi}`,
          "-dTextAlphaBits=4",
          "-dGraphicsAlphaBits=4",
          "-sOutputFile=/out.png",
          input,
        ];

    try {
      gs.callMain(args);
    } catch (error) {
      // Emscripten throws when the program ends; the output file is what matters.
      if (error && typeof error === "object" && !("status" in error)) log.push(String(error));
    }

    let png = null;
    try {
      png = gs.FS.readFile("/out.png");
    } catch {
      /* no output */
    }
    if (!png || png.length === 0) {
      const reason = log.filter(Boolean).slice(-3).join(" ").trim();
      throw new Error(reason || "Ghostscript produced no image.");
    }
    self.postMessage({ ok: true, png }, [png.buffer]);
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
