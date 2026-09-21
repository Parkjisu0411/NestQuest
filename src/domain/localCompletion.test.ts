import { describe, expect, it } from 'vitest'
import { MOCK_APARTMENTS } from '../mock/apartments.ts'
import { buildDiscoverMatch, discoverApartments, type DiscoverableApartment } from './discover.ts'
import { parseVisitObservations, validateObservationPhotos } from './visitObservations.ts'
import { addToShortlist, removeFromShortlist } from './shortlist.ts'
import { createInitialApartmentQuestStates } from '../data/apartments.ts'
import { initialQuestState } from '../app/questStore.ts'
import { createBackup, parseBackup, restoreFromBackupText, serializeBackup } from '../persistence/backup.ts'
import type { Quest, QuestState, SearchCriteria } from './models.ts'

const source = MOCK_APARTMENTS[0]
const conditions: SearchCriteria = { areas: [source.area], availableCash: 1000000000, expectedLoanLimit: 0, minExclusiveArea: 59, maxBuildingAge: 30, minHouseholdCount: 100 }
const empty: DiscoverableApartment = { ...source, apartment: { ...source.apartment, approvalDate: undefined, householdCount: undefined }, unitTypes: [], commutes: [] }

describe('incomplete reference information', () => {
  it('shows a no-unit apartment with named unknown fields without invented numbers', () => {
    const match = buildDiscoverMatch(empty, conditions)
    expect(match?.displayUnit).toBeUndefined()
    expect(match?.unknownFields).toEqual(['가격', '면적', '세대수', '연식'])
    expect(buildDiscoverMatch(empty, { ...conditions, includeUnknown: false })).toBeUndefined()
  })
  it('does not bypass a known failing condition when unknown data is included', () => {
    expect(buildDiscoverMatch({ ...empty, apartment: { ...empty.apartment, householdCount: 50 } }, conditions)).toBeUndefined()
  })
  it('separates missing commute from a zero-minute route', () => {
    const criteria = { areas: [source.area], commuteDestination: { id: 'work', name: 'work', latitude: 37, longitude: 127 }, maxCommuteMinutes: 40 }
    expect(buildDiscoverMatch(empty, criteria)?.unknownFields).toContain('통근')
    expect(buildDiscoverMatch(empty, { ...criteria, includeUnknown: false })).toBeUndefined()
  })
  it('keeps a retained apartment even when constrained information is missing', () => {
    expect(buildDiscoverMatch(empty, { ...conditions, includeUnknown: false }, new Date(), 'retained')).toBeDefined()
  })
  it('sorts two unknown commute results by name', () => {
    const records = ['하늘', '가람'].map((name) => ({ ...empty, apartment: { ...empty.apartment, id: name, name } }))
    expect(discoverApartments(records, conditions).map((item) => item.apartment.name)).toEqual(['가람', '하늘'])
  })
})

it('supports optional interior observations and validates photo references', () => {
  const observations = parseVisitObservations({ daylight: { status: 'checked', note: '오후 채광 확인', photoIds: ['photo'] } })
  expect(observations?.daylight?.note).toBe('오후 채광 확인')
  expect(() => validateObservationPhotos(observations, [])).toThrow()
  expect(() => validateObservationPhotos(observations, [{ id: 'photo' }])).not.toThrow()
  expect(parseVisitObservations(undefined)).toBeUndefined()
})

it('returns an unvisited shortlist apartment to candidate, without fabricating a visit', () => {
  const item: QuestState = { apartmentId: 'a', questId: 'q', stage: 'CANDIDATE', targetUnitTypeIds: [], updatedAt: '2026-09-18T00:00:00Z' }
  const states = addToShortlist({ a: item }, 'a', item.updatedAt)
  expect(states.a.stage).toBe('SHORTLIST')
  expect(removeFromShortlist(states, 'a', item.updatedAt, false).a.stage).toBe('CANDIDATE')
})

it('preserves unknown-data policy in backup and rejects a malformed flag', async () => {
  const quest: Quest = { id: 'q', searchCriteria: { areas: [source.area], includeUnknown: false }, evaluationPriorities: { stationAccess: 1, commuteFeel: 1, commercial: 1, school: 1, nature: 1, neighborhood: 1 }, loanAssumption: { annualInterestRate: .04, termYears: 30 }, createdAt: '2026-09-18T00:00:00Z', updatedAt: '2026-09-18T00:00:00Z' }
  const state = { ...initialQuestState, setupCompleted: true, quest, apartmentQuestStates: createInitialApartmentQuestStates(quest) }
  const backup = createBackup(state)
  let restored = state
  await restoreFromBackupText(serializeBackup(backup), { replace: async (value) => { restored = value as typeof state } })
  expect(restored.quest.searchCriteria.includeUnknown).toBe(false)
  const malformed = JSON.parse(serializeBackup(backup))
  malformed.data.quest.searchCriteria.includeUnknown = 'false'
  expect(() => parseBackup(malformed)).toThrow()
})
