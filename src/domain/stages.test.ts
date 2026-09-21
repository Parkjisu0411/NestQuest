import { describe, expect, test } from 'vitest'
import {
  isStageVisible,
  QUEST_STAGE_LABELS,
  STAGE_FILTERS,
  stageAfterVisit,
} from './stages.ts'

describe('isStageVisible', () => {
  test('전체 shows active stages but hides PASSED by default', () => {
    expect(isStageVisible('DISCOVERED', 'all', false)).toBe(true)
    expect(isStageVisible('CANDIDATE', 'all', false)).toBe(true)
    expect(isStageVisible('VISITED', 'all', false)).toBe(true)
    expect(isStageVisible('SHORTLIST', 'all', false)).toBe(true)
    expect(isStageVisible('PASSED', 'all', false)).toBe(false)
  })

  test('관심 starts from CANDIDATE and does not include DISCOVERED', () => {
    expect(isStageVisible('DISCOVERED', 'candidate', false)).toBe(false)
    expect(isStageVisible('CANDIDATE', 'candidate', false)).toBe(true)
    expect(isStageVisible('VISITED', 'candidate', false)).toBe(true)
    expect(isStageVisible('SHORTLIST', 'candidate', false)).toBe(true)
  })

  test('다녀온 집 and 최종 후보 narrow the later stages', () => {
    expect(isStageVisible('CANDIDATE', 'visited', false)).toBe(false)
    expect(isStageVisible('VISITED', 'visited', false)).toBe(true)
    expect(isStageVisible('SHORTLIST', 'visited', false)).toBe(false)
    expect(isStageVisible('SHORTLIST', 'visited', false, true)).toBe(true)
    expect(isStageVisible('VISITED', 'shortlist', false)).toBe(false)
    expect(isStageVisible('SHORTLIST', 'shortlist', false)).toBe(true)
  })

  test('showPassed reveals PASSED without making it a Stage Filter', () => {
    expect(isStageVisible('PASSED', 'all', true)).toBe(true)
    expect(isStageVisible('PASSED', 'shortlist', true)).toBe(true)
    expect(isStageVisible('DISCOVERED', 'all', true)).toBe(true)
  })
})

describe('user-facing stage filters', () => {
  test('keep internal ids while showing the new labels', () => {
    expect(STAGE_FILTERS).toEqual([
      { id: 'all', label: '전체' },
      { id: 'candidate', label: '관심' },
      { id: 'visited', label: '다녀온 집' },
      { id: 'shortlist', label: '최종 후보' },
    ])
  })

  test('maps internal stages to browsing labels without renaming enums', () => {
    expect(QUEST_STAGE_LABELS).toEqual({
      DISCOVERED: '',
      CANDIDATE: '관심',
      VISITED: '다녀온 집',
      SHORTLIST: '★ 최종 후보',
      PASSED: '제외한 집',
    })
  })
})

describe('stageAfterVisit', () => {
  test('moves DISCOVERED and CANDIDATE to VISITED', () => {
    expect(stageAfterVisit('DISCOVERED')).toBe('VISITED')
    expect(stageAfterVisit('CANDIDATE')).toBe('VISITED')
    expect(stageAfterVisit('VISITED')).toBe('VISITED')
  })

  test('does not change SHORTLIST or PASSED', () => {
    expect(stageAfterVisit('SHORTLIST')).toBe('SHORTLIST')
    expect(stageAfterVisit('PASSED')).toBe('PASSED')
  })
})
