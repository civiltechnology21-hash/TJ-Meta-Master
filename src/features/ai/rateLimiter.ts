import { sleep } from "@/lib/utils";

/**
 * Sliding-window limiter: at most `max` requests in any `windowMs`.
 * `blockFor()` adds a pause on top (used when Google says "retry in 37s").
 */
export class RateLimiter {
  private stamps: number[] = [];
  private blockedUntil = 0;

  constructor(
    private readonly max: number,
    private readonly windowMs: number = 60_000,
    private readonly now: () => number = Date.now,
    private readonly wait: (ms: number, signal?: AbortSignal) => Promise<void> = sleep,
  ) {}

  /** Nothing may start for the next `ms` milliseconds. */
  blockFor(ms: number): void {
    this.blockedUntil = Math.max(this.blockedUntil, this.now() + ms);
  }

  reset(): void {
    this.stamps = [];
    this.blockedUntil = 0;
  }

  /** Resolves when a request may start. Rejects with AbortError if `signal` aborts. */
  async acquire(signal?: AbortSignal): Promise<void> {
    for (;;) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

      const t = this.now();
      this.stamps = this.stamps.filter((s) => t - s < this.windowMs);

      let waitMs = 0;
      if (t < this.blockedUntil) {
        waitMs = this.blockedUntil - t;
      } else if (this.stamps.length >= this.max) {
        waitMs = this.windowMs - (t - this.stamps[0]!) + 5;
      }

      if (waitMs <= 0) {
        this.stamps.push(t);
        return;
      }
      await this.wait(waitMs, signal);
    }
  }
}
