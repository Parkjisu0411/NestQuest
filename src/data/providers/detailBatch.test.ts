import { describe, expect, it, vi } from 'vitest'
import { nextDetailBatch, processDetailBatch, type DetailAttempt } from './detailBatch.ts'
import { ApiError } from './http.ts'
import { mapSeoulApartment } from './publicData.ts'
const record=(id='A001')=>mapSeoulApartment({kaptCode:id,kaptName:id,kaptAddr:'서울특별시 영등포구 여의도동 1',bjdCode:'1156011000'},'2026-09-18T00:00:00Z')
function options(){return {signal:new AbortController().signal,refresh:false,detail:vi.fn(async(r)=>({...r,source:{provider:'국토교통부 공동주택 기본정보',fetchedAt:'2026-09-18T00:00:00Z'}})),geocode:vi.fn(async()=>null as {latitude:number;longitude:number}|null),save:vi.fn(async()=>{}),report:vi.fn(),progress:vi.fn()}}
describe('resumable district detail batches',()=>{
  it('does not starve later apartments when the first twenty lack coordinates',async()=>{
    const records=Array.from({length:25},(_,i)=>record(String(i))), attempted=new Map<string,DetailAttempt>(),deps=options()
    deps.report.mockImplementation((id:string,result:DetailAttempt)=>attempted.set(id,result))
    await processDetailBatch(nextDetailBatch(records,attempted,false,true),deps)
    expect(attempted.size).toBe(20);expect(nextDetailBatch(records,attempted,false,true).map(x=>x.apartment.id)).toEqual(records.slice(20).map(x=>x.apartment.id))
    expect([...attempted.values()].every(x=>x.status==='missing-position')).toBe(true)
  })
  it('preserves basic facts when one address is ambiguous and continues the rest',async()=>{
    const deps=options();deps.geocode.mockRejectedValueOnce(new ApiError('복수 주소','format')).mockResolvedValueOnce({latitude:37.5,longitude:126.9})
    expect(await processDetailBatch([record(),record('A002')],deps)).toBe(2)
    expect(deps.save.mock.calls).toHaveLength(4)
    expect(deps.report).toHaveBeenCalledWith('kapt:A001',expect.objectContaining({status:'missing-position'}))
  })
  it('stops on quota, storage failure or cancellation instead of spending further calls',async()=>{
    const deps=options();deps.geocode.mockRejectedValue(new ApiError('한도','limit'))
    await expect(processDetailBatch([record(),record('A002')],deps)).rejects.toThrow('한도');expect(deps.detail).toHaveBeenCalledTimes(1);expect(deps.report).not.toHaveBeenCalled()
    const storage=options();storage.save.mockRejectedValue(new Error('디스크'));await expect(processDetailBatch([record()],storage)).rejects.toThrow('디스크');expect(storage.geocode).not.toHaveBeenCalled()
    const abort=new AbortController();const cancelled=options();cancelled.signal=abort.signal;cancelled.geocode.mockImplementation(async()=>{abort.abort();return {latitude:37.5,longitude:126.9}})
    await expect(processDetailBatch([record()],cancelled)).rejects.toThrow();expect(cancelled.save).toHaveBeenCalledTimes(1)
  })
  it('does not repeatedly request detailed facts just because no geocoder key exists',()=>{
    const detailed={...record(),apartment:{...record().apartment,housingType:'아파트'},source:{provider:'국토교통부 공동주택 기본정보',fetchedAt:'2026-09-18T00:00:00Z'}}
    expect(nextDetailBatch([detailed],new Map(),false,false)).toEqual([])
    expect(nextDetailBatch([detailed],new Map(),false,true)).toHaveLength(1)
    expect(nextDetailBatch([{...detailed,apartment:{...detailed.apartment,housingType:undefined}}],new Map(),false,false)).toHaveLength(1)
  })
})
