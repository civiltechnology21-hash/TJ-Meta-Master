import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { CsvExportKind, CsvExportRecord } from "@/types/batch";

/** The only table the app writes to: `csv_exports`. */

export type CsvListItem = Pick<
  CsvExportRecord,
  "id" | "kind" | "file_count" | "file_name" | "created_at" | "updated_at"
>;

const TABLE = "csv_exports";

export async function insertCsv(input: {
  kind: CsvExportKind;
  fileCount: number;
  fileName: string;
  csvContent: string;
}): Promise<string> {
  const { data, error } = await getSupabaseBrowserClient()
    .from(TABLE)
    .insert({
      kind: input.kind,
      file_count: input.fileCount,
      file_name: input.fileName,
      csv_content: input.csvContent,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not save the CSV.");
  return (data as { id: string }).id;
}

export async function updateCsv(
  id: string,
  input: { fileCount: number; csvContent: string },
): Promise<void> {
  const { error } = await getSupabaseBrowserClient()
    .from(TABLE)
    .update({ file_count: input.fileCount, csv_content: input.csvContent })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Change the file name of a saved CSV (the CSV text stays the same). */
export async function renameCsv(id: string, fileName: string): Promise<void> {
  const { data, error } = await getSupabaseBrowserClient()
    .from(TABLE)
    .update({ file_name: fileName })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Could not rename (file not found).");
}

/** Newest first. Does not download the (large) CSV text. */
export async function listCsv(): Promise<CsvListItem[]> {
  const { data, error } = await getSupabaseBrowserClient()
    .from(TABLE)
    .select("id, kind, file_count, file_name, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CsvListItem[];
}

export async function getCsvContent(id: string): Promise<string> {
  const { data, error } = await getSupabaseBrowserClient()
    .from(TABLE)
    .select("csv_content")
    .eq("id", id)
    .single();
  if (error || !data) throw new Error(error?.message ?? "CSV not found.");
  return (data as { csv_content: string }).csv_content;
}

/** Permanent delete (no soft-delete, no backup). */
export async function deleteCsv(id: string): Promise<void> {
  const { data, error } = await getSupabaseBrowserClient()
    .from(TABLE)
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Nothing was deleted (already removed?).");
}
