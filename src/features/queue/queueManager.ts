import { AiError, toAiError } from "@/features/ai/errors";
import { generateBatch, listModels, pickModels } from "@/features/ai/geminiClient";
import { RateLimiter } from "@/features/ai/rateLimiter";
import { getMarketplace } from "@/features/ai/marketplaces";
import { normalizeMeta } from "@/features/metadata/normalizer";
import { describeViolations, findNegativeViolations, violationTerms } from "@/features/negative/matcher";
import type { NegativePolicy } from "@/types/negative";
import { validateMeta } from "@/features/metadata/validator";
import { AI } from "@/lib/constants";
import { isAbortError, sleep } from "@/lib/utils";
import type { BatchItem, BatchStatus, ItemError } from "@/types/batch";
import type { UserConstraints } from "@/types/metadata";

/** Why a batch is paused (shown to the user with a "Resume" button). */
export type PauseReason = "key" | "quota" | "model" | "rate";
export interface PauseInfo {
  reason: PauseReason;
  message: string;
}

export interface RunnerHooks {
  getItems: () => BatchItem[];
  updateItem: (id: string, patch: Partial<BatchItem>) => void;
  setStatus: (status: BatchStatus, pause?: PauseInfo | null) => void;
  getApiKey: () => string;
  /** Marketplace id chosen when the batch started (decides the rules). */
  getMarketplace?: () => string;
  /** Negative Prompt rules frozen when the batch started. null / missing = feature off. */
  getNegativePolicy?: () => NegativePolicy | null;
  /** Short live message under the progress bar ("Gemini is busy, retrying in 8s"). */
  setNote?: (note: string | null) => void;
}

export interface RunnerDeps {
  generate: typeof generateBatch;
  listModels: typeof listModels;
  sleep: typeof sleep;
  limiter: RateLimiter;
}

type State = "idle" | "running" | "paused" | "finished" | "aborted";

const MAX_RATE_LIMIT_STREAK = 8;
/** Busy/offline answers in a row (no success between) before the batch pauses. */
const MAX_TRANSIENT_STREAK = 8;
/** Busy answers in a row on one model before trying the next model. */
const BUSY_BEFORE_MODEL_SWITCH = 2;

/**
 * Runs one batch:
 *  - groups files (up to AI.batchSize per request) to save requests,
 *  - never exceeds the per-minute limit,
 *  - waits and retries on rate limits, pauses on key/quota problems,
 *  - retries a failed group file-by-file, then marks a file Failed after maxAttempts.
 */
export class BatchRunner {
  private queue: string[] = [];
  /** Files that must be sent alone (after a group failed, or a manual Retry). */
  private solo = new Set<string>();
  private active = 0;
  private state: State = "idle";
  private controller = new AbortController();
  private models: string[] = [];
  private modelIndex = 0;
  private modelsPromise: Promise<void> | null = null;
  private rateLimitStreak = 0;
  private transientStreak = 0;
  private readonly deps: RunnerDeps;

  constructor(
    private readonly hooks: RunnerHooks,
    private readonly constraints: UserConstraints,
    deps: Partial<RunnerDeps> = {},
  ) {
    this.deps = {
      generate: deps.generate ?? generateBatch,
      listModels: deps.listModels ?? listModels,
      sleep: deps.sleep ?? sleep,
      limiter: deps.limiter ?? new RateLimiter(AI.maxRequestsPerMinute),
    };
  }

  /* ------------------------------ public API ------------------------------ */

  start(): void {
    this.queue = this.hooks
      .getItems()
      .filter((i) => i.status === "pending")
      .map((i) => i.id);
    this.begin();
  }

  /** Stop everything immediately (red button). */
  abort(): void {
    if (this.state === "aborted") return;
    this.state = "aborted";
    this.controller.abort();
    this.queue = [];
    for (const item of this.hooks.getItems()) {
      if (item.status === "pending" || item.status === "processing") {
        this.hooks.updateItem(item.id, { status: "cancelled" });
      }
    }
    this.hooks.setStatus("aborted", null);
  }

  /** After a pause (e.g. new API key saved): continue with the files that are left. */
  resume(): void {
    if (this.state !== "paused") return;
    this.deps.limiter.reset();
    this.models = [];
    this.modelIndex = 0;
    this.modelsPromise = null;
    this.rateLimitStreak = 0;
    this.transientStreak = 0;
    this.begin();
  }

  /** Try one failed (or cancelled) file again - only that file. */
  retry(id: string): void {
    const item = this.hooks.getItems().find((i) => i.id === id);
    if (!item || (item.status !== "failed" && item.status !== "cancelled")) return;
    if (item.previews.length === 0) return; // preview never existed: nothing to send

    this.hooks.updateItem(id, { status: "pending", error: undefined, attempts: 0 });
    this.solo.add(id);
    this.queue.push(id);

    if (this.state === "aborted" || this.state === "finished" || this.state === "idle") {
      if (this.controller.signal.aborted) this.controller = new AbortController();
      this.begin();
    } else if (this.state === "running") {
      this.spawn();
    }
    // paused: it will be picked up on resume()
  }

  /* ------------------------------- internals ------------------------------ */

  private begin(): void {
    this.state = "running";
    this.hooks.setStatus("running", null);
    this.spawn();
  }

  private spawn(): void {
    while (this.state === "running" && this.active < AI.concurrency && this.queue.length > 0) {
      this.active++;
      void this.worker().finally(() => {
        this.active--;
        this.afterWorker();
      });
    }
    if (this.state === "running" && this.active === 0 && this.queue.length === 0) this.finish();
  }

  private afterWorker(): void {
    if (this.state !== "running") return;
    if (this.queue.length > 0) this.spawn();
    else if (this.active === 0) this.finish();
  }

  private finish(): void {
    if (this.state !== "running") return;
    this.state = "finished";
    this.hooks.setStatus("done", null);
  }

  private pause(reason: PauseReason, message: string): void {
    if (this.state !== "running") return;
    this.state = "paused";
    this.hooks.setStatus("paused", { reason, message });
  }

  private async worker(): Promise<void> {
    await this.ensureModels();
    while (this.state === "running") {
      const group = this.takeGroup();
      if (group.length === 0) return;
      await this.processGroup(group);
    }
  }

  /** Ask Google which models this key can use (once per run). */
  private ensureModels(): Promise<void> {
    if (!this.modelsPromise) {
      this.modelsPromise = (async () => {
        const key = this.hooks.getApiKey();
        if (!key) {
          this.pause("key", "Add your Gemini API key in Settings, then press Resume.");
          return;
        }
        try {
          const available = await this.deps.listModels(key, this.controller.signal);
          this.models = pickModels(available);
        } catch (error) {
          const err = toAiError(error);
          if (err.code === "ABORTED") return;
          if (err.code === "INVALID_KEY") {
            this.pause("key", err.message);
            return;
          }
          this.models = pickModels(null); // could not list: try our preferred names anyway
        }
      })();
    }
    return this.modelsPromise;
  }

  private takeGroup(): string[] {
    const byId = new Map(this.hooks.getItems().map((i) => [i.id, i]));
    const isReady = (id: string) => byId.get(id)?.status === "pending";

    let first: string | undefined;
    while ((first = this.queue.shift()) !== undefined) {
      if (isReady(first)) break;
    }
    if (first === undefined) return [];
    if (this.solo.has(first)) return [first];

    const group = [first];
    for (let i = 0; i < this.queue.length && group.length < AI.batchSize; ) {
      const id = this.queue[i]!;
      if (!isReady(id)) {
        this.queue.splice(i, 1);
      } else if (this.solo.has(id)) {
        i++;
      } else {
        group.push(id);
        this.queue.splice(i, 1);
      }
    }
    return group;
  }

  private currentModel(): string | null {
    return this.models[this.modelIndex] ?? null;
  }

  private requeueFront(ids: string[]): void {
    for (const id of ids) this.hooks.updateItem(id, { status: "pending" });
    this.queue.unshift(...ids);
  }

  private async processGroup(ids: string[]): Promise<void> {
    const byId = new Map(this.hooks.getItems().map((i) => [i.id, i]));
    const items = ids.map((id) => byId.get(id)).filter((i): i is BatchItem => Boolean(i));
    if (items.length === 0) return;

    try {
      // Files stay "Waiting" until their request really starts.
      await this.deps.limiter.acquire(this.controller.signal);
      if (this.state !== "running") {
        this.requeueFront(ids);
        return;
      }
      for (const item of items) this.hooks.updateItem(item.id, { status: "processing" });
      const model = this.currentModel();
      if (!model) {
        this.requeueFront(ids);
        this.pause("model", "No usable Gemini model was found for this API key.");
        return;
      }

      const negative = this.hooks.getNegativePolicy?.() ?? null;
      const entries = await this.deps.generate({
        apiKey: this.hooks.getApiKey(),
        model,
        items: items.map((item, index) => ({
          id: index + 1,
          kind: item.kind,
          previews: item.previews,
          ...(item.avoid && item.avoid.length > 0 ? { avoid: item.avoid } : {}),
        })),
        constraints: this.constraints,
        marketplace: this.hooks.getMarketplace?.(),
        ...(negative ? { negative } : {}),
        signal: this.controller.signal,
      });
      this.rateLimitStreak = 0;
      this.transientStreak = 0;
      this.hooks.setNote?.(null);

      items.forEach((item, index) => {
        const raw = entries.get(index + 1);
        if (!raw) {
          this.failOrRetry(
            item,
            new AiError("BAD_RESPONSE", "Gemini skipped this file.", { retriable: true }),
          );
          return;
        }
        const rules = getMarketplace(this.hooks.getMarketplace?.()).rules;
        const meta = normalizeMeta(raw, this.constraints, rules);
        const check = validateMeta(meta, this.constraints, rules);
        if (!check.ok) {
          this.failOrRetry(
            item,
            new AiError("VALIDATION", check.issues.join(" "), { retriable: true }),
          );
          return;
        }
        // Negative Prompt (only when the user typed something): a result that still contains
        // banned wording is never accepted. Only THIS file is generated again, alone.
        if (negative) {
          const hits = findNegativeViolations(meta, negative);
          if (hits.length > 0) {
            const avoid = [...new Set([...(item.avoid ?? []), ...violationTerms(hits)])].slice(0, 15);
            this.failOrRetry(
              item,
              new AiError("NEGATIVE_POLICY", describeViolations(hits), { retriable: true }),
              { avoid },
            );
            return;
          }
        }
        this.hooks.updateItem(item.id, {
          status: "success",
          meta,
          error: undefined,
          attempts: item.attempts + 1,
          previews: [], // free memory: not needed any more
          ...(item.avoid ? { avoid: undefined } : {}),
        });
      });
    } catch (error) {
      if (isAbortError(error) || this.state === "aborted") return;
      await this.handleError(toAiError(error), items);
    }
  }

  private async handleError(err: AiError, items: BatchItem[]): Promise<void> {
    const ids = items.map((i) => i.id);
    if (err.code === "ABORTED" || this.state === "aborted") return;

    // This model is not usable (not found / no free quota): move to the next one.
    if (err.modelUnavailable) {
      console.warn(`[TJ Meta] model "${this.currentModel()}" unusable: ${err.message}`);
      this.modelIndex++;
      this.requeueFront(ids);
      if (!this.currentModel()) {
        const daily = err.code === "QUOTA_EXHAUSTED";
        this.pause(
          daily ? "quota" : "model",
          (daily
            ? "Daily Gemini quota is finished on all models. Replace the API key in Settings (or wait for tomorrow), then press Resume."
            : "None of the Gemini models are available for this key. Try another key, then press Resume.") +
            ` Google said: ${err.message.slice(0, 220)}`,
        );
      }
      return;
    }

    // Key invalid / daily quota finished: stop the whole batch, keep the files.
    if (err.fatal) {
      this.requeueFront(ids);
      this.pause(err.code === "QUOTA_EXHAUSTED" ? "quota" : "key", err.message);
      return;
    }

    // Google busy (503) / timeout / offline: the files are fine. Send the SAME group again
    // after a pause - never split it (splitting multiplies requests and burns the quota).
    if (err.transient) {
      this.transientStreak++;
      console.warn(`[TJ Meta] "${this.currentModel()}" busy/unreachable (#${this.transientStreak}): ${err.message}`);
      this.requeueFront(ids);
      if (this.transientStreak > MAX_TRANSIENT_STREAK) {
        this.hooks.setNote?.(null);
        this.pause(
          "rate",
          `Gemini is busy or unreachable right now. Wait a few minutes, then press Resume. Google said: ${err.message.slice(0, 200)}`,
        );
        return;
      }
      if (
        this.transientStreak % BUSY_BEFORE_MODEL_SWITCH === 0 &&
        this.modelIndex + 1 < this.models.length
      ) {
        this.modelIndex++; // this model is overloaded: try the next one
      }
      const waitMs = Math.min(30_000, 3_000 * 2 ** Math.min(this.transientStreak - 1, 4));
      this.hooks.setNote?.(
        `Gemini problem on ${this.currentModel() ?? "model"}: "${err.message.slice(0, 140)}". Retrying in ${Math.round(waitMs / 1000)}s...`,
      );
      try {
        await this.deps.sleep(waitMs, this.controller.signal);
      } catch {
        /* aborted */
      }
      return;
    }

    // Per-minute limit: wait, then try the same files again (does not count as an attempt).
    if (err.code === "RATE_LIMIT") {
      this.rateLimitStreak++;
      this.deps.limiter.blockFor(err.retryAfterMs ?? 30_000);
      this.hooks.setNote?.(
        `Per-minute limit reached. Waiting ${Math.round((err.retryAfterMs ?? 30_000) / 1000)}s...`,
      );
      this.requeueFront(ids);
      if (this.rateLimitStreak > MAX_RATE_LIMIT_STREAK) {
        this.pause("rate", "Gemini keeps refusing requests (rate limit). Wait a few minutes, then press Resume.");
      }
      return;
    }

    // A whole group failed: send its files one by one (finds the bad file, avoids truncation).
    if (items.length > 1) {
      ids.forEach((id) => this.solo.add(id));
      this.requeueFront(ids);
      if (err.code === "NETWORK" || err.code === "UNKNOWN") await this.backoff(items[0]!.attempts + 1);
      return;
    }

    const item = items[0]!;
    this.failOrRetry(item, err);
    if (item.attempts + 1 < AI.maxAttempts && err.retriable) await this.backoff(item.attempts + 1);
  }

  private failOrRetry(item: BatchItem, err: AiError, extra: Partial<BatchItem> = {}): void {
    const attempts = item.attempts + 1;
    if (err.retriable && attempts < AI.maxAttempts) {
      this.solo.add(item.id);
      this.hooks.updateItem(item.id, { status: "pending", attempts, ...extra });
      this.queue.push(item.id);
      return;
    }
    const error: ItemError = { code: err.code, message: err.message };
    this.hooks.updateItem(item.id, { status: "failed", attempts, error, ...extra });
  }

  private async backoff(attempt: number): Promise<void> {
    const ms = Math.min(30_000, 2_000 * 2 ** (attempt - 1)) + Math.random() * 500;
    try {
      await this.deps.sleep(ms, this.controller.signal);
    } catch {
      /* aborted */
    }
  }
}
