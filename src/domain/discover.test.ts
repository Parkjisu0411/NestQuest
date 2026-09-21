import { describe, expect, test } from 'vitest'
import { eokToWon } from './calculations.ts'
import {
  discoverApartments,
  listQuestHomeMatches,
  type DiscoverableApartment,
} from './discover.ts'
import type {
  ApartmentUnitType,
  CommuteEstimate,
  CommuteDestination,
  QuestArea,
  QuestState,
  SearchCriteria,
} from './models.ts'

const AS_OF = new Date(2026, 8, 16)

const GANGSEO: QuestArea = {
  sidoCode: '11',
  sidoName: '서울특별시',
  sigunguCode: '11500',
  sigunguName: '강서구',
}

const YEONGDEUNGPO: QuestArea = {
  sidoCode: '11',
  sidoName: '서울특별시',
  sigunguCode: '11560',
  sigunguName: '영등포구',
}

const YEOUIDO: CommuteDestination = {
  id: 'yeouido',
  name: '여의도',
  latitude: 37.5219,
  longitude: 126.9245,
}

function criteria(overrides: Partial<SearchCriteria> = {}): SearchCriteria {
  return {
    areas: [GANGSEO],
    availableCash: eokToWon(3),
    expectedLoanLimit: eokToWon(5),
    minExclusiveArea: 59,
    maxBuildingAge: 20,
    minHouseholdCount: 300,
    commuteDestination: YEOUIDO,
    maxCommuteMinutes: 60,
    ...overrides,
  }
}

function commute(apartmentId: string, totalMinutes: number): CommuteEstimate {
  return {
    apartmentId,
    destinationId: 'yeouido',
    totalMinutes,
    route: [{ type: 'SUBWAY', durationMinutes: totalMinutes }],
    provider: 'mock',
    calculatedAt: '2026-09-01',
  }
}

function unit(
  apartmentId: string,
  areaGroup: number,
  exclusiveArea: number,
  estimatedPrice: number,
): ApartmentUnitType {
  const id = `${apartmentId}-${areaGroup}`
  return {
    id,
    apartmentId,
    areaGroup,
    exclusiveAreas: [exclusiveArea],
    priceEstimate: {
      apartmentId,
      unitTypeId: id,
      estimatedPrice,
      lowPrice: estimatedPrice,
      highPrice: estimatedPrice,
      latestPrice: estimatedPrice,
      transactionCount: 4,
      periodMonths: 6,
      confidence: 'MEDIUM',
      calculatedAt: '2026-09-01',
    },
  }
}

function record(
  id: string,
  overrides: {
    area?: QuestArea
    approvalDate?: string
    householdCount?: number
    units?: ApartmentUnitType[]
    commuteMinutes?: number
  } = {},
): DiscoverableApartment {
  return {
    apartment: {
      id,
      name: id,
      address: '서울특별시 강서구',
      latitude: 37.56,
      longitude: 126.83,
      approvalDate: overrides.approvalDate ?? '2014-08-20',
      householdCount: overrides.householdCount ?? 1000,
      createdAt: '2026-09-01',
      updatedAt: '2026-09-01',
    },
    area: overrides.area ?? GANGSEO,
    unitTypes: overrides.units ?? [unit(id, 59, 59.12, eokToWon(7.6))],
    commutes: [commute(id, overrides.commuteMinutes ?? 40)],
  }
}

describe('discoverApartments', () => {
  test('keeps a complex that passes every hard filter', () => {
    const matches = discoverApartments([record('pass')], criteria(), AS_OF)
    expect(matches.map((item) => item.apartment.id)).toEqual(['pass'])
    expect(matches[0]?.nearBudget).toBe(false)
    expect(matches[0]?.purchaseBudget).toBe(eokToWon(8))
  })

  test('keeps a complex in the +5% Discover budget buffer and labels it near budget', () => {
    const matches = discoverApartments(
      [record('buffer', { units: [unit('buffer', 59, 59.1, eokToWon(8.2))] })],
      criteria(),
      AS_OF,
    )
    expect(matches).toHaveLength(1)
    expect(matches[0]?.nearBudget).toBe(true)
    expect(matches[0]?.purchaseBudget).toBe(eokToWon(8))
  })

  test('excludes a complex above the Discover budget ceiling', () => {
    const matches = discoverApartments(
      [record('over', { units: [unit('over', 59, 59.1, eokToWon(8.5))] })],
      criteria(),
      AS_OF,
    )
    expect(matches).toEqual([])
  })

  test('does not change the user purchase budget when applying the buffer', () => {
    const matches = discoverApartments(
      [record('buffer', { units: [unit('buffer', 59, 59.1, eokToWon(8.2))] })],
      criteria(),
      AS_OF,
    )
    expect(matches[0]?.purchaseBudget).toBe(eokToWon(8))
  })

  test('keeps unit types at or above the minimum exclusive area', () => {
    const mixed = record('mixed', {
      units: [
        unit('mixed', 49, 48.85, eokToWon(6.8)),
        unit('mixed', 59, 59.12, eokToWon(7.6)),
        unit('mixed', 84, 84.91, eokToWon(9.8)),
      ],
    })
    const matches = discoverApartments([mixed], criteria(), AS_OF)
    expect(matches[0]?.eligibleUnitTypes.map((item) => item.areaGroup)).toEqual([59])
  })

  test('excludes a complex whose units are all below the minimum exclusive area', () => {
    const matches = discoverApartments(
      [record('small', { units: [unit('small', 49, 48.85, eokToWon(6.5))] })],
      criteria(),
      AS_OF,
    )
    expect(matches).toEqual([])
  })

  test('excludes a complex older than the maximum building age', () => {
    const matches = discoverApartments(
      [record('old', { approvalDate: '2005-08-01' })],
      criteria(),
      AS_OF,
    )
    expect(matches).toEqual([])
  })

  test('keeps a complex at the maximum building age', () => {
    const matches = discoverApartments(
      [record('edge-age', { approvalDate: '2006-09-16' })],
      criteria(),
      AS_OF,
    )
    expect(matches).toHaveLength(1)
  })

  test('excludes a complex below the minimum household count', () => {
    const matches = discoverApartments(
      [record('small-complex', { householdCount: 299 })],
      criteria(),
      AS_OF,
    )
    expect(matches).toEqual([])
  })

  test('keeps a complex at the minimum household count', () => {
    const matches = discoverApartments(
      [record('min-hh', { householdCount: 300 })],
      criteria(),
      AS_OF,
    )
    expect(matches).toHaveLength(1)
  })

  test('excludes a complex over the maximum commute time', () => {
    const matches = discoverApartments(
      [record('far', { commuteMinutes: 61 })],
      criteria(),
      AS_OF,
    )
    expect(matches).toEqual([])
  })

  test('keeps a complex at the maximum commute time', () => {
    const matches = discoverApartments(
      [record('edge-commute', { commuteMinutes: 60 })],
      criteria(),
      AS_OF,
    )
    expect(matches).toHaveLength(1)
  })

  test('excludes a complex outside the selected search areas', () => {
    const matches = discoverApartments(
      [record('other-gu', { area: YEONGDEUNGPO })],
      criteria(),
      AS_OF,
    )
    expect(matches).toEqual([])
  })
})

describe('optional hard filters', () => {
  test('does not filter by price when budget is absent', () => {
    const matches = discoverApartments(
      [record('pricey', { units: [unit('pricey', 59, 59.1, eokToWon(20))] })],
      criteria({
        availableCash: undefined,
        expectedLoanLimit: undefined,
      }),
      AS_OF,
    )
    expect(matches.map((item) => item.apartment.id)).toEqual(['pricey'])
    expect(matches[0]?.purchaseBudget).toBeUndefined()
    expect(matches[0]?.nearBudget).toBe(false)
  })

  test('does not filter by exclusive area when the minimum is omitted', () => {
    const matches = discoverApartments(
      [record('small', { units: [unit('small', 49, 48.85, eokToWon(6.5))] })],
      criteria({ minExclusiveArea: undefined }),
      AS_OF,
    )
    expect(matches.map((item) => item.apartment.id)).toEqual(['small'])
  })

  test('does not filter by building age when the maximum is omitted', () => {
    const matches = discoverApartments(
      [record('old', { approvalDate: '2005-08-01' })],
      criteria({ maxBuildingAge: undefined }),
      AS_OF,
    )
    expect(matches.map((item) => item.apartment.id)).toEqual(['old'])
  })

  test('does not filter by household count when the minimum is omitted', () => {
    const matches = discoverApartments(
      [record('small-complex', { householdCount: 80 })],
      criteria({ minHouseholdCount: undefined }),
      AS_OF,
    )
    expect(matches.map((item) => item.apartment.id)).toEqual(['small-complex'])
  })

  test('does not filter by commute time when the maximum is omitted', () => {
    const matches = discoverApartments(
      [record('far', { commuteMinutes: 95 })],
      criteria({ maxCommuteMinutes: undefined }),
      AS_OF,
    )
    expect(matches.map((item) => item.apartment.id)).toEqual(['far'])
    expect(matches[0]?.commute?.totalMinutes).toBe(95)
  })

  test('does not require a commute destination', () => {
    const matches = discoverApartments(
      [record('kept'), record('far', { commuteMinutes: 95 })],
      criteria({
        commuteDestination: undefined,
        maxCommuteMinutes: undefined,
      }),
      AS_OF,
    )
    expect(matches.map((item) => item.apartment.id).sort()).toEqual(['far', 'kept'])
    expect(matches.every((item) => item.commute === undefined)).toBe(true)
  })

  test('shows commute without filtering when only a destination exists', () => {
    const matches = discoverApartments(
      [record('far', { commuteMinutes: 95 })],
      criteria({ maxCommuteMinutes: undefined }),
      AS_OF,
    )
    expect(matches[0]?.commute?.totalMinutes).toBe(95)
  })

  test('does not apply max commute without a destination', () => {
    const matches = discoverApartments(
      [record('far', { commuteMinutes: 95 })],
      criteria({
        commuteDestination: undefined,
        maxCommuteMinutes: 30,
      }),
      AS_OF,
    )
    expect(matches.map((item) => item.apartment.id)).toEqual(['far'])
    expect(matches[0]?.commute).toBeUndefined()
  })

  test('filters by max commute when both destination and maximum exist', () => {
    const matches = discoverApartments(
      [record('kept'), record('far', { commuteMinutes: 95 })],
      criteria({ maxCommuteMinutes: 60 }),
      AS_OF,
    )
    expect(matches.map((item) => item.apartment.id)).toEqual(['kept'])
  })

  test('applies only the criteria that were entered', () => {
    const matches = discoverApartments(
      [
        record('fits', { units: [unit('fits', 59, 59.1, eokToWon(7.6))] }),
        record('small', { units: [unit('small', 49, 48.85, eokToWon(6.5))] }),
        record('old', { approvalDate: '2005-08-01' }),
        record('tiny-complex', { householdCount: 80 }),
        record('far', { commuteMinutes: 95 }),
      ],
      criteria({
        maxBuildingAge: undefined,
        minHouseholdCount: undefined,
        maxCommuteMinutes: undefined,
      }),
      AS_OF,
    )
    expect(matches.map((item) => item.apartment.id).sort()).toEqual([
      'far',
      'fits',
      'old',
      'tiny-complex',
    ])
  })
})

describe('listQuestHomeMatches', () => {
  test('drops DISCOVERED complexes that no longer pass hard filters', () => {
    const records = [record('kept'), record('old', { approvalDate: '2005-08-01' })]
    const states: Record<string, QuestState> = {
      kept: questState('kept', 'DISCOVERED'),
      old: questState('old', 'DISCOVERED'),
    }

    const matches = listQuestHomeMatches(records, criteria(), states, AS_OF)
    expect(matches.map((item) => item.apartment.id)).toEqual(['kept'])
  })

  test('keeps CANDIDATE, VISITED, and SHORTLIST complexes that fail hard filters', () => {
    const records = [
      record('kept'),
      record('candidate', { area: YEONGDEUNGPO }),
      record('visited', { commuteMinutes: 90 }),
      record('shortlist', { householdCount: 80 }),
    ]
    const states: Record<string, QuestState> = {
      kept: questState('kept', 'DISCOVERED'),
      candidate: questState('candidate', 'CANDIDATE'),
      visited: questState('visited', 'VISITED'),
      shortlist: questState('shortlist', 'SHORTLIST'),
    }

    const matches = listQuestHomeMatches(records, criteria(), states, AS_OF)
    expect(matches.map((item) => item.apartment.id).sort()).toEqual([
      'candidate',
      'kept',
      'shortlist',
      'visited',
    ])
  })
})

function questState(
  apartmentId: string,
  stage: QuestState['stage'],
): QuestState {
  return {
    questId: 'quest',
    apartmentId,
    stage,
    targetUnitTypeIds: [],
    updatedAt: '2026-09-01T00:00:00.000Z',
  }
}
