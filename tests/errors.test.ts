import { describe, expect, it } from "vitest";
import { AiError, classifyHttpError, toAiError } from "@/features/ai/errors";

const body = (message: string, details: unknown[] = []) =>
  JSON.stringify({ error: { code: 0, message, status: "X", details } });

describe("classifyHttpError", () => {
  it("per-minute 429 -> wait and retry (uses Google's retryDelay)", () => {
    const e = classifyHttpError(
      429,
      body("You exceeded your current quota", [{ "@type": "RetryInfo", retryDelay: "37s" }]),
      null,
    );
    expect(e.code).toBe("RATE_LIMIT");
    expect(e.retriable).toBe(true);
    expect(e.retryAfterMs).toBeGreaterThanOrEqual(37_000);
    expect(e.fatal).toBe(false);
  });
  it("daily 429 -> stop the whole batch", () => {
    const e = classifyHttpError(
      429,
      body("quota", [{ violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }] }]),
      null,
    );
    expect(e.code).toBe("QUOTA_EXHAUSTED");
    expect(e.fatal).toBe(false);
    expect(e.modelUnavailable).toBe(true); // daily quota is per model: try the next one
  });
  it("429 with 'limit: 0' -> this model has no free quota, try the next model", () => {
    const e = classifyHttpError(429, body("Quota exceeded, limit: 0, model: x"), null);
    expect(e.modelUnavailable).toBe(true);
    expect(e.fatal).toBe(false);
  });
  it("bad key -> fatal INVALID_KEY (400 and 403)", () => {
    expect(classifyHttpError(400, body("API key not valid. Please pass a valid API key."), null).code).toBe("INVALID_KEY");
    expect(classifyHttpError(403, body("denied"), null).fatal).toBe(true);
  });
  it("404 -> model unavailable", () => {
    expect(classifyHttpError(404, body("model not found"), null).modelUnavailable).toBe(true);
  });
  it("5xx -> retriable", () => {
    expect(classifyHttpError(503, body("overloaded"), null).retriable).toBe(true);
  });
  it("other 400 -> not retriable", () => {
    const e = classifyHttpError(400, body("Invalid JSON payload"), null);
    expect(e.code).toBe("BAD_RESPONSE");
    expect(e.retriable).toBe(false);
  });
});

describe("toAiError", () => {
  it("maps abort, network and unknown errors", () => {
    expect(toAiError(new DOMException("x", "AbortError")).code).toBe("ABORTED");
    expect(toAiError(new TypeError("Failed to fetch")).code).toBe("NETWORK");
    expect(toAiError(new Error("boom")).code).toBe("UNKNOWN");
    const own = new AiError("BLOCKED", "x");
    expect(toAiError(own)).toBe(own);
  });
  it("503 / 500 are transient (resend same request), not per-file errors", () => {
    expect(classifyHttpError(503, body("The model is overloaded"), null).transient).toBe(true);
    expect(classifyHttpError(500, body("internal"), null).transient).toBe(true);
    expect(classifyHttpError(400, body("bad"), null).transient).toBe(false);
  });
});
