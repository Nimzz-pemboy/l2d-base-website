import { Redis } from "@upstash/redis";

let redis = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

// In-memory fallback used only when Redis isn't configured (e.g. local dev).
// NOTE: this resets on every cold start / server restart, so it is not a
// reliable defense on its own in a serverless deployment — Redis is the
// real defense for production. Also caps its own size so it can't be used
// as a memory-exhaustion vector.
const memoryStore = new Map();
const MEMORY_STORE_MAX_ENTRIES = 5000;

function memoryRateLimit(key, limit, windowMs) {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now - entry.windowStart > windowMs) {
    if (memoryStore.size >= MEMORY_STORE_MAX_ENTRIES) {
      const oldestKey = memoryStore.keys().next().value;
      if (oldestKey) memoryStore.delete(oldestKey);
    }
    memoryStore.set(key, { count: 1, windowStart: now });
    return { success: true, remaining: limit - 1 };
  }

  entry.count += 1;
  if (entry.count > limit) {
    return { success: false, remaining: 0 };
  }
  return { success: true, remaining: limit - entry.count };
}

/**
 * Fixed-window rate limiter. Returns { success, remaining }.
 * Uses Upstash Redis when configured (works correctly across serverless
 * instances); otherwise degrades to a best-effort in-memory counter.
 */
export async function rateLimit(key, limit, windowMs) {
  if (redis) {
    try {
      const windowKey = `ratelimit:${key}:${Math.floor(Date.now() / windowMs)}`;
      const count = await redis.incr(windowKey);
      if (count === 1) {
        await redis.pexpire(windowKey, windowMs);
      }
      return { success: count <= limit, remaining: Math.max(0, limit - count) };
    } catch (err) {
      console.error("Redis rate limit error, falling back to memory:", err);
      return memoryRateLimit(key, limit, windowMs);
    }
  }
  return memoryRateLimit(key, limit, windowMs);
}

/**
 * Best-effort client identifier for rate limiting / abuse mitigation.
 *
 * IMPORTANT: headers like x-forwarded-for are fully attacker-controlled
 * unless your platform overwrites them at the edge. Vercel does overwrite
 * x-forwarded-for with the real connecting IP, so this is reasonably
 * trustworthy when deployed on Vercel — but treat it as a spam-reduction
 * signal, not a hard security boundary.
 */
export function getClientIdentifier(req) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
