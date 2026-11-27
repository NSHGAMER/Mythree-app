// Tiny request cache: in-flight de-duplication, short-lived memory cache, optional localStorage
// persistence for public data, and explicit invalidation after writes. Never used for payment or exam writes.

interface Entry {
  at: number
  value: unknown
}
const memory = new Map<string, Entry>()
const inflight = new Map<string, Promise<unknown>>()
const LS_PREFIX = 'mythree-cache:'

function readLocal(key: string): Entry | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key)
    return raw ? (JSON.parse(raw) as Entry) : null
  } catch {
    return null
  }
}
function writeLocal(key: string, e: Entry) {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(e))
  } catch {
    /* quota / private mode */
  }
}

export interface CacheOptions {
  ttlMs: number
  /** keep in localStorage (public, non-personal data only) */
  persist?: boolean
  /** return stale data immediately and refresh in the background */
  staleWhileRevalidate?: boolean
}

export async function cached<T>(key: string, fn: () => Promise<T>, opts: CacheOptions): Promise<T> {
  const now = Date.now()
  let hit = memory.get(key) ?? (opts.persist ? readLocal(key) : null)
  if (hit && !memory.has(key)) memory.set(key, hit)
  if (hit && now - hit.at < opts.ttlMs) return hit.value as T
  if (hit && opts.staleWhileRevalidate) {
    void singleFlight(key, fn, opts).catch(() => {})
    return hit.value as T
  }
  hit = null
  return singleFlight(key, fn, opts)
}

/** Identical concurrent requests share one network call. */
export function singleFlight<T>(key: string, fn: () => Promise<T>, opts?: CacheOptions): Promise<T> {
  const existing = inflight.get(key)
  if (existing) return existing as Promise<T>
  const p = fn()
    .then((value) => {
      const e = { at: Date.now(), value }
      memory.set(key, e)
      if (opts?.persist) writeLocal(key, e)
      return value
    })
    .finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}

export function invalidate(...prefixes: string[]) {
  for (const k of [...memory.keys()]) if (prefixes.some((p) => k.startsWith(p))) memory.delete(k)
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k?.startsWith(LS_PREFIX) && prefixes.some((p) => k.slice(LS_PREFIX.length).startsWith(p))) localStorage.removeItem(k)
    }
  } catch {
    /* ignore */
  }
}

/** Clears everything that belongs to the signed-in member (called on sign-out). */
export function clearPersonalCache() {
  memory.clear()
  inflight.clear()
}

const RETRYABLE = /NetworkError|Failed to fetch|fetch failed|timeout|504|503|502|429|PGRST003|upstream|over_request_rate_limit|Load failed/i

export function isRetryable(err: unknown) {
  const m = err instanceof Error ? err.message : String(err)
  return RETRYABLE.test(m)
}

/** Exponential backoff with full jitter: ~0.4 s, 0.8 s, 1.6 s … capped. Only for idempotent operations. */
export async function withRetry<T>(fn: () => Promise<T>, opts: { retries?: number; baseMs?: number; maxMs?: number; onRetry?: (attempt: number) => void } = {}): Promise<T> {
  const retries = opts.retries ?? 3
  const base = opts.baseMs ?? 400
  const max = opts.maxMs ?? 5000
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (e) {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false
      if (attempt >= retries || offline || !isRetryable(e)) throw e
      opts.onRetry?.(attempt + 1)
      const delay = Math.random() * Math.min(max, base * 2 ** attempt)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
}
