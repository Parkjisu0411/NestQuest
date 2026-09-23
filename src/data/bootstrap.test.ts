import { afterEach, expect, it, vi } from 'vitest'
import { createBootstrap, parseBootstrap, mergeBootstrap, loadBundledBootstrap } from './bootstrap.ts'
import { mapSeoulApartment } from './providers/publicData.ts'
import { parseCatalogSnapshot } from './catalogSnapshot.ts'
import { detailKey, markDistrictPrices, needsDetail, needsDistrictPrices } from './syncPlan.ts'
import { storedCommute, savedCommute } from './commuteCache.ts'
import { commuteQueryKey } from './commuteSession.ts'
import { autoSyncTargets } from './autoSyncTargets.ts'
import type { QuestState } from '../domain/models.ts'
const now='2026-09-21T00:00:00.000Z'
function record(id='A') {
 const r=mapSeoulApartment({kaptCode:id,kaptName:id,kaptAddr:'서울특별시 영등포구 여의도동 1',bjdCode:'1156011000'},now)
 return {...r,apartment:{...r.apartment,housingType:'아파트',latitude:37.5,longitude:126.9},source:{provider:'국토교통부 공동주택 기본정보',fetchedAt:now}}
}
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals()})
it('exports only provider catalog data and preserves real checkpoints through restart',()=>{
 vi.useFakeTimers();vi.setSystemTime(now)
 const r=record();r.syncChecks={detail:{key:detailKey(r),at:now}}
 const raw={...createBootstrap(markDistrictPrices([r],now)),quest:{private:true},apiKey:'synthetic-secret',visits:[{memo:'private'}]}
 raw.catalog.records[0].research=[{id:'private',questId:'q',apartmentId:r.apartment.id,category:'COMMERCIAL',summary:'private-note',sources:[],researchedAt:now}]
 const seed=parseBootstrap(raw)
 expect(JSON.stringify(seed)).not.toContain('private')
 expect(JSON.stringify(seed)).not.toContain('synthetic-secret')
 const loaded=parseCatalogSnapshot(JSON.parse(JSON.stringify(mergeBootstrap(undefined,seed))))
 expect(loaded.bootstrapVersion).toBe(seed.version)
 expect(needsDetail(loaded.records[0])).toBe(false)
 expect(needsDistrictPrices(loaded.records)).toBe(false)
 expect(mergeBootstrap(loaded,seed)).toBe(loaded)
})
it('keeps newer local facts, adds missing records and does not refresh original timestamps',()=>{
 const old=record();old.apartment.name='latest local';old.source.fetchedAt='2026-09-22T00:00:00.000Z'
 const incoming=record();incoming.apartment.name='older seed'
 const result=mergeBootstrap({mode:'live',records:[old]},createBootstrap([incoming,record('B')]))
 expect(result.records[0].apartment.name).toBe('latest local')
 expect(result.records[1].source?.fetchedAt).toBe(now)
})
it('does not erase local prices when seed has no prices and keeps later commute results',()=>{
 const old=record();const destination={id:'station:test',name:'시험역',latitude:37.52,longitude:126.92}
 const route={apartmentId:old.apartment.id,destinationId:destination.id,queryKey:commuteQueryKey(old.apartment,destination),provider:'Kakao',calculatedAt:now,totalMinutes:20,route:[]}
 old.commutes=[route]
 old.unitTypes=[{id:'u',apartmentId:old.apartment.id,areaGroup:84,exclusiveAreas:[84],priceEstimate:{apartmentId:old.apartment.id,unitTypeId:'u',estimatedPrice:100,lowPrice:100,highPrice:100,latestPrice:100,transactionCount:1,periodMonths:12,confidence:'LOW',calculatedAt:now}}]
 const seedRecord={...record(),commutes:[{...route,totalMinutes:99,calculatedAt:'2026-08-01T00:00:00.000Z'}]}
 const merged=mergeBootstrap({mode:'live',records:[old]},createBootstrap([seedRecord])).records[0]
 expect(merged.unitTypes[0].priceEstimate?.estimatedPrice).toBe(100)
 expect(merged.commutes[0].totalMinutes).toBe(20)
})
it('shows expired route only for matching endpoints while scheduling a refresh',()=>{
 vi.useFakeTimers();vi.setSystemTime('2026-11-01T00:00:00.000Z')
 const r=record(), d={id:'station:test',name:'시험역',latitude:37.52,longitude:126.92}
 r.commutes=[{apartmentId:r.apartment.id,destinationId:d.id,queryKey:commuteQueryKey(r.apartment,d),provider:'Kakao',calculatedAt:now,totalMinutes:20,route:[]}]
 expect(savedCommute(r,d)).toBeUndefined()
 expect(storedCommute(r,d)?.totalMinutes).toBe(20)
 expect(storedCommute(r,{...d,longitude:127})).toBeUndefined()
})
it('bounds automatic work, prioritizes selection/candidates and reserves full collection for explicit action',()=>{
 const records=Array.from({length:3404},(_,i)=>record('A'+i));const areas=new Set(['11560'])
 const st=(i:number,stage:QuestState['stage']):QuestState=>({questId:'q',apartmentId:records[i].apartment.id,stage,targetUnitTypeIds:[],updatedAt:now})
 const states={[records[100].apartment.id]:st(100,'SHORTLIST'),[records[101].apartment.id]:st(101,'CANDIDATE')}
 const result=autoSyncTargets(records,states,areas,records.slice(0,50).map(r=>r.apartment.id),records[200].apartment.id)
 expect(result).toHaveLength(50)
 expect(result.slice(0,3).map(r=>r.apartment.id)).toEqual([records[200].apartment.id,records[100].apartment.id,records[101].apartment.id])
 expect(autoSyncTargets(records,{},areas)).toHaveLength(20)
 expect(autoSyncTargets(records,{},areas,[],undefined,true)).toHaveLength(3404)
})
it('handles missing or malformed bundled data without preventing startup',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({wrong:true})})))
 expect(await loadBundledBootstrap()).toBeUndefined()
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:false})))
 expect(await loadBundledBootstrap()).toBeUndefined()
})

it('does not consume price requests or mark completion for deferred districts',async()=>{
 const {runCatalogSync}=await import('./runCatalogSync.ts')
 const r=record();const prices=vi.fn(async()=>[r]),save=vi.fn(async()=>{})
 await runCatalogSync([r],new Set([r.apartment.id]),{signal:new AbortController().signal,priceDistricts:new Set(),detail:async()=>r,prices,commute:async()=>{},save,stage:async(_name,work)=>work(),progress:()=>{}})
 expect(prices).not.toHaveBeenCalled();expect(save).not.toHaveBeenCalled()
})

it('does not replace verified housing facts with a newer alternate public list',()=>{
 const old=record()
 const incoming=mapSeoulApartment({kaptCode:'A',kaptName:'list only',kaptAddr:'서울특별시 영등포구 여의도동 1',bjdCode:'1156011000'},'2026-09-23T00:00:00.000Z')
 incoming.source={provider:'K-apt 공개 단지 목록',fetchedAt:'2026-09-23T00:00:00.000Z'}
 const merged=mergeBootstrap({mode:'live',records:[old]},createBootstrap([incoming]))
 expect(merged.records[0].apartment.housingType).toBe('아파트')
 expect(merged.records[0].apartment.name).toBe(old.apartment.name)
})