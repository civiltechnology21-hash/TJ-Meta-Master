/**
 * Turns a drag-and-drop (files and/or whole folders) into a flat File[].
 * Folders are scanned recursively. Filtering by format happens later.
 */

function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntry[] = [];
    const readBatch = () => {
      // readEntries returns at most ~100 items per call: repeat until empty.
      reader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(all);
          return;
        }
        all.push(...batch);
        readBatch();
      }, reject);
    };
    readBatch();
  });
}

function entryToFile(entry: FileSystemFileEntry): Promise<File | null> {
  return new Promise((resolve) => {
    entry.file(
      (file) => resolve(file),
      () => resolve(null),
    );
  });
}

async function walk(entry: FileSystemEntry, out: File[]): Promise<void> {
  if (entry.isFile) {
    const file = await entryToFile(entry as FileSystemFileEntry);
    if (file) out.push(file);
    return;
  }
  if (entry.isDirectory) {
    const children = await readAllEntries(
      (entry as FileSystemDirectoryEntry).createReader(),
    );
    for (const child of children) await walk(child, out);
  }
}

export async function filesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  // The item list is only valid synchronously, so grab everything first.
  const entries: FileSystemEntry[] = [];
  const direct: File[] = [];

  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind !== "file") continue;
    const entry = item.webkitGetAsEntry?.();
    if (entry) {
      entries.push(entry);
    } else {
      const file = item.getAsFile();
      if (file) direct.push(file);
    }
  }

  // Browsers without the entries API: plain file list (no folder support).
  if (entries.length === 0 && direct.length === 0) {
    return Array.from(dt.files ?? []);
  }

  const out: File[] = [...direct];
  for (const entry of entries) await walk(entry, out);
  return out;
}

/** <input type="file"> result -> File[]. */
export function filesFromInput(list: FileList | null): File[] {
  return list ? Array.from(list) : [];
}
