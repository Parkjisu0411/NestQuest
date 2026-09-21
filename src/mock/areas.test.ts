import { describe, expect, test } from 'vitest'
import {
  GYEONGGI_SIDO_CODE,
  INCHEON_SIDO_CODE,
  SEOUL_SIDO_CODE,
  hasSidoAreas,
  mergeQuestAreas,
  questAreasForSido,
} from './areas.ts'

describe('bulk search-area selection', () => {
  test('selects every available Seoul sigungu', () => {
    const seoul = questAreasForSido(SEOUL_SIDO_CODE)
    expect(seoul.length).toBeGreaterThan(1)
    expect(seoul.every((area) => area.sidoCode === SEOUL_SIDO_CODE)).toBe(true)
  })

  test('selects every available Gyeonggi sigungu', () => {
    const gyeonggi = questAreasForSido(GYEONGGI_SIDO_CODE)
    expect(gyeonggi.length).toBeGreaterThan(1)
    expect(gyeonggi.every((area) => area.sidoCode === GYEONGGI_SIDO_CODE)).toBe(
      true,
    )
  })

  test('does not invent an Incheon bulk action when Incheon is absent', () => {
    expect(hasSidoAreas(INCHEON_SIDO_CODE)).toBe(false)
    expect(questAreasForSido(INCHEON_SIDO_CODE)).toEqual([])
  })

  test('merges bulk selection into individual QuestArea[] state', () => {
    const seoul = questAreasForSido(SEOUL_SIDO_CODE)
    const gangnam = seoul.find((area) => area.sigunguName === '강남구')
    expect(gangnam).toBeDefined()

    const selected = mergeQuestAreas([], seoul)
    const withoutGangnam = selected.filter(
      (area) => area.sigunguCode !== gangnam?.sigunguCode,
    )

    expect(withoutGangnam).toHaveLength(seoul.length - 1)
    expect(
      withoutGangnam.some((area) => area.sigunguCode === gangnam?.sigunguCode),
    ).toBe(false)
  })
})
