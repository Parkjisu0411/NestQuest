import { describe, expect, it } from 'vitest'
import { seoulLotAddress, comparableApartmentName } from './address.ts'
import { attachTrades } from './enrich.ts'
import { mapSeoulApartment } from './publicData.ts'

describe('public apartment address variations', () => {
  it('removes a building suffix without losing the legal sub-lot', () => {
    expect(seoulLotAddress('서울특별시 영등포구 영등포동 648 시험아파트')).toBe('서울특별시 영등포구 영등포동 648')
    expect(seoulLotAddress('서울 영등포구 영등포동1가 094-02 시험')).toBe('서울특별시 영등포구 영등포동1가 94-2')
    expect(seoulLotAddress('서울시 종로구 평창동 산 1-2')).toBe('서울특별시 종로구 평창동 산1-2')
  })
  it('rejects incomplete lots and never treats a road number as a legal lot', () => {
    for (const input of ['서울특별시 영등포구 영등포동2가 439- 시험','서울특별시 영등포구 신길로60나길 9','서울특별시 영등포구 영등포동']) expect(seoulLotAddress(input)).toBeNull()
    expect(seoulLotAddress('서울특별시 영등포구 영등포동 94-2')).not.toBe(seoulLotAddress('서울특별시 영등포구 영등포동 94'))
  })
  it('allows only the cosmetic apartment suffix, retaining complex numbers and prefixes', () => {
    expect(comparableApartmentName('시험 아파트')).toBe('시험')
    expect(comparableApartmentName('시험1차아파트')).not.toBe(comparableApartmentName('시험2차'))
    expect(comparableApartmentName('영등포시험')).not.toBe(comparableApartmentName('시험'))
  })
  it('matches a display address with a building suffix but rejects a different lot', () => {
    const now='2026-09-18T00:00:00.000Z'
    const record=mapSeoulApartment({kaptCode:'TEST',kaptName:'시험아파트',kaptAddr:'서울특별시 영등포구 영등포동 648 시험아파트',bjdCode:'1156010100'},now)
    const trade={aptSeq:'11560-test',name:'시험',districtCode:'11560',dong:'영등포동',lot:'648',transaction:{id:'rtms:11560-test:1',exclusiveArea:84,price:1000000000,contractDate:'2026-08-01',canceled:false}}
    expect(attachTrades(record,[trade],now).unitTypes).toHaveLength(1)
    expect(attachTrades(record,[{...trade,lot:'648-1'}],now).unitTypes).toHaveLength(0)
  })
})
