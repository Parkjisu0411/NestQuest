import { describe, expect, test } from 'vitest'
import { calculateMyScore } from '../domain/scoring.ts'
import { questReducer, type QuestAppState } from '../app/questStore.ts'
import {
  backupFilename,
  createBackup,
  parseBackupJson,
  restoreFromBackupText,
  serializeBackup,
} from './backup.ts'
import {
  BACKUP_UNSUPPORTED_VERSION,
  BACKUP_UNREADABLE,
  BACKUP_WRONG_FORMAT,
  PersistError,
} from './errors.ts'
import { BACKUP_FORMAT, BACKUP_VERSION, PERSISTENCE_SCHEMA_VERSION } from './schema.ts'
import {
  collectPhotoBlobKeys,
  persistedToAppState,
  toPersistedUserState,
} from './snapshot.ts'

const NOW = '2026-09-16T04:00:00.000Z'

const PRIORITIES = {
  stationAccess: 3,
  commuteFeel: 4,
  commercial: 2,
  school: 0,
  nature: 3,
  neighborhood: 4,
} as const

function fullState(): QuestAppState {
  return {
    setupCompleted: true,
    quest: {
      id: 'quest-keep',
      searchCriteria: {
        areas: [
          {
            sidoCode: '11',
            sidoName: '서울특별시',
            sigunguCode: '11560',
            sigunguName: '영등포구',
          },
        ],
        availableCash: 300_000_000,
        expectedLoanLimit: 500_000_000,
        minExclusiveArea: 59,
        maxBuildingAge: 20,
        minHouseholdCount: 300,
        commuteDestination: {
          id: 'yeouido',
          name: '여의도',
          latitude: 37.5219,
          longitude: 126.9245,
        },
        maxCommuteMinutes: 60,
      },
      evaluationPriorities: { ...PRIORITIES },
      loanAssumption: { annualInterestRate: 0.04, termYears: 30 },
      createdAt: NOW,
      updatedAt: NOW,
    },
    apartmentQuestStates: {
      visited: {
        questId: 'quest-keep',
        apartmentId: 'visited',
        stage: 'VISITED',
        targetUnitTypeIds: ['visited-84'],
        updatedAt: NOW,
      },
      shortlist: {
        questId: 'quest-keep',
        apartmentId: 'shortlist',
        stage: 'SHORTLIST',
        targetUnitTypeIds: ['shortlist-59'],
        shortlistRank: 1,
        shortlistMemo: '출퇴근이 우선',
        updatedAt: NOW,
      },
      passed: {
        questId: 'quest-keep',
        apartmentId: 'passed',
        stage: 'PASSED',
        targetUnitTypeIds: [],
        passedAt: NOW,
        passReason: 'NEIGHBORHOOD',
        passMemo: '골목이 좁다',
        updatedAt: NOW,
      },
    },
    visitsByApartmentId: {
      visited: [
        {
          id: 'visit-keep',
          questId: 'quest-keep',
          apartmentId: 'visited',
          visitedAt: '2026-09-15T09:30:00.000Z',
          visitType: 'WEEKDAY_DAY',
          pros: ['밝다'],
          cons: ['소음'],
          memo: '저녁에 다시',
          photos: [
            {
              id: 'photo-keep',
              visitId: 'visit-keep',
              blobKey: 'visit-photo:photo-keep',
              createdAt: NOW,
            },
          ],
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    },
    userEvaluations: {
      visited: {
        questId: 'quest-keep',
        apartmentId: 'visited',
        ratings: {
          stationAccess: 4,
          commuteFeel: 5,
          commercial: 3,
          school: null,
          nature: 4,
          neighborhood: 5,
        },
        adjustments: [
          {
            id: 'adj-keep',
            type: 'POSITIVE',
            description: '관리가 잘 되어 있다',
            impact: 'LARGE',
            createdAt: NOW,
          },
        ],
        updatedAt: NOW,
      },
    },
  }
}

function optionalCriteriaState(): QuestAppState {
  const state = fullState()
  if (!state.quest) {
    throw new Error('expected quest')
  }
  return {
    ...state,
    quest: {
      ...state.quest,
      searchCriteria: {
        areas: state.quest.searchCriteria.areas,
      },
    },
  }
}

describe('canonical round-trip', () => {
  test('serialize → deserialize preserves user-owned state and IDs', () => {
    const original = fullState()
    const snapshot = toPersistedUserState(original)
    const restored = persistedToAppState(snapshot)

    expect(snapshot.persistenceSchemaVersion).toBe(PERSISTENCE_SCHEMA_VERSION)
    expect(restored).toEqual(original)
    expect(restored.quest?.id).toBe('quest-keep')
    expect(restored.visitsByApartmentId.visited?.[0]?.id).toBe('visit-keep')
    expect(restored.visitsByApartmentId.visited?.[0]?.photos[0]?.id).toBe('photo-keep')
    expect(restored.userEvaluations.visited?.adjustments[0]?.id).toBe('adj-keep')
    expect(restored.apartmentQuestStates.shortlist?.shortlistRank).toBe(1)
    expect(restored.apartmentQuestStates.shortlist?.shortlistMemo).toBe('출퇴근이 우선')
    expect(restored.apartmentQuestStates.passed?.passReason).toBe('NEIGHBORHOOD')
    expect(restored.apartmentQuestStates.visited?.targetUnitTypeIds).toEqual(['visited-84'])
  })

  test('optional SearchCriteria survive round-trip without sentinels', () => {
    const restored = persistedToAppState(toPersistedUserState(optionalCriteriaState()))
    expect(restored.quest?.searchCriteria).toEqual({
      areas: [
        {
          sidoCode: '11',
          sidoName: '서울특별시',
          sigunguCode: '11560',
          sigunguName: '영등포구',
        },
      ],
    })
    expect(restored.quest?.searchCriteria.availableCash).toBeUndefined()
    expect(restored.quest?.searchCriteria.commuteDestination).toBeUndefined()
    expect(restored.quest?.searchCriteria.maxCommuteMinutes).toBeUndefined()
  })

  test('EvaluationPriorities, Visits, and evaluations survive round-trip', () => {
    const restored = persistedToAppState(toPersistedUserState(fullState()))
    expect(restored.quest?.evaluationPriorities).toEqual(PRIORITIES)
    expect(restored.visitsByApartmentId.visited?.[0]?.pros).toEqual(['밝다'])
    expect(restored.visitsByApartmentId.visited?.[0]?.visitType).toBe('WEEKDAY_DAY')
    expect(restored.userEvaluations.visited?.ratings.school).toBeNull()
    expect(restored.userEvaluations.visited?.adjustments).toEqual([
      {
        id: 'adj-keep',
        type: 'POSITIVE',
        description: '관리가 잘 되어 있다',
        impact: 'LARGE',
        createdAt: NOW,
      },
    ])
  })

  test('derived My Score is not stored in the snapshot', () => {
    const original = fullState()
    const json = JSON.stringify(toPersistedUserState(original))
    expect(json).not.toContain('myScore')
    expect(json).not.toContain('purchaseBudget')
    expect(json).not.toContain('discoverCeiling')

    const restored = persistedToAppState(toPersistedUserState(original))
    const score = calculateMyScore({
      hasVisit: true,
      evaluation: restored.userEvaluations.visited,
      priorities: restored.quest?.evaluationPriorities ?? PRIORITIES,
    })
    expect(score).toBe(
      calculateMyScore({
        hasVisit: true,
        evaluation: original.userEvaluations.visited,
        priorities: original.quest?.evaluationPriorities ?? PRIORITIES,
      }),
    )
  })
})

describe('backup envelope', () => {
  test('round-trips notes without impact alongside legacy notes without changing the score', () => {
    const state = fullState()
    const current = state.userEvaluations.visited
    current.adjustments.push({
      id: 'new-note', type: 'NEGATIVE', description: '저녁 소음 확인 필요', createdAt: NOW,
    })
    const restored = persistedToAppState(parseBackupJson(serializeBackup(createBackup(state))).data)
    expect(restored.userEvaluations.visited.adjustments).toEqual(current.adjustments)
    expect(restored.userEvaluations.visited.adjustments[1]).not.toHaveProperty('impact')
    const priorities = state.quest!.evaluationPriorities
    const withoutNotes = { ...current, adjustments: [] }
    expect(calculateMyScore({ hasVisit: true, evaluation: restored.userEvaluations.visited, priorities }))
      .toBe(calculateMyScore({ hasVisit: true, evaluation: withoutNotes, priorities }))
  })

  test('creates a versioned NestQuest backup without binary photos', () => {
    const exportedAt = new Date('2026-09-16T06:00:00.000Z')
    const backup = createBackup(fullState(), exportedAt)
    expect(backup.format).toBe(BACKUP_FORMAT)
    expect(backup.version).toBe(BACKUP_VERSION)
    expect(backup.exportedAt).toBe('2026-09-16T06:00:00.000Z')
    expect(backup.data.persistenceSchemaVersion).toBe(PERSISTENCE_SCHEMA_VERSION)
    expect(collectPhotoBlobKeys(persistedToAppState(backup.data))).toEqual([
      'visit-photo:photo-keep',
    ])
    expect(serializeBackup(backup)).toContain('"format": "nestquest-backup"')
  })

  test('uses a local-date backup filename', () => {
    expect(backupFilename(new Date(2026, 8, 16))).toBe('nestquest-backup-2026-09-16.json')
  })

  test('accepts a valid backup', () => {
    const raw = serializeBackup(createBackup(fullState(), new Date('2026-09-16T06:00:00.000Z')))
    const parsed = parseBackupJson(raw)
    expect(parsed.data.quest?.id).toBe('quest-keep')
    expect(persistedToAppState(parsed.data)).toEqual(fullState())
  })

  test('rejects malformed JSON', () => {
    expect(() => parseBackupJson('{')).toThrow(PersistError)
    try {
      parseBackupJson('{')
    } catch (error) {
      expect(error).toBeInstanceOf(PersistError)
      expect((error as PersistError).userMessage).toBe(BACKUP_UNREADABLE)
    }
  })

  test('rejects the wrong format', () => {
    try {
      parseBackupJson(JSON.stringify({ format: 'other', version: 1, exportedAt: NOW, data: {} }))
      throw new Error('expected rejection')
    } catch (error) {
      expect((error as PersistError).userMessage).toBe(BACKUP_WRONG_FORMAT)
    }
  })

  test('rejects an unsupported version', () => {
    const valid = createBackup(fullState())
    try {
      parseBackupJson(JSON.stringify({ ...valid, version: 999 }))
      throw new Error('expected rejection')
    } catch (error) {
      expect((error as PersistError).userMessage).toBe(BACKUP_UNSUPPORTED_VERSION)
    }
  })
})

describe('restore replacement', () => {
  test('does not replace current state when persistence fails', async () => {
    const current = fullState()
    const stored = current
    const raw = serializeBackup(createBackup(optionalCriteriaState()))

    await expect(
      restoreFromBackupText(raw, {
        replace: async () => {
          throw new PersistError('기록을 저장하지 못했습니다. 이 화면의 내용은 유지됩니다.')
        },
      }),
    ).rejects.toBeInstanceOf(PersistError)

    expect(stored).toBe(current)
    expect(stored.quest?.searchCriteria.commuteDestination?.id).toBe('yeouido')
  })

  test('does not replace current state when JSON is invalid', async () => {
    const current = fullState()
    let stored = current

    await expect(
      restoreFromBackupText('not-json', {
        replace: async (next) => {
          stored = next
        },
      }),
    ).rejects.toMatchObject({ userMessage: BACKUP_UNREADABLE })

    expect(stored).toBe(current)
  })

  test('replaces only after a successful write', async () => {
    const current = fullState()
    let stored = current
    const raw = serializeBackup(createBackup(optionalCriteriaState()))
    const next = await restoreFromBackupText(raw, {
      replace: async (value) => {
        stored = value
      },
    })

    expect(stored).toBe(next)
    expect(next.quest?.searchCriteria.commuteDestination).toBeUndefined()
    expect(next.quest?.id).toBe('quest-keep')
  })

  test('replaceState keeps canonical IDs', () => {
    const restored = persistedToAppState(toPersistedUserState(fullState()))
    const next = questReducer(
      {
        setupCompleted: false,
        quest: null,
        apartmentQuestStates: {},
        visitsByApartmentId: {},
        userEvaluations: {},
      },
      { type: 'replaceState', state: restored },
    )
    expect(next.quest?.id).toBe('quest-keep')
    expect(next.visitsByApartmentId.visited?.[0]?.id).toBe('visit-keep')
    expect(next.apartmentQuestStates.shortlist?.shortlistRank).toBe(1)
  })
})

test('structured observations round-trip through JSON backup without changing legacy notes or ratings', () => {
  const state = fullState()
  state.visitsByApartmentId.visited[0].observations = {
    noise: { status: 'checked', note: '저녁 차량 소음\n도로 쪽' },
    schoolRoute: { status: 'notApplicable', note: '' },
    stationWalk: { status: 'unchecked', note: '다음 방문 때 확인' },
  }
  const restored = persistedToAppState(parseBackupJson(serializeBackup(createBackup(state))).data)
  expect(restored.visitsByApartmentId).toEqual(state.visitsByApartmentId)
  expect(restored.userEvaluations).toEqual(state.userEvaluations)
  expect(restored.visitsByApartmentId.visited[0].observations).not.toBe(state.visitsByApartmentId.visited[0].observations)
})

test('observation photo associations survive JSON backup without requiring original blobs', () => {
  const state = fullState()
  const visit = state.visitsByApartmentId.visited[0]
  visit.observations = { noise: { status: 'checked', note: '도로 사진', photoIds: [visit.photos[0].id] } }
  const restored = persistedToAppState(parseBackupJson(serializeBackup(createBackup(state))).data)
  expect(restored.visitsByApartmentId.visited[0].observations).toEqual(visit.observations)
  const backup = createBackup(state)
  backup.data.visitsByApartmentId.visited[0].observations!.noise!.photoIds = ['other-visit']
  expect(() => parseBackupJson(serializeBackup(backup))).toThrow()
})
