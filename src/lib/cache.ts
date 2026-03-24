// src/lib/cache.ts
// In-memory cache for API responses to reduce DB load at scale

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const store = new Map<string, CacheEntry<unknown>>()

export function getCache<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined
  if (!entry) return null
  if (Date.now() > entry.expiresAt) { store.delete(key); return null }
  return entry.data
}

export function setCache<T>(key: string, data: T, ttlSeconds = 30): void {
  store.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 })
}

export function invalidateCache(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}
