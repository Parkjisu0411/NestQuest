import { describe, expect, test } from 'vitest'
import { eokToWon } from './calculations.ts'
import type { SearchCriteria } from './models.ts'
import {
  formatCommuteSummary,
  withBudget,
  withCommute,
  withOptionalField,
} from './searchCriteria.ts'

const AREAS: SearchCriteria['areas'] = [
  {
    sidoCode: '11',
    sidoName: '서울특별시',
    sigunguCode: '11560',
    sigunguName: '영등포구',
  },
]

const YEOUIDO = {
  id: 'yeouido',
  name: '여의도',
  latitude: 37.5219,
  longitude: 126.9245,
}

function criteria(overrides: Partial<SearchCriteria> = {}): SearchCriteria {
  return {
    areas: AREAS,
    availableCash: eokToWon(3),
    expectedLoanLimit: eokToWon(5),
    minExclusiveArea: 59,
    commuteDestination: YEOUIDO,
    maxCommuteMinutes: 60,
    ...overrides,
  }
}

describe('withOptionalField', () => {
  test('omits a cleared criterion instead of storing a sentinel', () => {
    const next = withOptionalField(criteria(), 'minExclusiveArea', undefined)
    expect(next.minExclusiveArea).toBeUndefined()
    expect('minExclusiveArea' in next).toBe(false)
  })
})

describe('withBudget', () => {
  test('can clear both budget inputs', () => {
    const next = withBudget(criteria(), undefined, undefined)
    expect(next.availableCash).toBeUndefined()
    expect(next.expectedLoanLimit).toBeUndefined()
    expect('availableCash' in next).toBe(false)
    expect('expectedLoanLimit' in next).toBe(false)
  })
})

describe('withCommute', () => {
  test('clears destination and max minutes together', () => {
    const next = withCommute(criteria(), undefined, 45)
    expect(next.commuteDestination).toBeUndefined()
    expect(next.maxCommuteMinutes).toBeUndefined()
    expect('commuteDestination' in next).toBe(false)
    expect('maxCommuteMinutes' in next).toBe(false)
  })

  test('keeps a destination without a time filter', () => {
    const next = withCommute(criteria(), YEOUIDO, undefined)
    expect(next.commuteDestination).toEqual(YEOUIDO)
    expect(next.maxCommuteMinutes).toBeUndefined()
  })
})

describe('formatCommuteSummary', () => {
  test('uses 설정 안 함 when no destination exists', () => {
    expect(
      formatCommuteSummary(
        criteria({
          commuteDestination: undefined,
          maxCommuteMinutes: 60,
        }),
      ),
    ).toBe('설정 안 함')
  })

  test('shows destination only or destination with a time cap', () => {
    expect(formatCommuteSummary(criteria({ maxCommuteMinutes: undefined }))).toBe(
      '여의도',
    )
    expect(formatCommuteSummary(criteria())).toBe('여의도 · 60분')
  })
})
