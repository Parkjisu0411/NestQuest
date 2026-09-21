import { describe, expect, it } from 'vitest'
import { catalogForState, createInitialApartmentQuestStates } from './apartments.ts'
import { initialQuestState } from '../app/questStore.ts'
import { MOCK_APARTMENTS } from '../mock/apartments.ts'
import type { Quest } from '../domain/models.ts'

describe('production catalog is live-only', () => {
  it('starts empty in live mode rather than displaying fictional apartments', () => {
    const catalog = catalogForState(initialQuestState)
    expect(catalog.mode).toBe('live')
    expect(catalog.list()).toEqual([])
    expect(createInitialApartmentQuestStates({} as Quest)).toEqual({})
  })
  it('preserves a legacy candidate identity without copying fictional facts', () => {
    const example = MOCK_APARTMENTS[0]
    const id = example.apartment.id
    const state = { ...initialQuestState, apartmentQuestStates: {
      [id]: { apartmentId:id, questId:'q', stage:'CANDIDATE' as const, targetUnitTypeIds:[], updatedAt:'2026-09-21T00:00:00.000Z' },
    } }
    const record = catalogForState(state).find(id)!
    expect(record.apartment.name).toContain('실제 단지 미연결')
    expect(record.apartment.latitude).toBeUndefined()
    expect(record.apartment.householdCount).toBeUndefined()
    expect(record.unitTypes).toEqual([])
    expect(record.commutes).toEqual([])
    expect(state.apartmentQuestStates[id].stage).toBe('CANDIDATE')
  })
  it('does not restore fictional records from a legacy catalog snapshot', () => {
    const state = { ...initialQuestState, catalogSnapshot: { mode:'live' as const, records:MOCK_APARTMENTS } }
    expect(catalogForState(state).list()).toEqual([])
  })
})
