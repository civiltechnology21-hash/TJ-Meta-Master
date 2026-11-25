import { describe, expect, it } from "vitest";
import { RateLimiter } from "@/features/ai/rateLimiter";

function fakeClock() {
  let t = 0;
  return {
    now: () => t,
    wait: async (ms: number) => {
      t += ms;
    },
    get time() {
      return t;
    },
  };
}

describe("RateLimiter", () => {
  it("allows `max` requests, then waits for the window", async () => {
    const clock = fakeClock();
    const limiter = new RateLimiter(3, 60_000, clock.now, clock.wait);
    for (let i = 0; i < 3; i++) await limiter.acquire();
    expect(clock.time).toBe(0);
    await limiter.acquire(); // 4th must wait ~60s
    expect(clock.time).toBeGreaterThanOrEqual(60_000);
  });
  it("blockFor delays the next request", async () => {
    const clock = fakeClock();
    const limiter = new RateLimiter(10, 60_000, clock.now, clock.wait);
    limiter.blockFor(25_000);
    await limiter.acquire();
    expect(clock.time).toBe(25_000);
  });
  it("rejects when already aborted", async () => {
    const limiter = new RateLimiter(1);
    const c = new AbortController();
    c.abort();
    await expect(limiter.acquire(c.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
});
