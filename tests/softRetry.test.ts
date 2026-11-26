import { describe, expect, it } from "vitest";
import { RateLimiter } from "@/features/ai/rateLimiter";
import type { RawEntry } from "@/features/ai/schema";
import { BatchRunner } from "@/features/queue/queueManager";
import type { BatchItem, BatchStatus } from "@/types/batch";

const constraints = { titleLimit: 70, descriptionLimit: 150, keywordCount: 10 };
const KW = ["blue", "sea", "sky", "wave", "water", "sun", "beach", "sand", "cloud", "horizon"];

function run(entries: RawEntry[]) {
  const items: BatchItem[] = [
    { id: "i0", fileId: "f0", fileName: "a.jpg", kind: "image", thumbUrl: null, previews: [new Blob(["x"])], status: "pending", attempts: 0 },
  ];
  let calls = 0;
  const log: BatchStatus[] = [];
  const runner = new BatchRunner(
    {
      getItems: () => items,
      updateItem: (id, patch) => {
        const i = items.findIndex((x) => x.id === id);
        items[i] = { ...items[i]!, ...patch };
      },
      setStatus: (s) => log.push(s),
      getApiKey: () => "key",
      getMarketplace: () => "shutterstock",
    },
    constraints,
    {
      generate: async () => new Map([[1, entries[Math.min(calls++, entries.length - 1)]!]]),
      listModels: async () => ["m"],
      sleep: async () => {},
      limiter: new RateLimiter(1000),
    },
  );
  runner.start();
  const done = () => new Promise<void>((resolve) => {
    const t = setInterval(() => {
      if (log.includes("done")) {
        clearInterval(t);
        resolve();
      }
    }, 5);
  });
  return { items, done, calls: () => calls };
}

const entry = (description: string, categories: string[]): RawEntry => ({
  id: 1,
  title: "",
  description,
  keywords: KW,
  categories,
});

describe("soft rules: one more try, then accept", () => {
  it("clean answer: one request", async () => {
    const t = run([entry("Blue sea under clear sky.", ["Nature"])]);
    await t.done();
    expect(t.items[0]!.status).toBe("success");
    expect(t.calls()).toBe(1);
  });
  it("repeated word once, then fine: second answer is used", async () => {
    const t = run([entry("Blue sea with blue sky.", ["Nature"]), entry("Blue sea under clear sky.", ["Nature"])]);
    await t.done();
    expect(t.items[0]!.status).toBe("success");
    expect(t.items[0]!.meta?.description).toBe("Blue sea under clear sky.");
    expect(t.calls()).toBe(2);
  });
  it("repeated word twice: the second answer is accepted, the file does NOT fail", async () => {
    const t = run([entry("Blue sea with blue sky.", ["Nature"])]);
    await t.done();
    expect(t.items[0]!.status).toBe("success");
    expect(t.items[0]!.meta?.description).toBe("Blue sea with blue sky.");
    expect(t.calls()).toBe(2);
  });
  it("no valid category twice: falls back to Miscellaneous instead of failing", async () => {
    const t = run([entry("Blue sea under clear sky.", ["Nonsense"])]);
    await t.done();
    expect(t.items[0]!.status).toBe("success");
    expect(t.items[0]!.meta?.categories).toEqual(["Miscellaneous"]);
    expect(t.calls()).toBe(2);
  });
});
