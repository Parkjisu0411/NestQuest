import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hydrateCommute } from './hydrateCommute.ts'
import { mapSeoulApartment } from './publicData.ts'
import { commuteQueryKey, getCommuteQueries, setCommuteServiceIssue } from '../commuteSession.ts'
import { ApiError } from './http.ts'
import type { CommuteEstimate } from '../../domain/models.ts'
const destination = { id:'test:yeouido', name:'여의도역', latitude:37.5, longitude:126.9 }
function record(id:string) {
  const value = mapSeoulApartment({ kaptCode:id, kaptName:id, kaptAddr:'서울특별시 영등포구', bjdCode:'1156011000' }, '2026-09-21T00:00:00Z')
  return { ...value, apartment:{ ...value.apartment, latitude:37.51, longitude:126.91 } }
}
function estimate(id:string): CommuteEstimate { return { apartmentId:id, destinationId:destination.id, totalMinutes:23, route:[], provider:'Kakao', calculatedAt:new Date().toISOString() } }
describe('initial commute hydration', () => {
  beforeEach(() => setCommuteServiceIssue(undefined))
  it('loads every apartment without selection and reuses successful results', async () => {
    const records = Array.from({ length:55 }, (_, i) => record(`initial-${i}`))
    const fetch = vi.fn(async () => estimate('test'))
    for (const item of records) await hydrateCommute(item, destination, new AbortController().signal, fetch)
    expect(fetch).toHaveBeenCalledTimes(55)
    await hydrateCommute(records[0], destination, new AbortController().signal, fetch)
    expect(fetch).toHaveBeenCalledTimes(55)
    expect(getCommuteQueries().get(commuteQueryKey(records[54].apartment, destination))?.estimate?.totalMinutes).toBe(23)
  })
  it('requeries when destination changes', async () => {
    const item=record('destination-change'), fetch=vi.fn(async () => estimate(item.apartment.id))
    await hydrateCommute(item,destination,new AbortController().signal,fetch)
    await hydrateCommute(item,{...destination,id:'another-station'},new AbortController().signal,fetch)
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('retains no-route without retrying or making up zero minutes', async () => {
    const item=record('no-route'), fetch=vi.fn(async () => { throw new ApiError('경로 없음','no-route') })
    await hydrateCommute(item,destination,new AbortController().signal,fetch)
    await hydrateCommute(item,destination,new AbortController().signal,fetch)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(getCommuteQueries().get(commuteQueryKey(item.apartment,destination))).toMatchObject({status:'no-route'})
    expect(getCommuteQueries().get(commuteQueryKey(item.apartment,destination))?.estimate).toBeUndefined()
  })
  it('stops on quota and discards a response arriving after cancellation', async () => {
    const item=record('quota'), abort=new AbortController()
    await expect(hydrateCommute(item,destination,abort.signal,async()=>{throw new ApiError('한도','limit')})).rejects.toThrow('한도')
    const blockedFetch = vi.fn(async () => estimate('blocked'))
    await expect(hydrateCommute(record('quota-next'),destination,abort.signal,blockedFetch)).rejects.toThrow('한도')
    expect(blockedFetch).not.toHaveBeenCalled()
    setCommuteServiceIssue(undefined)
    await expect(hydrateCommute(item,destination,abort.signal,async()=>{abort.abort();return estimate(item.apartment.id)})).rejects.toThrow()
    expect(getCommuteQueries().get(commuteQueryKey(item.apartment,destination))?.status).toBe('error')
  })
  it('does not query an apartment without coordinates', async () => {
    const item=record('missing'), fetch=vi.fn(async()=>estimate(item.apartment.id))
    await hydrateCommute({...item,apartment:{...item.apartment,latitude:undefined}},destination,new AbortController().signal,fetch)
    expect(fetch).not.toHaveBeenCalled()
  })
})
