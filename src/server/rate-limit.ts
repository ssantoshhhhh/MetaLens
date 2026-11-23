import { ApiError } from "@/server/errors"

type Bucket = { count: number; resetAt: number }
type Store = Map<string, Bucket>

const globalStore = globalThis as typeof globalThis & { __mlRate?: Store }
const buckets: Store = (globalStore.__mlRate ??= new Map())
const MAX_TRACKED_CLIENTS = 10_000

export type RateLimit = { name: string; limit: number; windowMs: number }

function consume(key: string, limit: number, windowMs: number, now: number) {
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return 0
  }
  bucket.count += 1
  return bucket.count > limit ? Math.ceil((bucket.resetAt - now) / 1000) : 0
}

function prune(now: number) {
  if (buckets.size < MAX_TRACKED_CLIENTS) return
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
  if (buckets.size >= MAX_TRACKED_CLIENTS) buckets.clear()
}

/** The nearest proxy appends the real client, so the last entry is hardest to spoof. */
export function clientAddress(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")
  return forwarded?.split(",").at(-1)?.trim() || "unknown"
}

/** Applies a per-client limit plus a ten-times global cap on this instance. */
export function enforceRateLimit(rule: RateLimit, headers: Headers) {
  const now = Date.now()
  prune(now)
  const retryAfter =
    consume(
      `${rule.name}:${clientAddress(headers)}`,
      rule.limit,
      rule.windowMs,
      now,
    ) || consume(`${rule.name}:*`, rule.limit * 10, rule.windowMs, now)
  if (retryAfter > 0) {
    throw new ApiError(
      429,
      "rate_limited",
      "Too many requests. Try again shortly.",
      {
        "Retry-After": String(retryAfter),
      },
    )
  }
}
