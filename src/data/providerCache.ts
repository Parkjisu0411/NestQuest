import { openNestQuestDb, requestToPromise, transactionDone } from '../persistence/idb.ts'
import { PROVIDER_CACHE_STORE } from '../persistence/schema.ts'

export const DAY = 86400000
const memory = new Map<string, { savedAt: number; value: unknown }>()
export function cacheIsFresh(savedAt: number, ttl: number, now = Date.now()) {
  return Number.isFinite(savedAt) && now >= savedAt && now - savedAt < ttl
}
export function tradeMonthCacheDays(month: string, now = new Date()) {
  const age = (now.getFullYear() - Number(month.slice(0,4))) * 12 + now.getMonth() + 1 - Number(month.slice(4,6))
  return age < 3 ? 1 : 30
}

/** Only validated public data belongs here. Keys, headers and request URLs are never stored. */
export async function readProviderCache<T>(key: string, ttl: number, validate: (raw: unknown) => T): Promise<T | undefined> {
  if (typeof indexedDB === 'undefined') return undefined
  try {
    const saved = memory.get(key)
    if (saved && cacheIsFresh(saved.savedAt, ttl)) return validate(saved.value)
    const db = await openNestQuestDb()
    const entry = await requestToPromise(db.transaction(PROVIDER_CACHE_STORE).objectStore(PROVIDER_CACHE_STORE).get(key), '캐시 읽기 실패')
    if (!entry || !cacheIsFresh(entry.savedAt, ttl)) return undefined
    const result = validate(entry.value)
    memory.set(key, entry)
    return result
  } catch { return undefined }
}
export async function writeProviderCache(key: string, value: unknown): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  const entry = { savedAt:Date.now(), value }
  memory.set(key, entry)
  try {
    const db = await openNestQuestDb()
    const tx = db.transaction(PROVIDER_CACHE_STORE, 'readwrite')
    const done = transactionDone(tx, '캐시 저장 실패')
    tx.objectStore(PROVIDER_CACHE_STORE).put(entry, key)
    await done
  } catch { /* Cache is optional; the primary catalog save reports persistence failures. */ }
}
