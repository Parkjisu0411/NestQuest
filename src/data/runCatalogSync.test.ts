import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { runCatalogSync } from './runCatalogSync.ts'
import { parseCatalogSnapshot } from './catalogSnapshot.ts'
import { mapSeoulApartment } from './providers/publicData.ts'
import { initialQuestState } from '../app/questStore.ts'
import { toPersistedUserState, persistedToAppState } from '../persistence/snapshot.ts'
import type { DiscoverableApartment } from '../domain/discover.ts'
import { detailKey, needsDetail, needsDistrictPrices, noRouteIsFresh } from './syncPlan.ts'
import { commuteQueryKey } from './commuteSession.ts'

const now = '2026-09-21T00:00:00.000Z'
const destination = {id:'work',name:'출근역',latitude:37.5,longitude:126.9}
function record(id: string, ready = true) {
  const r = mapSeoulApartment({kaptCode:id,kaptName:id,kaptAddr:'서울특별시 영등포구 여의도동 1',bjdCode:'1156011000'},now)
  return ready ? {...r,apartment:{...r.apartment,housingType:'아파트',latitude:37.51,longitude:126.91},source:{provider:'국토교통부 공동주택 기본정보',fetchedAt:now}} : r
}
function harness(input: DiscoverableApartment[]) {
  const saved = new Map(input.map(r=>[r.apartment.id,r]))
  const opts = {
    signal:new AbortController().signal,
    detail:vi.fn(async (r:DiscoverableApartment) => record(r.apartment.externalId!)),
    prices:vi.fn(async (rows:DiscoverableApartment[]) => rows),
    commute:vi.fn(async () => {}),
    save:vi.fn(async (rows:DiscoverableApartment[]) => { for(const r of rows) saved.set(r.apartment.id,r) }),
    stage:async (_name:string,work:()=>Promise<void>)=>work(), progress:vi.fn(),
  }
  const reload = () => persistedToAppState(toPersistedUserState({...initialQuestState,catalogSnapshot:{mode:'live',records:[...saved.values()]}})).catalogSnapshot!.records
  return { opts,saved,reload,run:(rows=input)=>runCatalogSync(rows,new Set(rows.map(r=>r.apartment.id)),opts) }
}
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(now)})
afterEach(()=>vi.useRealTimers())

it('matches and saves a district once, then does no work after a persisted reload even with no trades',async()=>{
  const h=harness(Array.from({length:100},(_,i)=>record('A'+i)))
  await h.run()
  expect(h.opts.prices).toHaveBeenCalledTimes(1)
  expect(h.opts.save).toHaveBeenCalledTimes(1)
  h.opts.progress.mockClear()
  await h.run(h.reload())
  expect(h.opts.prices).toHaveBeenCalledTimes(1)
  expect(h.opts.save).toHaveBeenCalledTimes(1)
  expect(h.opts.detail).not.toHaveBeenCalled()
  expect(h.opts.progress).not.toHaveBeenCalled()
})
it('resumes only unfinished details after an interruption',async()=>{
  const h=harness([record('A',false),record('B',false)])
  h.opts.detail.mockImplementationOnce(async()=>record('A')).mockRejectedValueOnce(new DOMException('cancel','AbortError'))
  await expect(h.run()).rejects.toThrow('cancel')
  expect(h.saved.get('kapt:A')?.syncChecks?.detail).toBeDefined()
  h.opts.detail.mockClear()
  await h.run(h.reload())
  expect(h.opts.detail).toHaveBeenCalledTimes(1)
  expect(h.opts.detail.mock.calls[0][0].apartment.id).toBe('kapt:B')
  expect(h.opts.prices).toHaveBeenCalledTimes(1)
})
it('rechecks prices once after a day or a neighbor identity changes',async()=>{
  const h=harness([record('A'),record('B')]);await h.run()
  const rows=h.reload()
  expect(needsDistrictPrices(rows)).toBe(false)
  rows[1].apartment.address='서울특별시 영등포구 여의도동 2'
  expect(needsDistrictPrices(rows)).toBe(true)
  await h.run(rows);expect(h.opts.prices).toHaveBeenCalledTimes(2)
  vi.setSystemTime('2026-09-22T00:00:00.001Z')
  await h.run(h.reload());expect(h.opts.prices).toHaveBeenCalledTimes(3)
})
it('persists missing-position and no-route checks but invalidates changed inputs',()=>{
  const r=record('A');delete r.apartment.latitude;delete r.apartment.longitude
  r.syncChecks={detail:{key:detailKey(r),at:now},noRoute:{key:commuteQueryKey(r.apartment,destination),at:now}}
  const loaded=parseCatalogSnapshot({mode:'live',records:[r]}).records[0]
  expect(needsDetail(loaded)).toBe(false)
  expect(noRouteIsFresh(loaded,destination)).toBe(true)
  expect(noRouteIsFresh(loaded,{...destination,id:'other'})).toBe(false)
  loaded.apartment.address='서울특별시 영등포구 여의도동 2'
  expect(needsDetail(loaded)).toBe(true)
})
it('does not record completion when saving fails',async()=>{
  const h=harness([record('A')])
  h.opts.save.mockRejectedValueOnce(new Error('disk full'))
  await expect(h.run()).rejects.toThrow('disk full')
  expect(h.saved.get('kapt:A')?.syncChecks?.price).toBeUndefined()
  await h.run(h.reload())
  expect(h.opts.prices).toHaveBeenCalledTimes(2)
})
