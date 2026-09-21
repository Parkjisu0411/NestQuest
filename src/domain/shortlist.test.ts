import { describe, expect, test } from 'vitest'
import type { QuestState } from './models.ts'
import {
  addToShortlist,
  listedShortlist,
  moveShortlist,
  removeFromShortlist,
  setShortlistMemo,
  withNormalizedShortlistRanks,
} from './shortlist.ts'

const NOW = '2026-09-16T04:00:00.000Z'

function state(
  apartmentId: string,
  stage: QuestState['stage'],
  extras: Partial<QuestState> = {},
): QuestState {
  return {
    questId: 'quest',
    apartmentId,
    stage,
    targetUnitTypeIds: [],
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...extras,
  }
}

describe('addToShortlist', () => {
  test('moves VISITED to SHORTLIST and appends the next rank', () => {
    const states = {
      a: state('a', 'SHORTLIST', { shortlistRank: 1 }),
      b: state('b', 'VISITED'),
    }

    const next = addToShortlist(states, 'b', NOW)
    expect(next.b?.stage).toBe('SHORTLIST')
    expect(next.b?.shortlistRank).toBe(2)
    expect(next.a?.shortlistRank).toBe(1)
  })

  test('allows a DISCOVERED apartment before a visit', () => {
    const states = { a: state('a', 'DISCOVERED') }
    expect(addToShortlist(states, 'a', NOW).a.stage).toBe('SHORTLIST')
  })
})

describe('removeFromShortlist', () => {
  test('returns SHORTLIST to VISITED and keeps memo and visits elsewhere', () => {
    const states = {
      a: state('a', 'SHORTLIST', { shortlistRank: 1, shortlistMemo: '출퇴근 우선' }),
      b: state('b', 'SHORTLIST', { shortlistRank: 2 }),
    }

    const next = removeFromShortlist(states, 'a', NOW)
    expect(next.a?.stage).toBe('VISITED')
    expect(next.a?.shortlistRank).toBeUndefined()
    expect(next.a?.shortlistMemo).toBe('출퇴근 우선')
    expect(next.b?.shortlistRank).toBe(1)
  })
})

describe('withNormalizedShortlistRanks', () => {
  test('assigns contiguous ranks to existing SHORTLIST apartments', () => {
    const next = withNormalizedShortlistRanks(
      {
        z: state('z', 'SHORTLIST'),
        a: state('a', 'SHORTLIST'),
        v: state('v', 'VISITED'),
      },
      NOW,
    )

    expect(listedShortlist(next).map((item) => item.apartmentId)).toEqual(['a', 'z'])
    expect(next.a?.shortlistRank).toBe(1)
    expect(next.z?.shortlistRank).toBe(2)
    expect(next.v?.shortlistRank).toBeUndefined()
  })
})

describe('moveShortlist', () => {
  test('reorders neighboring apartments and keeps ranks contiguous', () => {
    const states = {
      a: state('a', 'SHORTLIST', { shortlistRank: 1 }),
      b: state('b', 'SHORTLIST', { shortlistRank: 2 }),
      c: state('c', 'SHORTLIST', { shortlistRank: 3 }),
    }

    const down = moveShortlist(states, 'a', 'down', NOW)
    expect(listedShortlist(down).map((item) => item.apartmentId)).toEqual([
      'b',
      'a',
      'c',
    ])
    expect(down.b?.shortlistRank).toBe(1)
    expect(down.a?.shortlistRank).toBe(2)
    expect(down.c?.shortlistRank).toBe(3)

    const up = moveShortlist(down, 'c', 'up', NOW)
    expect(listedShortlist(up).map((item) => item.apartmentId)).toEqual([
      'b',
      'c',
      'a',
    ])
  })

  test('ignores a move past the ends', () => {
    const states = {
      a: state('a', 'SHORTLIST', { shortlistRank: 1 }),
      b: state('b', 'SHORTLIST', { shortlistRank: 2 }),
    }
    expect(moveShortlist(states, 'a', 'up', NOW)).toBe(states)
    expect(moveShortlist(states, 'b', 'down', NOW)).toBe(states)
  })
})

describe('listedShortlist', () => {
  test('keeps manual rank order instead of apartment id', () => {
    const states = {
      z: state('z', 'SHORTLIST', { shortlistRank: 1 }),
      a: state('a', 'SHORTLIST', { shortlistRank: 2 }),
    }
    expect(listedShortlist(states).map((item) => item.apartmentId)).toEqual([
      'z',
      'a',
    ])
  })
})

describe('setShortlistMemo', () => {
  test('stores a trimmed memo on a SHORTLIST apartment', () => {
    const states = { a: state('a', 'SHORTLIST', { shortlistRank: 1 }) }
    const next = setShortlistMemo(states, 'a', '  출퇴근 우선  ', NOW)
    expect(next.a?.shortlistMemo).toBe('출퇴근 우선')
  })
})
