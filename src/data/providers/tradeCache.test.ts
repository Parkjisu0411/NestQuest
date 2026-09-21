import { beforeEach, expect, it, vi } from 'vitest'
import { fetchDistrictTrades } from './enrich.ts'
import { requestApi } from './http.ts'
import { cacheIsFresh, DAY, readProviderCache, tradeMonthCacheDays, writeProviderCache } from '../providerCache.ts'

vi.mock('./http.ts', async original => ({ ...await original<typeof import('./http.ts')>(), requestApi:vi.fn() }))
vi.mock('../providerCache.ts', async original => ({ ...await original<typeof import('../providerCache.ts')>(), readProviderCache:vi.fn(), writeProviderCache:vi.fn() }))
const stored = new Map<string, unknown>()
beforeEach(() => {
  vi.resetAllMocks(); stored.clear()
  vi.mocked(readProviderCache).mockImplementation(async (key, _ttl, validate) => stored.has(key) ? validate(stored.get(key)) : undefined)
  vi.mocked(writeProviderCache).mockImplementation(async (key, value) => { stored.set(key, value) })
  vi.mocked(requestApi).mockResolvedValue({ response:{ header:{resultCode:'00'}, body:{totalCount:0,items:[]} } })
})
const fetchRows = (refresh = false) => fetchDistrictTrades('11560','synthetic-key',new AbortController().signal,()=>{},refresh)

it('reuses all twelve completed months including empty results and supports explicit refresh', async () => {
  await fetchRows(); expect(requestApi).toHaveBeenCalledTimes(12)
  await fetchRows(); expect(requestApi).toHaveBeenCalledTimes(12)
  expect([...stored.keys()].every(key => !key.includes('synthetic-key'))).toBe(true)
  await fetchRows(true); expect(requestApi).toHaveBeenCalledTimes(24)
})
it('keeps completed months after failure and resumes without requesting them again', async () => {
  vi.mocked(requestApi).mockResolvedValueOnce({ response:{header:{resultCode:'00'},body:{totalCount:0,items:[]}} }).mockRejectedValueOnce(new Error('offline'))
  await expect(fetchRows()).rejects.toThrow('offline')
  expect(stored.size).toBe(1)
  await fetchRows(); expect(requestApi).toHaveBeenCalledTimes(13)
})
it('uses a short window for recent months including year boundaries', () => {
  const now = new Date(2027,0,10)
  expect(tradeMonthCacheDays('202701',now)).toBe(1)
  expect(tradeMonthCacheDays('202611',now)).toBe(1)
  expect(tradeMonthCacheDays('202610',now)).toBe(30)
  expect(cacheIsFresh(1000,DAY,1000+DAY-1)).toBe(true)
  expect(cacheIsFresh(1000,DAY,1000+DAY)).toBe(false)
  expect(cacheIsFresh(1000,DAY,999)).toBe(false)
})
