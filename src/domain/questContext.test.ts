import { describe, expect, test } from 'vitest'
import { eokToWon } from './calculations.ts'
import { formatAreaSummary, formatQuestContext } from './questContext.ts'
import type { QuestArea, SearchCriteria } from './models.ts'

const SEOUL: QuestArea = {
  sidoCode: '11',
  sidoName: '서울특별시',
  sigunguCode: '11560',
  sigunguName: '영등포구',
}

const MAPO: QuestArea = {
  ...SEOUL,
  sigunguCode: '11440',
  sigunguName: '마포구',
}

const GANGSEO: QuestArea = {
  ...SEOUL,
  sigunguCode: '11500',
  sigunguName: '강서구',
}

const DONGJAK: QuestArea = {
  ...SEOUL,
  sigunguCode: '11590',
  sigunguName: '동작구',
}

const GOYANG: QuestArea = {
  sidoCode: '41',
  sidoName: '경기도',
  sigunguCode: '41280',
  sigunguName: '고양시',
}

const AVAILABILITY = [
  { sidoCode: '11', label: '서울', total: 12 },
  { sidoCode: '41', label: '경기', total: 5 },
]

describe('formatAreaSummary', () => {
  test('summarizes a full sido selection as 전체', () => {
    const seoulAll = Array.from({ length: 12 }, (_, index) => ({
      ...SEOUL,
      sigunguCode: `11-${index}`,
      sigunguName: `구${index}`,
    }))
    expect(formatAreaSummary(seoulAll, AVAILABILITY)).toBe('서울 전체')
  })

  test('summarizes many districts by count', () => {
    expect(
      formatAreaSummary([SEOUL, MAPO, GANGSEO, DONGJAK], AVAILABILITY),
    ).toBe('서울 4개 지역')
  })

  test('lists a few districts in one sido', () => {
    expect(formatAreaSummary([SEOUL, MAPO], AVAILABILITY)).toBe('영등포 · 마포')
  })

  test('combines sido counts', () => {
    expect(
      formatAreaSummary([SEOUL, MAPO, GANGSEO, DONGJAK, GOYANG], AVAILABILITY),
    ).toBe('서울 4개 · 경기 1개 지역')
  })
})

describe('formatQuestContext', () => {
  test('shows only criteria that exist', () => {
    const criteria: SearchCriteria = {
      areas: [SEOUL],
      minExclusiveArea: 59,
    }
    expect(formatQuestContext(criteria, AVAILABILITY)).toBe('영등포 · 59㎡ 이상')
  })

  test('includes budget and commute only when configured', () => {
    const criteria: SearchCriteria = {
      areas: [SEOUL],
      availableCash: eokToWon(3),
      expectedLoanLimit: eokToWon(5),
      commuteDestination: {
        id: 'yeouido',
        name: '여의도',
        latitude: 37.52,
        longitude: 126.92,
      },
      maxCommuteMinutes: 60,
    }
    expect(formatQuestContext(criteria, AVAILABILITY)).toBe(
      '영등포 · 예산 8억 · 여의도 60분',
    )
  })

  test('shows destination without a commute-time filter', () => {
    const criteria: SearchCriteria = {
      areas: [SEOUL],
      commuteDestination: {
        id: 'yeouido',
        name: '여의도',
        latitude: 37.52,
        longitude: 126.92,
      },
    }
    expect(formatQuestContext(criteria, AVAILABILITY)).toBe('영등포 · 여의도')
  })

  test('omits commute when destination is missing even if minutes exist', () => {
    const criteria: SearchCriteria = {
      areas: [SEOUL],
      maxCommuteMinutes: 60,
    }
    expect(formatQuestContext(criteria, AVAILABILITY)).toBe('영등포')
  })
})
