import { AI } from "@/lib/constants";
import type { MediaKind } from "@/types/files";
import type { UserConstraints } from "@/types/metadata";
import { AiError, classifyHttpError, isAbortError, toAiError } from "./errors";
import { buildCorrectionNote } from "@/features/negative/promptSection";
import type { NegativePolicy } from "@/types/negative";
import { getMarketplace } from "./marketplaces";
import { buildIntro, describeFile } from "./prompt";
import { buildResponseSchema, parseModelText, type RawEntry } from "./schema";

/**
 * Talks to the Gemini REST API straight from the browser: the preview images go
 * browser -> Google, so no server bandwidth is used.
 */

export interface GenerateItem {
  /** 1..n inside this request. */
  id: number;
  kind: MediaKind;
  previews: Blob[];
  /** Banned wording found in this file's previous answer (retry only). */
  avoid?: string[];
}

export interface GenerateArgs {
  apiKey: string;
  model: string;
  items: GenerateItem[];
  constraints: UserConstraints;
  /** Marketplace id (decides the rules). */
  marketplace?: string;
  /** Negative Prompt rules of this batch. Absent / null = feature off, request unchanged. */
  negative?: NegativePolicy | null;
  signal?: AbortSignal;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the preview."));
    reader.readAsDataURL(blob);
  });
}

/** fetch() with a timeout that also respects the caller's abort signal. */
async function fetchJson(
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, AI.requestTimeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  if (signal?.aborted) controller.abort();

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) {
      throw new AiError("NETWORK", "Gemini took too long to answer.", {
        retriable: true,
        transient: true,
      });
    }
    if (isAbortError(error)) throw new AiError("ABORTED", "Cancelled.");
    throw toAiError(error);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

async function ensureOk(response: Response): Promise<void> {
  if (response.ok) return;
  const text = await response.text().catch(() => "");
  throw classifyHttpError(response.status, text, response.headers.get("retry-after"));
}

/* -------------------------------- models ---------------------------------- */

/** Model ids that support generateContent for this key (without the "models/" prefix). */
export async function listModels(apiKey: string, signal?: AbortSignal): Promise<string[]> {
  const names: string[] = [];
  let pageToken = "";
  for (let page = 0; page < 5; page++) {
    const url =
      `${AI.endpoint}/models?pageSize=200` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");
    const response = await fetchJson(url, { headers: { "x-goog-api-key": apiKey } }, signal);
    await ensureOk(response);
    const data = (await response.json()) as {
      models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
      nextPageToken?: string;
    };
    for (const m of data.models ?? []) {
      if (m.name && (m.supportedGenerationMethods ?? []).includes("generateContent")) {
        names.push(m.name.replace(/^models\//, ""));
      }
    }
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return names;
}

/** Preferred models that really exist for this key, best first. */
export function pickModels(available: readonly string[] | null): string[] {
  const preferred = [...AI.modelPreference];
  if (!available) return preferred;

  const have = new Set(available);
  const found = preferred.filter((m) => have.has(m));
  if (found.length > 0) return found;

  // None of our known names exist (Google renamed them): use any Flash text model.
  const generic = available.filter(
    (n) =>
      /flash/.test(n) &&
      !/(image|tts|live|audio|embedding|robotics|computer|thinking|exp)/.test(n),
  );
  return generic.length > 0 ? generic.slice(0, 3) : preferred;
}

/** Used by Settings: is this key accepted by Google? */
export async function testApiKey(
  apiKey: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await listModels(apiKey);
    return { ok: true };
  } catch (error) {
    const err = toAiError(error);
    if (err.code === "INVALID_KEY") {
      return { ok: false, message: "Google rejected this key. Check that you copied the whole key." };
    }
    return { ok: false, message: `Could not check the key: ${err.message}` };
  }
}

/** One row of the "Check models" report in Settings. */
export interface ModelCheck {
  model: string;
  ok: boolean;
  /** HTTP status (0 = no answer / network problem). */
  status: number;
  /** Google's own message (or our timing note when ok). */
  message: string;
  ms: number;
}

/**
 * Sends one tiny text request (no image) to each model we would use and reports
 * exactly what Google answered. Costs ~1 request per model.
 */
export async function diagnoseModels(apiKey: string): Promise<ModelCheck[]> {
  let available: string[] | null = null;
  try {
    available = await listModels(apiKey);
  } catch (error) {
    const err = toAiError(error);
    return [{ model: "(model list)", ok: false, status: 0, message: err.message, ms: 0 }];
  }

  const results: ModelCheck[] = [];
  for (const model of pickModels(available)) {
    const started = Date.now();
    try {
      const response = await fetchJson(
        `${AI.endpoint}/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "Reply with the single word OK." }] }],
            generationConfig: { maxOutputTokens: 64 },
          }),
        },
      );
      const ms = Date.now() - started;
      if (response.ok) {
        results.push({ model, ok: true, status: response.status, message: "Works", ms });
      } else {
        const text = await response.text().catch(() => "");
        let message = text.slice(0, 300);
        try {
          message = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? message;
        } catch {
          /* keep raw text */
        }
        results.push({ model, ok: false, status: response.status, message: message.slice(0, 300), ms });
      }
    } catch (error) {
      const err = toAiError(error);
      results.push({ model, ok: false, status: 0, message: err.message, ms: Date.now() - started });
    }
  }
  return results;
}

/* ------------------------------- generation ------------------------------- */

type Part =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

interface GenerateResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

/** Smallest "thinking" setting each Gemini generation accepts (big speed-up, same quality here). */
export function thinkingConfigFor(model: string): Record<string, unknown> | undefined {
  if (/gemini-3/.test(model)) return { thinkingLevel: "minimal" };
  if (/gemini-2\.5-(flash|flash-lite)/.test(model)) return { thinkingBudget: 0 };
  return undefined;
}

/** One request = metadata for up to `AI.batchSize` files. Returns entries by item id. */
export async function generateBatch(args: GenerateArgs): Promise<Map<number, RawEntry>> {
  const { apiKey, model, items, constraints, signal, marketplace, negative } = args;
  if (!apiKey) throw new AiError("NO_API_KEY", "Add your Gemini API key in Settings.", { fatal: true });

  const parts: Part[] = [{ text: buildIntro(items.length) }];
  for (const item of items) {
    parts.push({ text: describeFile(item.id, item.kind, item.previews.length) });
    if (item.avoid && item.avoid.length > 0) {
      parts.push({ text: buildCorrectionNote(item.id, item.avoid) });
    }
    for (const blob of item.previews) {
      parts.push({ inlineData: { mimeType: blob.type || "image/jpeg", data: await blobToBase64(blob) } });
    }
  }

  const rules = getMarketplace(marketplace).rules;
  const response = await fetchJson(
    `${AI.endpoint}/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: getMarketplace(marketplace).buildInstruction(constraints, negative) }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.4,
          // Metadata is a simple visual task: "thinking" only adds minutes. Turn it to the minimum.
          thinkingConfig: thinkingConfigFor(model),
          responseSchema: buildResponseSchema(constraints.descriptionLimit > 0, {
            withTitle: rules.hasTitle,
            withCategories: Boolean(rules.categories),
          }),
        },
      }),
    },
    signal,
  );
  await ensureOk(response);

  const data = (await response.json()) as GenerateResponse;

  if (data.promptFeedback?.blockReason) {
    throw new AiError("BLOCKED", `Blocked by Gemini (${data.promptFeedback.blockReason}).`);
  }
  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .filter((p) => typeof p.text === "string" && !p.thought)
    .map((p) => p.text)
    .join("");

  if (!text) {
    const reason = candidate?.finishReason;
    if (reason === "SAFETY" || reason === "PROHIBITED_CONTENT" || reason === "IMAGE_SAFETY") {
      throw new AiError("BLOCKED", `Blocked by Gemini (${reason}).`);
    }
    throw new AiError("BAD_RESPONSE", "Gemini returned an empty answer.", { retriable: true });
  }
  return parseModelText(text);
}
