import { CSV_NAME_MAX } from "@/lib/constants";

/** Characters as a person counts them (an emoji is 1, like Postgres char_length). */
export function charLength(text: string): number {
  return Array.from(text).length;
}

/** Cut to at most `max` characters without splitting an emoji. */
export function clampName(text: string, max: number = CSV_NAME_MAX): string {
  const chars = Array.from(text);
  return chars.length <= max ? text : chars.slice(0, max).join("");
}

/** Text typed by the user -> stored name (trimmed, no line breaks). Empty = invalid. */
export function cleanName(text: string): string {
  return clampName(text.replace(/[\r\n\t]+/g, " ").trim());
}

/** Name used for the downloaded file: always ends with .csv. */
export function downloadName(name: string): string {
  return /\.csv$/i.test(name) ? name : `${name}.csv`;
}
