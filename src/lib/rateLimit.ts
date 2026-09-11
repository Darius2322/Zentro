/**
 * In-memory sliding-window rate limiter. This is intentionally simple:
 * a Map keyed by "ip:route", pruned lazily. It works correctly for a
 * single running instance (e.g. local dev, or one long-lived container),
 * but does NOT share state across multiple serverless instances — on
 * Vercel with multiple concurrent lambda instances, each gets its own
 * counter. For real production brute-force protection, replace this with
 * a shared store (Upstash Redis, Vercel KV) behind the same isAllowed()
 * interface; nothing else in the codebase needs to change.
 */

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

export function isAllowed(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now - existing.windowStart > windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (existing.count >= limit) return false;

  existing.count += 1;
  return true;
}

// Occasional cleanup so the Map doesn't grow unbounded over a long-lived
// process. Not cryptographically important, just housekeeping.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > 10 * 60 * 1000) buckets.delete(key);
  }
}, 5 * 60 * 1000).unref?.();
