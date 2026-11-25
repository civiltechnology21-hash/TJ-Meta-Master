import { z } from "zod";
import { AiError } from "./errors";

/** JSON shape Gemini must answer with (Gemini "responseSchema" format). */
export function buildResponseSchema(
  withDescription: boolean,
  opts: { withTitle?: boolean; withCategories?: boolean } = {},
) {
  const withTitle = opts.withTitle ?? true;
  const withCategories = opts.withCategories ?? false;
  const properties: Record<string, unknown> = {
    id: { type: "INTEGER" },
    ...(withTitle ? { title: { type: "STRING" } } : {}),
    ...(withDescription ? { description: { type: "STRING" } } : {}),
    keywords: { type: "ARRAY", items: { type: "STRING" } },
    ...(withCategories ? { categories: { type: "ARRAY", items: { type: "STRING" } } } : {}),
  };
  const order = [
    "id",
    ...(withTitle ? ["title"] : []),
    ...(withDescription ? ["description"] : []),
    "keywords",
    ...(withCategories ? ["categories"] : []),
  ];
  return {
    type: "ARRAY",
    items: { type: "OBJECT", properties, required: order, propertyOrdering: order },
  };
}

export interface RawEntry {
  id: number;
  title: string;
  description: string;
  keywords: string[] | string;
  categories?: string[] | string;
}

const entrySchema = z.object({
  id: z.coerce.number().int(),
  title: z.string().default(""),
  description: z.string().default(""),
  keywords: z.union([z.array(z.string()), z.string()]).default([]),
  categories: z.union([z.array(z.string()), z.string()]).default([]),
});

/** Parses Gemini's text answer. Tolerates ```json fences and wrapper objects. */
export function parseModelText(text: string): Map<number, RawEntry> {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  let data: unknown;
  try {
    data = JSON.parse(cleaned);
  } catch {
    throw new AiError("BAD_RESPONSE", "Gemini returned an answer that is not valid JSON.", {
      retriable: true,
    });
  }

  let list: unknown[] = [];
  if (Array.isArray(data)) {
    list = data;
  } else if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const inner = o.files ?? o.items ?? o.results ?? o.metadata;
    if (Array.isArray(inner)) list = inner;
    else if ("title" in o || "keywords" in o) list = [{ id: 1, ...o }];
  }

  const entries = new Map<number, RawEntry>();
  for (const item of list) {
    const parsed = entrySchema.safeParse(item);
    if (parsed.success) entries.set(parsed.data.id, parsed.data);
  }

  if (entries.size === 0) {
    throw new AiError("BAD_RESPONSE", "Gemini's answer had no usable results.", {
      retriable: true,
    });
  }
  return entries;
}
