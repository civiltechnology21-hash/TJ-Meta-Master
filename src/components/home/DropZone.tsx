"use client";

import { useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { filesFromDataTransfer, filesFromInput } from "@/features/ingest/scanEntries";
import { FILE_INPUT_ACCEPT } from "@/lib/constants";
import { useFilesStore } from "@/store/filesStore";

/** Wraps the Home panel: drop files or whole folders anywhere inside it. */
export function DropZone({ children }: { children: ReactNode }) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0); // dragenter/leave fire for every child element

  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

  const onDragEnter = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth.current++;
    setDragging(true);
  };
  const onDragOver = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
  const onDragLeave = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setDragging(false);
  };
  const onDrop = async (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth.current = 0;
    setDragging(false);

    const { setScanning, addFiles } = useFilesStore.getState();
    setScanning(true);
    try {
      addFiles(await filesFromDataTransfer(e.dataTransfer));
    } finally {
      setScanning(false);
    }
  };

  return (
    <div
      className="relative"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {children}
      {dragging ? (
        <div className="animate-fade pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-brand bg-brand-wash text-lg font-semibold text-brand backdrop-blur-[2px]">
          Drop files or folders here
        </div>
      ) : null}
    </div>
  );
}

/** What the empty drop area shows: two sheets of paper drifting, and a short invitation. */
export function DropPrompt() {
  const sheet = (tilt: string, delay: string): CSSProperties =>
    ({ "--tilt": tilt, animationDelay: delay }) as CSSProperties;

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="relative mb-4 h-[62px] w-[66px]" aria-hidden="true">
        <div
          className="animate-float absolute left-[9px] top-[5px] h-[43px] w-[34px] rounded-[7px] border border-brand/40 bg-brand-wash opacity-60"
          style={sheet("-9deg", "0s")}
        />
        <div
          className="animate-float absolute left-6 top-[9px] grid h-[43px] w-[34px] place-items-center rounded-[7px] border border-brand/50 bg-panel-2 text-brand"
          style={sheet("7deg", "-2.2s")}
        >
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 16V5M7.5 9.5 12 5l4.5 4.5" />
            <path d="M5 15.5v3A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-3" />
          </svg>
        </div>
      </div>
      <p className="font-display text-sm font-bold tracking-tight">Drop your assets here</p>
      <p className="mt-1.5 max-w-64 text-xs text-muted">
        Drag and drop files or a folder to get started.
      </p>
      <p className="mt-5 text-[10px] uppercase tracking-[0.08em] text-muted-2">
        or select from your device
      </p>
    </div>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

/** "Select Files" + "Select Folder" buttons (hidden file inputs behind them). */
export function PickerButtons() {
  const filesInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const handle = (input: HTMLInputElement) => {
    const picked = filesFromInput(input.files);
    input.value = ""; // allow picking the same files again later
    if (picked.length > 0) useFilesStore.getState().addFiles(picked);
  };

  return (
    <div className="flex flex-wrap gap-2.5">
      <input
        ref={filesInput}
        type="file"
        multiple
        accept={FILE_INPUT_ACCEPT}
        className="hidden"
        onChange={(e) => handle(e.currentTarget)}
      />
      <input
        ref={folderInput}
        type="file"
        multiple
        className="hidden"
        // folder picker (non-standard attribute, supported by all major browsers)
        {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
        onChange={(e) => handle(e.currentTarget)}
      />
      <Button onClick={() => filesInput.current?.click()}>
        <FileIcon /> Select Files
      </Button>
      <Button onClick={() => folderInput.current?.click()}>
        <FolderIcon /> Select Folder
      </Button>
    </div>
  );
}
