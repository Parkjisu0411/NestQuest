import { describe, expect, test, vi } from 'vitest'
import { saveEvaluationChange } from './saveEvaluation.ts'
import { eokToWon } from '../domain/calculations.ts'
import type {
  EvaluationPriorities,
  Quest,
  QuestState,
  SearchCriteria,
  UserEvaluation,
} from '../domain/models.ts'
import { calculateMyScore } from '../domain/scoring.ts'
import {
  initialQuestState,
  questReducer,
  type QuestAppState,
} from './questStore.ts'

const NOW = '2026-09-16T04:00:00.000Z'

const YEONGDEUNGPO = {
  sidoCode: '11',
  sidoName: '서울특별시',
  sigunguCode: '11560',
  sigunguName: '영등포구',
}

const YEOUIDO = {
  id: 'yeouido',
  name: '여의도',
  latitude: 37.5219,
  longitude: 126.9245,
}

const PRIORITIES: EvaluationPriorities = {
  stationAccess: 3,
  commuteFeel: 4,
  commercial: 2,
  school: 0,
  nature: 3,
  neighborhood: 4,
}

function searchCriteria(overrides: Partial<SearchCriteria> = {}): SearchCriteria {
  return {
    areas: [YEONGDEUNGPO],
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

function quest(overrides: Partial<Quest> = {}): Quest {
  return {
    id: 'quest',
    searchCriteria: searchCriteria(),
    evaluationPriorities: PRIORITIES,
    loanAssumption: { annualInterestRate: 0.04, termYears: 30 },
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function evaluation(): UserEvaluation {
  return {
    questId: 'quest',
    apartmentId: 'visited',
    ratings: {
      stationAccess: 4,
      commuteFeel: 5,
      commercial: 3,
      school: 2,
      nature: 4,
      neighborhood: 5,
    },
    adjustments: [],
    updatedAt: NOW,
  }
}

function apartmentState(
  apartmentId: string,
  stage: QuestState['stage'],
): QuestState {
  return {
    questId: 'quest',
    apartmentId,
    stage,
    targetUnitTypeIds: [`${apartmentId}-59`],
    updatedAt: NOW,
  }
}

function appState(overrides: Partial<QuestAppState> = {}): QuestAppState {
  return {
    setupCompleted: true,
    quest: quest(),
    apartmentQuestStates: {
      discovered: apartmentState('discovered', 'DISCOVERED'),
      candidate: apartmentState('candidate', 'CANDIDATE'),
      visited: apartmentState('visited', 'VISITED'),
      shortlist: {
        ...apartmentState('shortlist', 'SHORTLIST'),
        shortlistRank: 1,
        shortlistMemo: '남긴 이유',
      },
    },
    visitsByApartmentId: {
      visited: [
        {
          id: 'visit',
          questId: 'quest',
          apartmentId: 'visited',
          visitedAt: NOW,
          pros: ['밝다'],
          cons: [],
          photos: [],
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    },
    userEvaluations: {
      visited: evaluation(),
    },
    ...overrides,
  }
}

describe('updateQuest', () => {
  test('changes derived My Score without mutating UserEvaluation', () => {
    const state = appState()
    const stored = state.userEvaluations.visited
    const before = calculateMyScore({
      hasVisit: true,
      evaluation: stored,
      priorities: state.quest?.evaluationPriorities ?? PRIORITIES,
    })

    const nextPriorities: EvaluationPriorities = {
      ...PRIORITIES,
      commuteFeel: 1,
      neighborhood: 1,
    }
    const next = questReducer(state, {
      type: 'updateQuest',
      evaluationPriorities: nextPriorities,
    })

    expect(next.userEvaluations).toBe(state.userEvaluations)
    expect(next.userEvaluations.visited).toEqual(stored)
    expect(next.quest?.id).toBe('quest')
    expect(
      calculateMyScore({
        hasVisit: true,
        evaluation: next.userEvaluations.visited,
        priorities: next.quest?.evaluationPriorities ?? PRIORITIES,
      }),
    ).not.toBe(before)
  })

  test('updates search criteria without changing user-managed stages', () => {
    const state = appState()
    const next = questReducer(state, {
      type: 'updateQuest',
      searchCriteria: searchCriteria({ maxCommuteMinutes: 20 }),
    })

    expect(next.quest?.searchCriteria.maxCommuteMinutes).toBe(20)
    expect(next.quest?.id).toBe(state.quest?.id)
    expect(next.apartmentQuestStates).toBe(state.apartmentQuestStates)
    expect(next.apartmentQuestStates.candidate?.stage).toBe('CANDIDATE')
    expect(next.apartmentQuestStates.visited?.stage).toBe('VISITED')
    expect(next.apartmentQuestStates.shortlist?.stage).toBe('SHORTLIST')
    expect(next.apartmentQuestStates.shortlist?.shortlistRank).toBe(1)
    expect(next.apartmentQuestStates.shortlist?.shortlistMemo).toBe('남긴 이유')
    expect(next.visitsByApartmentId).toBe(state.visitsByApartmentId)
  })

  test('clears optional criteria without sentinels or stage resets', () => {
    const state = appState()
    const next = questReducer(state, {
      type: 'updateQuest',
      searchCriteria: {
        areas: [YEONGDEUNGPO],
      },
    })

    expect(next.quest?.searchCriteria).toEqual({ areas: [YEONGDEUNGPO] })
    expect(next.quest?.searchCriteria.minExclusiveArea).toBeUndefined()
    expect(next.quest?.searchCriteria.commuteDestination).toBeUndefined()
    expect(next.quest?.searchCriteria.maxCommuteMinutes).toBeUndefined()
    expect(next.apartmentQuestStates.candidate?.stage).toBe('CANDIDATE')
    expect(next.apartmentQuestStates.visited?.stage).toBe('VISITED')
    expect(next.apartmentQuestStates.shortlist?.stage).toBe('SHORTLIST')
    expect(next.apartmentQuestStates.shortlist?.shortlistRank).toBe(1)
    expect(next.userEvaluations).toBe(state.userEvaluations)
    expect(next.visitsByApartmentId).toBe(state.visitsByApartmentId)
  })

  test('does not create a second Quest', () => {
    const state = appState()
    const next = questReducer(state, {
      type: 'updateQuest',
      loanAssumption: { annualInterestRate: 0.035, termYears: 20 },
    })

    expect(next.quest?.id).toBe('quest')
    expect(next.quest?.createdAt).toBe(NOW)
    expect(next.quest?.loanAssumption).toEqual({
      annualInterestRate: 0.035,
      termYears: 20,
    })
  })
})

describe('questReducer guardrails', () => {
  test('ignores updateQuest before setup', () => {
    expect(
      questReducer(initialQuestState, {
        type: 'updateQuest',
        evaluationPriorities: PRIORITIES,
      }),
    ).toBe(initialQuestState)
  })
})

describe('independent evaluation editing', () => {
  test('updates only the evaluation and leaves all visit history, photos, stages, ranks and priorities intact', () => {
    const state = appState()
    state.apartmentQuestStates.visited = { ...state.apartmentQuestStates.visited, stage: 'SHORTLIST', shortlistRank: 2, shortlistMemo: '내 메모' }
    const changed = { ...evaluation(), ratings: { ...evaluation().ratings, stationAccess: 1 as const } }
    const next = questReducer(state, { type: 'updateEvaluation', evaluation: changed })
    expect(next.userEvaluations.visited).toEqual(changed)
    expect(next.visitsByApartmentId).toBe(state.visitsByApartmentId)
    expect(next.apartmentQuestStates).toBe(state.apartmentQuestStates)
    expect(next.quest).toBe(state.quest)
    expect(state.userEvaluations.visited.ratings.stationAccess).toBe(4)
    expect(calculateMyScore({ hasVisit: true, evaluation: next.userEvaluations.visited, priorities: PRIORITIES }))
      .not.toBe(calculateMyScore({ hasVisit: true, evaluation: state.userEvaluations.visited, priorities: PRIORITIES }))
  })

  test('allows the first evaluation after a visit saved without evaluation', () => {
    const state = appState({ userEvaluations: {} })
    const next = questReducer(state, { type: 'updateEvaluation', evaluation: evaluation() })
    expect(next.userEvaluations.visited).toEqual(evaluation())
    expect(next.visitsByApartmentId.visited).toHaveLength(1)
  })

  test('requires an actual visit in the current quest, regardless of seeded stage', () => {
    const state = appState()
    expect(questReducer(state, { type: 'updateEvaluation', evaluation: { ...evaluation(), apartmentId: 'shortlist' } })).toBe(state)
    expect(questReducer(state, { type: 'updateEvaluation', evaluation: { ...evaluation(), questId: 'other' } })).toBe(state)
    expect(questReducer(initialQuestState, { type: 'updateEvaluation', evaluation: evaluation() })).toBe(initialQuestState)
  })

  test('publishes only after successful persistence and does not write photos', async () => {
    const state = appState()
    let complete!: () => void
    const write = vi.fn(() => new Promise<void>((resolve) => { complete = resolve }))
    const publish = vi.fn()
    const saving = saveEvaluationChange(state, evaluation(), write, publish)
    expect(write).toHaveBeenCalledOnce()
    expect(write.mock.calls[0]).toBeDefined()
    expect(publish).not.toHaveBeenCalled()
    complete()
    await saving
    expect(publish).toHaveBeenCalledOnce()
    expect(state.visitsByApartmentId.visited).toHaveLength(1)
  })

  test('failure does not publish the edit; retry can succeed without adding a visit', async () => {
    const state = appState()
    const changed = { ...evaluation(), ratings: { ...evaluation().ratings, nature: 5 as const } }
    const write = vi.fn().mockRejectedValueOnce(new Error('storage full')).mockResolvedValueOnce(undefined)
    const publish = vi.fn()
    await expect(saveEvaluationChange(state, changed, write, publish)).rejects.toThrow('storage full')
    expect(publish).not.toHaveBeenCalled()
    expect(state.userEvaluations.visited).toEqual(evaluation())
    await saveEvaluationChange(state, changed, write, publish)
    expect(publish).toHaveBeenCalledOnce()
    expect(write.mock.calls[1][0].visitsByApartmentId).toBe(state.visitsByApartmentId)
  })

  test('invalid evaluation attempts never reach persistence', async () => {
    const write = vi.fn()
    const publish = vi.fn()
    await expect(saveEvaluationChange(appState({ visitsByApartmentId: {} }), evaluation(), write, publish)).rejects.toThrow('방문 기록')
    expect(write).not.toHaveBeenCalled()
    expect(publish).not.toHaveBeenCalled()
  })
})

describe('exclude and restore apartments', () => {
  const base = (): QuestAppState => ({
    ...initialQuestState, setupCompleted: true, quest: quest(),
    apartmentQuestStates: {
      first: { ...apartmentState('first', 'SHORTLIST'), shortlistRank: 1, shortlistMemo: 'keep memo' },
      second: { ...apartmentState('second', 'SHORTLIST'), shortlistRank: 2 },
    },
    userEvaluations: { first: { ...evaluation(), apartmentId: 'first' } },
    visitsByApartmentId: { first: [{ id: 'visit', questId: 'quest', apartmentId: 'first', visitedAt: NOW, pros: ['quiet'], cons: [], photos: [{ id: 'photo' }], createdAt: NOW, updatedAt: NOW }] },
  })
  test('excluding a finalist preserves records and compacts remaining ranks', () => {
    const state = base()
    const next = questReducer(state, { type: 'passApartment', apartmentId: 'first', reason: 'PRICE', memo: ' too expensive ' })
    expect(next.apartmentQuestStates.first).toMatchObject({ stage: 'PASSED', passReason: 'PRICE', passMemo: 'too expensive', shortlistMemo: 'keep memo' })
    expect(next.apartmentQuestStates.first.shortlistRank).toBeUndefined()
    expect(next.apartmentQuestStates.second.shortlistRank).toBe(1)
    expect(next.visitsByApartmentId).toBe(state.visitsByApartmentId)
    expect(next.userEvaluations).toBe(state.userEvaluations)
    expect(state.apartmentQuestStates.first.stage).toBe('SHORTLIST')
    expect(questReducer(next, { type: 'passApartment', apartmentId: 'first', reason: 'OTHER', memo: '' })).toBe(next)
  })
  test('restoring a visited finalist requires explicit shortlist selection again', () => {
    const excluded = questReducer(base(), { type: 'passApartment', apartmentId: 'first', reason: 'PRICE', memo: 'reason' })
    const next = questReducer(excluded, { type: 'restoreApartment', apartmentId: 'first' })
    expect(next.apartmentQuestStates.first.stage).toBe('VISITED')
    expect(next.apartmentQuestStates.first.shortlistRank).toBeUndefined()
    expect(next.apartmentQuestStates.first.passReason).toBeUndefined()
    expect(next.apartmentQuestStates.first.passMemo).toBeUndefined()
    expect(next.apartmentQuestStates.first.passedAt).toBeUndefined()
    expect(next.visitsByApartmentId).toBe(excluded.visitsByApartmentId)
    expect(next.userEvaluations).toBe(excluded.userEvaluations)
    expect(questReducer(next, { type: 'restoreApartment', apartmentId: 'first' })).toBe(next)
  })
  test('a discovered apartment can be excluded then restored as a candidate', () => {
    const excluded = questReducer(base(), { type: 'passApartment', apartmentId: 'new', reason: 'OTHER', memo: '' })
    expect(excluded.apartmentQuestStates.new.stage).toBe('PASSED')
    expect(questReducer(excluded, { type: 'restoreApartment', apartmentId: 'new' }).apartmentQuestStates.new.stage).toBe('CANDIDATE')
  })
  test('legacy excluded entries without visits restore as candidates', () => {
    const state = base()
    state.apartmentQuestStates.legacy = apartmentState('legacy', 'PASSED')
    expect(questReducer(state, { type: 'restoreApartment', apartmentId: 'legacy' }).apartmentQuestStates.legacy.stage).toBe('CANDIDATE')
  })
  test('cannot mutate without an active quest or restore a non-excluded apartment', () => {
    expect(questReducer(initialQuestState, { type: 'passApartment', apartmentId: 'first', reason: 'OTHER', memo: '' })).toBe(initialQuestState)
    const state = base()
    expect(questReducer(state, { type: 'restoreApartment', apartmentId: 'first' })).toBe(state)
  })
})

describe('editing completed visits', () => {
  function stateWithVisit(): QuestAppState {
    return { ...initialQuestState, quest: quest(), setupCompleted: true,
      apartmentQuestStates: { visited: { ...apartmentState('visited', 'SHORTLIST'), shortlistRank: 1 } },
      userEvaluations: { visited: evaluation() },
      visitsByApartmentId: { visited: [{ id: 'edit-me', questId: 'quest', apartmentId: 'visited', visitedAt: NOW, createdAt: NOW, updatedAt: NOW, pros: ['before'], cons: [], photos: [] }] },
    }
  }
  test('replaces only the selected visit and preserves creation date, stage, rank and current evaluation', () => {
    const state = stateWithVisit()
    const original = state.visitsByApartmentId.visited[0]
    const next = questReducer(state, { type: 'updateVisit', visit: { ...original, pros: ['after'], createdAt: '2099-01-01T00:00:00.000Z' } })
    expect(next.visitsByApartmentId.visited).toHaveLength(1)
    expect(next.visitsByApartmentId.visited[0].pros).toEqual(['after'])
    expect(next.visitsByApartmentId.visited[0].createdAt).toBe(NOW)
    expect(next.apartmentQuestStates).toBe(state.apartmentQuestStates)
    expect(next.userEvaluations).toBe(state.userEvaluations)
    expect(original.pros).toEqual(['before'])
  })
  test('unknown visit and cross-quest edits do not create visits', () => {
    const state = stateWithVisit()
    const visit = state.visitsByApartmentId.visited[0]
    expect(questReducer(state, { type: 'updateVisit', visit: { ...visit, id: 'missing' } })).toBe(state)
    expect(questReducer(state, { type: 'updateVisit', visit: { ...visit, questId: 'other' } })).toBe(state)
  })
  test('failed edit is not published and retry writes the same visit once', async () => {
    const { saveVisitEditChange } = await import('./saveVisitEdit.ts')
    const state = stateWithVisit()
    const visit = { ...state.visitsByApartmentId.visited[0], memo: 'edited' }
    const publish = vi.fn()
    await expect(saveVisitEditChange(state, visit, async () => { throw new Error('disk full') }, publish)).rejects.toThrow('disk full')
    expect(publish).not.toHaveBeenCalled()
    await saveVisitEditChange(state, visit, async (next) => {
      expect(publish).not.toHaveBeenCalled()
      expect(next.visitsByApartmentId.visited).toHaveLength(1)
      expect(next.visitsByApartmentId.visited[0].memo).toBe('edited')
    }, publish)
    expect(publish).toHaveBeenCalledTimes(1)
  })
})
