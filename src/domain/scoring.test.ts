import { describe, expect, test } from 'vitest'
import type {
  EvaluationAdjustment,
  EvaluationPriorities,
  UserEvaluation,
} from './models.ts'
import { calculateMyScore } from './scoring.ts'

const PRIORITIES: EvaluationPriorities = {
  stationAccess: 3,
  commuteFeel: 4,
  commercial: 2,
  school: 0,
  nature: 3,
  neighborhood: 4,
}

function evaluation(
  ratings: Partial<UserEvaluation['ratings']> = {},
  adjustments: EvaluationAdjustment[] = [],
): UserEvaluation {
  return {
    questId: 'quest',
    apartmentId: 'apt',
    ratings: {
      stationAccess: null,
      commuteFeel: null,
      commercial: null,
      school: null,
      nature: null,
      neighborhood: null,
      ...ratings,
    },
    adjustments,
    updatedAt: '2026-09-16T00:00:00.000Z',
  }
}

function factor(
  type: EvaluationAdjustment['type'],
  impact: EvaluationAdjustment['impact'],
  id: string,
): EvaluationAdjustment {
  return {
    id,
    type,
    description: id,
    impact,
    createdAt: '2026-09-16T00:00:00.000Z',
  }
}

describe('calculateMyScore', () => {
  test('returns undefined when there is no Visit', () => {
    expect(
      calculateMyScore({
        hasVisit: false,
        evaluation: evaluation({ stationAccess: 5 }),
        priorities: PRIORITIES,
      }),
    ).toBeUndefined()
  })

  test('returns undefined when every rating is null', () => {
    expect(
      calculateMyScore({
        hasVisit: true,
        evaluation: evaluation(),
        priorities: PRIORITIES,
      }),
    ).toBeUndefined()
  })

  test('returns undefined when the only rated metric has priority 0', () => {
    expect(
      calculateMyScore({
        hasVisit: true,
        evaluation: evaluation({ school: 5 }),
        priorities: PRIORITIES,
      }),
    ).toBeUndefined()
  })

  test('computes the documented weighted average', () => {
    const score = calculateMyScore({
      hasVisit: true,
      evaluation: evaluation({
        stationAccess: 4,
        commuteFeel: 5,
        commercial: 4,
        school: null,
        nature: 3,
        neighborhood: 5,
      }),
      priorities: PRIORITIES,
    })

    expect(score).toBeCloseTo(4.3125, 10)
  })

  test('excludes a null rating from the weighted average', () => {
    const score = calculateMyScore({
      hasVisit: true,
      evaluation: evaluation({
        stationAccess: 4,
        commuteFeel: null,
        commercial: 2,
      }),
      priorities: {
        ...PRIORITIES,
        stationAccess: 1,
        commercial: 1,
        commuteFeel: 4,
      },
    })

    expect(score).toBe(3)
  })

  test('excludes a rated metric whose priority is 0', () => {
    const score = calculateMyScore({
      hasVisit: true,
      evaluation: evaluation({
        stationAccess: 2,
        school: 5,
      }),
      priorities: {
        ...PRIORITIES,
        stationAccess: 2,
        school: 0,
      },
    })

    expect(score).toBe(2)
  })

  test('ignores the legacy positive impact', () => {
    const score = calculateMyScore({
      hasVisit: true,
      evaluation: evaluation({ stationAccess: 3 }, [
        factor('POSITIVE', 'LARGE', 'plus'),
      ]),
      priorities: { ...PRIORITIES, stationAccess: 2 },
    })

    expect(score).toBe(3)
  })

  test('ignores the legacy negative impact', () => {
    const score = calculateMyScore({
      hasVisit: true,
      evaluation: evaluation({ stationAccess: 3 }, [
        factor('NEGATIVE', 'SMALL', 'minus'),
      ]),
      priorities: { ...PRIORITIES, stationAccess: 2 },
    })

    expect(score).toBe(3)
  })

  test('multiple positive notes do not raise the score', () => {
    const score = calculateMyScore({
      hasVisit: true,
      evaluation: evaluation({ stationAccess: 3 }, [
        factor('POSITIVE', 'DECISIVE', 'a'),
        factor('POSITIVE', 'DECISIVE', 'b'),
        factor('POSITIVE', 'LARGE', 'c'),
      ]),
      priorities: { ...PRIORITIES, stationAccess: 2 },
    })

    expect(score).toBe(3)
  })

  test('multiple negative notes do not lower the score', () => {
    const score = calculateMyScore({
      hasVisit: true,
      evaluation: evaluation({ stationAccess: 3 }, [
        factor('NEGATIVE', 'DECISIVE', 'a'),
        factor('NEGATIVE', 'DECISIVE', 'b'),
        factor('NEGATIVE', 'LARGE', 'c'),
      ]),
      priorities: { ...PRIORITIES, stationAccess: 2 },
    })

    expect(score).toBe(3)
  })

  test('a maximum rating stays at 5 with legacy notes', () => {
    const score = calculateMyScore({
      hasVisit: true,
      evaluation: evaluation({ stationAccess: 5 }, [
        factor('POSITIVE', 'DECISIVE', 'a'),
      ]),
      priorities: { ...PRIORITIES, stationAccess: 2 },
    })

    expect(score).toBe(5)
  })

  test('a minimum rating stays at 1 with legacy notes', () => {
    const score = calculateMyScore({
      hasVisit: true,
      evaluation: evaluation({ stationAccess: 1 }, [
        factor('NEGATIVE', 'DECISIVE', 'a'),
      ]),
      priorities: { ...PRIORITIES, stationAccess: 2 },
    })

    expect(score).toBe(1)
  })

  test('adding, editing, and removing qualitative notes preserves the weighted average', () => {
    const note: EvaluationAdjustment = {
      id: 'note', type: 'POSITIVE', description: '산책로가 좋음',
      createdAt: '2026-09-17T00:00:00.000Z',
    }
    for (const notes of [[], [note], [{ ...note, type: 'NEGATIVE' as const, description: '밤에는 어두움' }], []]) {
      expect(calculateMyScore({
        hasVisit: true,
        evaluation: evaluation({ stationAccess: 4, commuteFeel: 3 }, notes),
        priorities: PRIORITIES,
      })).toBeCloseTo(24 / 7, 10)
    }
  })

  test('qualitative notes alone do not create a score', () => {
    expect(calculateMyScore({
      hasVisit: true,
      evaluation: evaluation({}, [factor('POSITIVE', undefined, 'note')]),
      priorities: PRIORITIES,
    })).toBeUndefined()
  })
})
