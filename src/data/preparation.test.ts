import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { preparationReport, preparationOutcome } from './preparation.ts'
import { createBootstrap, parseBootstrap, mergeBootstrap } from './bootstrap.ts'
import { detailKey, markDistrictPrices } from './syncPlan.ts'
import { commuteQueryKey } from './commuteSession.ts'
import { mapSeoulApartment, publicBody } from './providers/publicData.ts'
import { runCatalogSync } from './runCatalogSync.ts'
import { independentProviderStages } from './providers/independentProviderStages.ts'
import { ApiError } from './providers/http.ts'
import { parseCatalogSnapshot } from './catalogSnapshot.ts'
import type { DiscoverableApartment } from '../domain/discover.ts'

const now='2026-09-23T00:00:00.000Z'
const destination={id:'station:test',name:'시험역',longitude:126.9,latitude:37.5}
const scope={areas:['11560'],destination}
function record():DiscoverableApartment {
 const r=mapSeoulApartment({kaptCode:'A',kaptName:'시험단지',kaptAddr:'서울특별시 영등포구 여의도동 1',bjdCode:'1156011000'},now)
 return {...r,apartment:{...r.apartment,housingType:'아파트',latitude:37.51,longitude:126.91},source:{provider:'국토교통부 공동주택 기본정보',fetchedAt:now}}
}
function emptyResults() {
 const r=markDistrictPrices([record()],now)[0]
 r.syncChecks={...r.syncChecks,noRoute:{key:commuteQueryKey(r.apartment,destination),at:now}}
 return r
}
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(now)})
afterEach(()=>vi.useRealTimers())
it('blocks missing price/commute and exports confirmed no-results with its scope',()=>{
 const r=record()
 expect(preparationReport([r],scope)).toMatchObject({pending:1,complete:false})
 expect(()=>createBootstrap([r],now,scope)).toThrow()
 const done=emptyResults()
 expect(preparationReport([done],scope)).toMatchObject({empty:1,pending:0,complete:true})
 const seed=parseBootstrap(createBootstrap([done],now,scope))
 expect(seed.preparation).toEqual(scope)
 expect(seed.catalog.records[0].syncChecks?.noRoute).toBeDefined()
 expect(mergeBootstrap({mode:'live',records:[r]},seed).records[0].syncChecks?.noRoute).toEqual(done.syncChecks?.noRoute)
})
it('rejects forged completion, changed stations and stale checkpoints',()=>{
 const done=emptyResults()
 expect(preparationReport([done],{...scope,destination:{...destination,id:'station:other'}}).complete).toBe(false)
 expect(()=>parseBootstrap({...createBootstrap([record()],now),preparation:scope})).toThrow()
 vi.setSystemTime('2026-09-25T00:00:00.000Z')
 expect(preparationReport([done],scope).complete).toBe(false)
 // The historical preparation scope is validated at export time; expiry is handled in app.
 expect(parseBootstrap(createBootstrap([done],now,scope)).preparation).toEqual(scope)
})
it('does not declare missing positions complete until a real detail check exists',()=>{
 const r=emptyResults()
 delete r.apartment.latitude;delete r.apartment.longitude
 expect(preparationReport([r],scope).complete).toBe(false)
 r.syncChecks={...r.syncChecks,detail:{key:detailKey(r),at:now}}
 expect(preparationReport([r],scope)).toMatchObject({empty:1,complete:true})
 r.syncErrors={detail:{at:now}}
 expect(preparationReport([r],scope)).toMatchObject({errors:1,complete:false})
})
it('persists provider failures and clears them only after a successful resumed lookup',async()=>{
 let records=[record()]
 const controller=new AbortController()
 const options={
  signal:controller.signal,destination,
  detail:async(r:DiscoverableApartment)=>r,
  prices:async()=>{throw new ApiError('synthetic limit','limit')},
  commute:async()=>{throw new ApiError('synthetic auth','auth')},
  save:async(values:DiscoverableApartment[])=>{records=values},
  stage:independentProviderStages(controller.signal,()=>{}),progress:()=>{},
 }
 await runCatalogSync(records,new Set([records[0].apartment.id]),options)
 records=parseCatalogSnapshot({mode:'live',records}).records
 expect(records[0].syncErrors?.price).toBeDefined()
 expect(records[0].syncErrors?.commute).toBeDefined()
 expect(preparationReport(records,scope).errors).toBe(1)
 await runCatalogSync(records,new Set([records[0].apartment.id]),{...options,
  stage:independentProviderStages(controller.signal,()=>{}),
  prices:async values=>values,
  commute:async(r,save)=>{await save([{...r,syncChecks:{...r.syncChecks,noRoute:{key:commuteQueryKey(r.apartment,destination),at:now}}}])},
 })
 expect(records[0].syncErrors?.price).toBeUndefined()
 expect(records[0].syncErrors?.commute).toBeUndefined()
 expect(preparationReport(records,scope).complete).toBe(true)
})

it('keeps list failures visible even when cached records have no pending checks',()=>{
 const report=preparationReport([emptyResults()],scope)
 expect(report.complete).toBe(true)
 const issues={'단지 목록 41':'목록 조회 실패'}
 const outcome=preparationOutcome(report,issues)
 expect(outcome.complete).toBe(false)
 expect(outcome.message).toContain('실패')
 expect(outcome.issues).toEqual(issues)
 issues['단지 목록 41']='changed'
 expect(outcome.issues['단지 목록 41']).toBe('목록 조회 실패')
})
it('separates stored counts, selected counts and overlapping empty stages',()=>{
 const other={...record(),apartment:{...record().apartment,id:'kapt:other'},area:{...record().area,sigunguCode:'11110'}}
 const report=preparationReport([emptyResults(),other],scope)
 expect(report).toMatchObject({stored:2,total:1,general:1,empty:1,emptyByStage:{detail:0,price:1,commute:1}})
 expect(preparationOutcome(report,{})).toMatchObject({complete:true})
 expect(preparationOutcome(preparationReport([other],scope),{})).toMatchObject({complete:false,message:expect.stringContaining('수집된 단지가 없습니다')})
})
it('distinguishes gateway quota rejection from credential rejection without exposing raw responses',()=>{
 for (const [code,reason,kind] of [['22','LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR','limit'],['30','SERVICE_KEY_IS_NOT_REGISTERED_ERROR','auth'],['01','APPLICATION_ERROR','network']]) {
   try {
     publicBody({OpenAPI_ServiceResponse:{cmmMsgHeader:{returnReasonCode:code,returnAuthMsg:reason,errMsg:'synthetic private diagnostic'}}})
     expect.fail('must reject')
   } catch (error) {
     expect(error).toBeInstanceOf(ApiError)
     expect((error as ApiError).kind).toBe(kind)
     expect((error as ApiError).userMessage).not.toContain('synthetic')
   }
 }
})