import { afterEach, describe, expect, it, vi } from 'vitest'
import { cached, invalidate, isRetryable, singleFlight, withRetry } from './cache'

afterEach(() => {
  invalidate('')
  localStorage.clear()
})

describe('request cache', () => {
  it('de-duplicates identical in-flight requests', async () => {
    const fn = vi.fn(() => new Promise((r) => setTimeout(() => r(42), 10)))
    const [a, b, c] = await Promise.all([singleFlight('k1', fn), singleFlight('k1', fn), singleFlight('k1', fn)])
    expect([a, b, c]).toEqual([42, 42, 42])
    expect(fn).toHaveBeenCalledTimes(1)
  })
  it('serves from cache within TTL and refetches after invalidation', async () => {
    const fn = vi.fn(async () => Math.random())
    const first = await cached('dash', fn, { ttlMs: 60_000 })
    expect(await cached('dash', fn, { ttlMs: 60_000 })).toBe(first)
    invalidate('dash')
    await cached('dash', fn, { ttlMs: 60_000 })
    expect(fn).toHaveBeenCalledTimes(2)
  })
  it('persists public data to localStorage', async () => {
    await cached('settings', async () => ({ fee: 151 }), { ttlMs: 60_000, persist: true })
    expect(localStorage.getItem('mythree-cache:settings')).toContain('151')
  })
})

describe('retry with backoff', () => {
  it('retries transient errors and succeeds', async () => {
    let n = 0
    const r = await withRetry(async () => {
      if (++n < 3) throw new Error('504 upstream request timeout')
      return 'ok'
    }, { baseMs: 1 })
    expect(r).toBe('ok')
    expect(n).toBe(3)
  })
  it('does not retry business errors', async () => {
    let n = 0
    await expect(withRetry(async () => {
      n++
      throw new Error('CHAPTER_LOCKED')
    }, { baseMs: 1 })).rejects.toThrow('CHAPTER_LOCKED')
    expect(n).toBe(1)
  })
  it('classifies retryable errors', () => {
    expect(isRetryable(new Error('TypeError: Failed to fetch'))).toBe(true)
    expect(isRetryable(new Error('Request rate limit reached (429)'))).toBe(true)
    expect(isRetryable(new Error('NOT_ELIGIBLE'))).toBe(false)
  })
})
