import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseApiBody, requestApi } from './http.ts'
import { bodyItems, decodeServiceKey, fetchSeoulApartments, mapSeoulApartment, publicBody } from './publicData.ts'
import { attachDistrictTrades, attachTrades, fetchCommute, fetchDetail, parseTradeRows } from './enrich.ts'
import { commuteQueryKey } from '../commuteSession.ts'

vi.mock('./http.ts', async (original) => ({ ...await original<typeof import('./http.ts')>(), requestApi: vi.fn() }))
const now = '2026-09-18T00:00:00.000Z'
const row = { kaptCode: 'A001', kaptName: '테스트단지', kaptAddr: '서울특별시 영등포구 여의도동 1', bjdCode: '1156011000' }
const envelope = (item: unknown, totalCount = 1) => ({ response: { header: { resultCode: '00' }, body: { totalCount, items: { item } } } })
beforeEach(() => vi.resetAllMocks())
describe('provider contracts (synthetic fixtures, not live verification)', () => {
  it('combines the distinct official basic/detail operations and validates their apartment code', async () => {
    const basic = { response: { header: { resultCode: '00' }, body: { item: { ...row, codeAptNm:'아파트', kaptdaCnt: '120', kaptDongCnt: 2, kaptUsedate: '20010102', codeHeatNm: '지역난방' } } } }
    const detail = { response: { header: { resultCode: '00' }, body: { item: { kaptCode: 'A001', kaptdPcnt: 20, kaptdPcntu: 80 } } } }
    vi.mocked(requestApi).mockResolvedValueOnce(basic).mockResolvedValueOnce(detail)
    const result = await fetchDetail(mapSeoulApartment(row, now), 'test', new AbortController().signal)
    expect(result.apartment).toMatchObject({ housingType:'아파트', householdCount: 120, buildingCount: 2, parkingCount: 100, approvalDate: '2001-01-02' })
    expect(vi.mocked(requestApi).mock.calls.map((args) => args[0])).toEqual(['basic','detail'])
    vi.mocked(requestApi).mockResolvedValueOnce({ response: { header: { resultCode: '00' }, body: { item: { ...row, kaptCode: 'other' } } } })
    await expect(fetchDetail(mapSeoulApartment(row, now), 'test', new AbortController().signal)).rejects.toThrow('코드')
  })
  it('keeps XML identifiers as strings and rejects document entities', () => {
    const result = parseApiBody('<response><header><resultCode>00</resultCode></header><body><items><item><kaptCode>00123</kaptCode></item></items><totalCount>1</totalCount></body></response>')
    expect(bodyItems(publicBody(result))[0].kaptCode).toBe('00123')
    expect(() => parseApiBody('<!DOCTYPE x [<!ENTITY y "x">]><x>&y;</x>')).toThrow()
  })
  it('distinguishes authentication and rate-limit errors from empty success', () => {
    expect(() => publicBody({ response: { header: { resultCode: '22' } } })).toThrow('한도')
    expect(() => publicBody({ response: { header: { resultCode: '30' } } })).toThrow('키')
    expect(bodyItems(publicBody(envelope([], 0)))).toEqual([])
  })
  it('decodes an encoded service key once without corrupting plus signs', () => {
    expect(decodeServiceKey('a%2Bb%3D')).toBe('a+b=')
    expect(decodeServiceKey('a+b=')).toBe('a+b=')
  })
  it('collects every page and rejects repeated pages instead of silently truncating', async () => {
    vi.mocked(requestApi).mockResolvedValueOnce(envelope([row], 2)).mockResolvedValueOnce(envelope([{ ...row, kaptCode: 'A002' }], 2))
    expect(await fetchSeoulApartments('test-key', new AbortController().signal, () => {})).toHaveLength(2)
    vi.mocked(requestApi).mockResolvedValue(envelope([row], 2))
    await expect(fetchSeoulApartments('test-key', new AbortController().signal, () => {})).rejects.toThrow('중복')
  })
  it('does not turn missing area/address data into invented facts', () => {
    expect(() => mapSeoulApartment({ kaptCode: 'A001', kaptName: '단지' }, now)).toThrow()
    expect(mapSeoulApartment(row, now).apartment.latitude).toBeUndefined()
  })
  it('requires exact name AND full lot address to attach prices; removes canceled sales from estimate', () => {
    const record = mapSeoulApartment(row, now)
    const trade = { aptSeq: '11560-1', aptNm: row.kaptName, umdNm: '여의도동', jibun: '1', dealYear: '2026', dealMonth: '9', dealDay: '1', excluUseAr: '84.5', floor: '5', dealAmount: '100,000' }
    const rows = parseTradeRows({ items: { item: [trade, { ...trade, cdealType: 'O' }, { ...trade, dealDay: '2', dealAmount: '120,000' }] } }, '11560')
    const enriched = attachTrades(record, rows, now)
    expect(enriched.unitTypes[0].priceEstimate?.estimatedPrice).toBe(1_200_000_000)
    expect(enriched.unitTypes[0].priceEstimate?.transactionCount).toBe(1)
    expect(enriched.transactions?.filter(t=>!t.canceled)).toHaveLength(1)
    expect(enriched.transactions?.find(t=>!t.canceled)?.unitTypeId).toBe(enriched.unitTypes[0].id)
    expect(attachTrades(enriched, [], now).unitTypes[0].priceEstimate).toBeUndefined()
    const duplicateCatalog = [record, { ...record, apartment: { ...record.apartment, id: 'kapt:OTHER' } }]
    expect(attachDistrictTrades(duplicateCatalog, rows, now).every((item) => !item.unitTypes.some((unit) => unit.priceEstimate))).toBe(true)
    expect(attachTrades({ ...record, apartment: { ...record.apartment, address: '서울특별시 영등포구 여의도동 2' } }, rows, now)).toEqual({ ...record, apartment: { ...record.apartment, address: '서울특별시 영등포구 여의도동 2' } })
  })
  it('invalidates commute cache when either endpoint coordinate changes', () => {
    const apartment = mapSeoulApartment(row, now).apartment
    const destination = { id: 'work', name: '여의도', latitude: 37.5, longitude: 126.9 }
    expect(commuteQueryKey(apartment, destination)).not.toBe(commuteQueryKey(apartment, { ...destination, longitude: 127 }))
  })
  it('isolates ambiguous trade identities while updating the rest of a district', () => {
    const first = mapSeoulApartment(row, now)
    const second = mapSeoulApartment({ ...row, kaptCode:'A002', kaptName:'다른단지', kaptAddr:'서울특별시 영등포구 여의도동 2' }, now)
    const trade = { aptSeq:'11560-1', aptNm:row.kaptName, umdNm:'여의도동', jibun:'1', dealYear:'2026', dealMonth:'9', dealDay:'1', excluUseAr:'84.5', floor:'5', dealAmount:'100,000' }
    const original = parseTradeRows({items:{item:[trade]}}, '11560')
    const old = attachTrades(first, original, now)
    const rows = parseTradeRows({items:{item:[trade, {...trade,aptSeq:'11560-2'}, {...trade,aptSeq:'11560-3',aptNm:'다른단지',jibun:'2'}]}}, '11560')
    const result = attachDistrictTrades([old,second], rows, now)
    expect(result[0].transactions).toEqual([])
    expect(result[0].unitTypes.every(unit => unit.priceEstimate === undefined)).toBe(true)
    expect(result[1].unitTypes[0].priceEstimate?.estimatedPrice).toBe(1_000_000_000)
  })

  it('classifies Kakao errors without exposing provider messages', async () => {
    const record=mapSeoulApartment(row,now)
    record.apartment.latitude=37.5;record.apartment.longitude=126.9
    const destination={id:'work',name:'여의도',latitude:37.52,longitude:126.92}
    for(const [code,kind] of [[-1,'network'],[-10,'limit'],[-401,'auth'],[-2,'format']] as const) {
      vi.mocked(requestApi).mockResolvedValue({code,message:'private-test-token'})
      const result=await fetchCommute(record,destination,'test',new AbortController().signal).catch(e=>e)
      expect(result).toMatchObject({kind});expect(result.message).not.toContain('private-test-token')
    }
  })
  it('parses Kakao seconds and selects the fastest route using header authentication', async () => {
    const record=mapSeoulApartment(row,now)
    record.apartment.latitude=37.5;record.apartment.longitude=126.9
    const path=(totalTime:number)=>({properties:{type:'SUBWAY',totalTime,transfers:1},steps:[
      {properties:{type:'WALKING',time:300}}, {properties:{type:'SUBWAY',time:1200,vehicles:[{name:'9호선'}],stops:[{name:'출발역'},{name:'여의도'}]}}
    ]})
    vi.mocked(requestApi).mockResolvedValue({status:'OK',routes:[path(2400),path(1501)]})
    const destination={id:'work',name:'여의도',latitude:37.52,longitude:126.92}
    const estimate=await fetchCommute(record,destination,'synthetic-key',new AbortController().signal)
    expect(estimate).toMatchObject({provider:'Kakao',totalMinutes:25,walkingMinutes:5,transferCount:1})
    expect(estimate.route[1].lineName).toBe('9호선')
    expect(vi.mocked(requestApi).mock.calls[0][1]).toEqual({start_x:'126.9',start_y:'37.5',end_x:'126.92',end_y:'37.52',input_coord:'WGS84'})
    expect(vi.mocked(requestApi).mock.calls[0][3]).toEqual({Authorization:'KakaoAK synthetic-key'})
    vi.mocked(requestApi).mockResolvedValue({status:'OK',routes:[path(1530)]})
    expect((await fetchCommute(record,destination,'synthetic-key',new AbortController().signal)).totalMinutes).toBe(26)
    vi.mocked(requestApi).mockResolvedValue({status:'NO_RESULTS'})
    await expect(fetchCommute(record,destination,'test',new AbortController().signal)).rejects.toMatchObject({kind:'no-route'})
  })
})
