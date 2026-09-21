import { describe, expect, it } from 'vitest'
import { classifyFilterResult, discoverApartments, listQuestHomeMatches } from './discover.ts'
import { mapSeoulApartment } from '../data/providers/publicData.ts'
import { attachDistrictTrades, type TradeRow } from '../data/providers/enrich.ts'
import type { SearchCriteria } from './models.ts'

const now = '2026-09-21T00:00:00.000Z'
const raw = mapSeoulApartment({kaptCode:'TEST',kaptName:'테스트아파트',kaptAddr:'서울특별시 영등포구 여의도동 1',bjdCode:'1156011000'},now)
const criteria: SearchCriteria = { areas:[raw.area],availableCash:500_000_000,minExclusiveArea:59 }
const row: TradeRow = {aptSeq:'11560-test',name:'테스트',districtCode:'11560',dong:'여의도동',lot:'1',transaction:{id:'rtms:11560-test:1',exclusiveArea:84,price:800_000_000,contractDate:'2026-08-01',canceled:false}}

describe('filter results before and after API hydration', () => {
  it('distinguishes unknowns included by policy from confirmed matches', () => {
    expect(discoverApartments([raw],criteria)).toHaveLength(1)
    expect(classifyFilterResult(raw,criteria)).toBe('unknown')
    expect(discoverApartments([raw],{...criteria,includeUnknown:false})).toHaveLength(0)
  })
  it('removes an over-budget apartment as soon as actual trades arrive', () => {
    const [priced] = attachDistrictTrades([raw],[row],now)
    expect(priced.unitTypes[0].priceEstimate?.estimatedPrice).toBe(800_000_000)
    expect(discoverApartments([priced],criteria)).toHaveLength(0)
    expect(discoverApartments([priced],{...criteria,availableCash:900_000_000,includeUnknown:false})).toHaveLength(1)
    expect(classifyFilterResult(priced,{...criteria,availableCash:900_000_000})).toBe('confirmed')
  })
  it('checks region, households, age, area and commute independently', () => {
    const [priced] = attachDistrictTrades([raw],[row],now)
    const record = {...priced,apartment:{...priced.apartment,householdCount:200,approvalDate:'2000-01-01'},commutes:[{apartmentId:raw.apartment.id,destinationId:'work',totalMinutes:70,route:[],provider:'test',calculatedAt:now}]}
    const base = {areas:[raw.area]}
    for (const condition of [{areas:[]},{minHouseholdCount:300},{maxBuildingAge:10},{minExclusiveArea:90},{commuteDestination:{id:'work',name:'출근역',latitude:37.5,longitude:127},maxCommuteMinutes:60}]) {
      expect(discoverApartments([record],{...base,...condition})).toHaveLength(0)
    }
  })
  it('retains a saved candidate without claiming it satisfies the filter', () => {
    const [priced] = attachDistrictTrades([raw],[row],now)
    const states = {[raw.apartment.id]:{questId:'q',apartmentId:raw.apartment.id,stage:'CANDIDATE' as const,targetUnitTypeIds:[],updatedAt:now}}
    expect(listQuestHomeMatches([priced],criteria,states)).toHaveLength(1)
    expect(classifyFilterResult(priced,criteria)).toBe('retained')
  })
})
