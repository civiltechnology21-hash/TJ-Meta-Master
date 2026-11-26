import { describe, expect, it } from "vitest";
import { AiError } from "@/features/ai/errors";
import { RateLimiter } from "@/features/ai/rateLimiter";
import type { RawEntry } from "@/features/ai/schema";
import { BatchRunner, type PauseInfo } from "@/features/queue/queueManager";
import type { BatchItem, BatchStatus } from "@/types/batch";

const constraints = { titleLimit: 100, descriptionLimit: 200, keywordCount: 6 };

function makeItems(n: number): BatchItem[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `i${i}`,
    fileId: `f${i}`,
    fileName: `file${i}.jpg`,
    kind: "image" as const,
    thumbUrl: null,
    previews: [new Blob(["x"], { type: "image/jpeg" })],
    status: "pending" as const,
    attempts: 0,
  }));
}

const okEntry = (id: number): RawEntry => ({
  id,
  title: "Blue ocean wave under bright sky",
  description: "A blue ocean wave. Bright sky above.",
  keywords: ["ocean", "wave", "blue", "sky", "water", "sea", "extra"],
});

function setup(
  n: number,
  generate: (calls: number, ids: number[], blobs: Blob[], model: string) => Promise<Map<number, RawEntry>>,
  models: string[] = ["gemini-3.5-flash"],
) {
  const items = makeItems(n);
  const log: { status: BatchStatus; pause: PauseInfo | null }[] = [];
  let calls = 0;
  const runner = new BatchRunner(
    {
      getItems: () => items,
      updateItem: (id, patch) => {
        const i = items.findIndex((x) => x.id === id);
        items[i] = { ...items[i]!, ...patch };
      },
      setStatus: (status, pause = null) => log.push({ status, pause }),
      getApiKey: () => "key",
    },
    constraints,
    {
      generate: async (args) =>
        generate(++calls, args.items.map((i) => i.id), args.items.map((i) => i.previews[0]!), args.model),
      listModels: async () => models,
      sleep: async () => {},
      limiter: new RateLimiter(1000),
    },
  );
  const done = () => new Promise<void>((resolve) => {
    const t = setInterval(() => {
      const last = log[log.length - 1];
      if (last && (last.status === "done" || last.status === "paused" || last.status === "aborted")) {
        clearInterval(t);
        resolve();
      }
    }, 5);
  });
  return { items, log, runner, done, calls: () => calls };
}

describe("BatchRunner", () => {
  it("groups files (4 per request) and finishes", async () => {
    const t = setup(10, async (_c, ids) => new Map(ids.map((id) => [id, okEntry(id)])));
    t.runner.start();
    await t.done();
    expect(t.items.every((i) => i.status === "success")).toBe(true);
    expect(t.calls()).toBe(3); // 4 + 4 + 2
    expect(t.items[0]!.meta?.title.endsWith(".")).toBe(true);
    expect(t.items[0]!.meta?.keywords).toHaveLength(6);
    expect(t.items[0]!.previews).toHaveLength(0);
    expect(t.log.at(-1)!.status).toBe("done");
  });

  it("retries after a per-minute rate limit without failing files", async () => {
    const t = setup(3, async (call, ids) => {
      if (call === 1) throw new AiError("RATE_LIMIT", "slow down", { retriable: true, retryAfterMs: 1 });
      return new Map(ids.map((id) => [id, okEntry(id)]));
    });
    t.runner.start();
    await t.done();
    expect(t.items.every((i) => i.status === "success")).toBe(true);
  });

  it("pauses on daily quota, keeps files pending, resumes later", async () => {
    let quota = true;
    const t = setup(3, async (_c, ids) => {
      if (quota) throw new AiError("QUOTA_EXHAUSTED", "daily", { fatal: true });
      return new Map(ids.map((id) => [id, okEntry(id)]));
    });
    t.runner.start();
    await t.done();
    expect(t.log.at(-1)).toMatchObject({ status: "paused", pause: { reason: "quota" } });
    expect(t.items.every((i) => i.status === "pending")).toBe(true);

    quota = false;
    t.log.length = 0;
    t.runner.resume();
    await t.done();
    expect(t.items.every((i) => i.status === "success")).toBe(true);
  });

  it("daily quota of one model -> continues with the next model", async () => {
    const used: string[] = [];
    const t = setup(
      3,
      async (_c, ids, _b, model) => {
        used.push(model);
        if (model === "gemini-3.5-flash") {
          throw new AiError("QUOTA_EXHAUSTED", "daily", { modelUnavailable: true });
        }
        return new Map(ids.map((id) => [id, okEntry(id)]));
      },
      ["gemini-3.5-flash", "gemini-3-flash-preview"],
    );
    t.runner.start();
    await t.done();
    expect(t.items.every((i) => i.status === "success")).toBe(true);
    expect(used).toEqual(["gemini-3.5-flash", "gemini-3-flash-preview"]);
  });

  it("daily quota on every model -> pauses and shows Google's message", async () => {
    const t = setup(
      3,
      async () => {
        throw new AiError("QUOTA_EXHAUSTED", "Quota exceeded: limit 20 per day", { modelUnavailable: true });
      },
      ["gemini-3.5-flash", "gemini-3-flash-preview"],
    );
    t.runner.start();
    await t.done();
    const last = t.log.at(-1)!;
    expect(last.status).toBe("paused");
    expect(last.pause?.reason).toBe("quota");
    expect(last.pause?.message).toContain("limit 20 per day");
    expect(t.items.every((i) => i.status === "pending")).toBe(true);
  });

  it("files stay pending (not processing) while waiting for the rate limiter", async () => {
    const seen: string[][] = [];
    const t = setup(8, async (_c, ids) => {
      seen.push(t.items.filter((i) => i.status === "processing").map((i) => i.id));
      return new Map(ids.map((id) => [id, okEntry(id)]));
    });
    t.runner.start();
    await t.done();
    expect(Math.max(...seen.map((x) => x.length))).toBeLessThanOrEqual(8); // 2 requests x 4 files
  });

  it("503 / busy: resends the SAME group (no splitting), then succeeds", async () => {
    const sizes: number[] = [];
    const t = setup(3, async (call, ids) => {
      sizes.push(ids.length);
      if (call <= 2) throw new AiError("UNKNOWN", "overloaded", { retriable: true, transient: true });
      return new Map(ids.map((id) => [id, okEntry(id)]));
    });
    t.runner.start();
    await t.done();
    expect(sizes).toEqual([3, 3, 3]); // never split into single files
    expect(t.items.every((i) => i.status === "success")).toBe(true);
    expect(t.items.every((i) => i.attempts === 1)).toBe(true); // busy answers are not the file's fault
  });

  it("busy twice on a model -> next model", async () => {
    const used: string[] = [];
    const t = setup(
      3,
      async (_c, ids, _b, model) => {
        used.push(model);
        if (model === "gemini-3.5-flash") throw new AiError("UNKNOWN", "overloaded", { retriable: true, transient: true });
        return new Map(ids.map((id) => [id, okEntry(id)]));
      },
      ["gemini-3.5-flash", "gemini-3-flash-preview"],
    );
    t.runner.start();
    await t.done();
    expect(used).toEqual(["gemini-3.5-flash", "gemini-3.5-flash", "gemini-3-flash-preview"]);
    expect(t.items.every((i) => i.status === "success")).toBe(true);
  });

  it("busy forever -> pauses (files stay pending) instead of failing them", async () => {
    const t = setup(4, async () => {
      throw new AiError("UNKNOWN", "overloaded", { retriable: true, transient: true });
    });
    t.runner.start();
    await t.done();
    expect(t.log.at(-1)).toMatchObject({ status: "paused", pause: { reason: "rate" } });
    expect(t.items.every((i) => i.status === "pending")).toBe(true);
    expect(t.calls()).toBeLessThanOrEqual(10);
  });

  it("splits a failed group into single files and marks only the bad one Failed", async () => {
    const t = setup(4, async (_c, ids, blobs) => {
      if (ids.length > 1) throw new AiError("BAD_RESPONSE", "bad json", { retriable: true });
      return blobs[0]!.size === 3 ? new Map() : new Map([[1, okEntry(1)]]); // size 3 = the bad file
    });
    t.items[2] = { ...t.items[2]!, previews: [new Blob(["bad"], { type: "image/jpeg" })] };
    t.runner.start();
    await t.done();
    const failed = t.items.filter((i) => i.status === "failed");
    expect(failed).toHaveLength(1);
    expect(t.items.filter((i) => i.status === "success")).toHaveLength(3);
  });

  it("retry() reprocesses only the chosen failed file", async () => {
    let badWorks = false;
    let calls = 0;
    const t = setup(2, async (_c, ids, blobs) => {
      calls++;
      if (!badWorks && blobs.some((b) => b.size === 3)) {
        throw new AiError("UNKNOWN", "boom", { retriable: false });
      }
      return new Map(ids.map((id) => [id, okEntry(id)]));
    });
    t.items[0] = { ...t.items[0]!, previews: [new Blob(["bad"], { type: "image/jpeg" })] };
    t.runner.start();
    await t.done();
    // the group failed -> split into single files -> only the bad one stays Failed
    expect(t.items[0]!.status).toBe("failed");
    expect(t.items[1]!.status).toBe("success");

    badWorks = true;
    const callsBefore = calls;
    t.log.length = 0;
    t.runner.retry(t.items[0]!.id);
    await t.done();
    expect(t.items[0]!.status).toBe("success");
    expect(calls).toBe(callsBefore + 1); // only that one file was sent
  });

  it("abort() cancels everything that is left", async () => {
    const t = setup(8, () => new Promise<Map<number, RawEntry>>(() => {})); // never answers
    t.runner.start();
    await new Promise((r) => setTimeout(r, 30));
    t.runner.abort();
    expect(t.items.every((i) => i.status === "cancelled")).toBe(true);
    expect(t.log.at(-1)!.status).toBe("aborted");
  });
});
