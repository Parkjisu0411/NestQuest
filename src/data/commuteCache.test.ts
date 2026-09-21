import { describe, expect, it, vi } from 'vitest'
import { mapSeoulApartment } from './providers/publicData.ts'
import { hydrateCommute } from './providers/hydrateCommute.ts'
import { mergeCatalog, parseCatalogSnapshot } from './catalogSnapshot.ts'
import { savedCommute, withSavedCommute, COMMUTE_CACHE_DAYS } from './commuteCache.ts'
import { commuteQueryKey, setCommuteServiceIssue } from './commuteSession.ts'
const destination={id:'cache-station',name:'여의도역',latitude:37.52,longitude:126.92}
function fixture(id:string) {
  const raw=mapSeoulApartment({kaptCode:id,kaptName:id,kaptAddr:'서울특별시 영등포구 여의도동 1',bjdCode:'1156011000'},new Date().toISOString())
  const record={...raw,apartment:{...raw.apartment,latitude:37.5,longitude:126.9}}
  const estimate={apartmentId:record.apartment.id,destinationId:destination.id,provider:'Kakao',totalMinutes:26,route:[],calculatedAt:new Date().toISOString(),queryKey:commuteQueryKey(record.apartment,destination)}
  return {record,estimate}
}
describe('persisted Kakao commute cache',()=>{
  it('reuses a saved result after serialization even while the provider is quota blocked',async()=>{
    const {record,estimate}=fixture('reload')
    const snapshot=parseCatalogSnapshot(JSON.parse(JSON.stringify(mergeCatalog(undefined,[withSavedCommute(record,estimate)]))))
    setCommuteServiceIssue({kind:'limit',message:'한도'})
    const fetch=vi.fn(async()=>estimate),save=vi.fn(async()=>{})
    expect(await hydrateCommute(snapshot.records[0],destination,new AbortController().signal,fetch,{save})).toEqual(estimate)
    expect(fetch).not.toHaveBeenCalled();expect(save).not.toHaveBeenCalled()
    setCommuteServiceIssue(undefined)
  })
  it('invalidates changed endpoints, missing identities and expired results',()=>{
    const {record,estimate}=fixture('identity'), cached=withSavedCommute(record,estimate)
    expect(savedCommute(cached,destination)).toEqual(estimate)
    expect(savedCommute(cached,{...destination,longitude:127})).toBeUndefined()
    expect(savedCommute({...cached,apartment:{...cached.apartment,latitude:37.4}},destination)).toBeUndefined()
    expect(savedCommute(cached,destination,Date.parse(estimate.calculatedAt)+COMMUTE_CACHE_DAYS*86400000)).toBeUndefined()
    expect(savedCommute(withSavedCommute(record,{...estimate,queryKey:undefined}),destination)).toBeUndefined()
  })
  it('preserves cache when list or detail data refreshes and refuses to overwrite a newer route',()=>{
    const {record,estimate}=fixture('merge')
    let snapshot=mergeCatalog(undefined,[record])
    snapshot=mergeCatalog(snapshot,[withSavedCommute(record,estimate)])
    expect(snapshot.records[0].commutes).toHaveLength(1)
    snapshot=mergeCatalog(snapshot,[record])
    snapshot=mergeCatalog(snapshot,[{...record,source:{provider:'국토교통부 공동주택 기본정보',fetchedAt:estimate.calculatedAt}}])
    snapshot=mergeCatalog(snapshot,[withSavedCommute(record,{...estimate,totalMinutes:99,calculatedAt:'2020-01-01T00:00:00Z'})])
    expect(savedCommute(snapshot.records[0],destination)?.totalMinutes).toBe(26)
  })
  it('persists before publishing success, and explicit refresh replaces the saved result',async()=>{
    const {record,estimate}=fixture('refresh'),fetch=vi.fn(async()=>({...estimate,totalMinutes:32})),save=vi.fn(async()=>{})
    const result=await hydrateCommute(withSavedCommute(record,estimate),destination,new AbortController().signal,fetch,{save,refresh:true})
    expect(result?.totalMinutes).toBe(32);expect(fetch).toHaveBeenCalledOnce();expect(save).toHaveBeenCalledOnce()
    expect(savedCommute(save.mock.calls[0][0][0],destination)?.totalMinutes).toBe(32)
  })
})
