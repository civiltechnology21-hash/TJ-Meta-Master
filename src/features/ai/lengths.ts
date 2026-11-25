/**
 * We ask for a few extra keywords and cut the list to the exact number afterwards.
 * (Duplicates and weak keywords get removed, so asking for exactly N would end up short.)
 * The cut keeps the FIRST keywords, so the strongest ones always survive.
 */
export function requestedKeywordCount(count: number): number {
  return count + Math.max(5, Math.ceil(count * 0.2));
}

/** Length window we ask the model to aim for (it cannot count perfectly; we trim afterwards). */
export function lengthWindow(limit: number): { min: number; max: number } {
  return { min: Math.round(limit * 0.8), max: Math.max(20, limit - 3) };
}
