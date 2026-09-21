import { expect, it } from 'vitest'
import { initialQuestState, type QuestAppState } from '../app/questStore.ts'
import { MOCK_APARTMENTS } from '../mock/apartments.ts'
import { catalogForState } from '../data/apartments.ts'
import { removeUnlinkedRecords } from './removeUnlinkedRecords.ts'
import type { QuestState, Visit } from '../domain/models.ts'

const now = '2026-09-21T00:00:00.000Z'
const candidate = (id: string): QuestState => ({ apartmentId:id, questId:'q', stage:'CANDIDATE', targetUnitTypeIds:[], updatedAt:now })
const visit = (id: string, keys: string[]): Visit => ({ id:'visit-'+id, apartmentId:id, questId:'q', visitedAt:now, createdAt:now, updatedAt:now, pros:[], cons:[], photos:keys.map(key => ({ id:key, blobKey:key, visitId:'visit-'+id, createdAt:now })) })

it('removes displayed unlinked records and their private photos while retaining connected records and shared originals', () => {
  const live = { ...MOCK_APARTMENTS[0], apartment:{ ...MOCK_APARTMENTS[0].apartment, id:'kapt:live' } }
  const state: QuestAppState = { ...initialQuestState,
    catalogSnapshot:{ mode:'live', records:[live, MOCK_APARTMENTS[0]] },
    apartmentQuestStates:{ old:candidate('old'), 'kapt:missing':candidate('kapt:missing'), 'kapt:live':candidate('kapt:live') },
    visitsByApartmentId:{ old:[visit('old',['old-only','shared'])], 'kapt:live':[visit('kapt:live',['live-only','shared'])] },
    userEvaluations:{ old:{ apartmentId:'old', questId:'q', ratings:{}, adjustments:[], updatedAt:now } },
  }
  const result = removeUnlinkedRecords(state)
  expect([...result.ids].sort()).toEqual(['kapt:missing','old'])
  expect([...result.photoKeys]).toEqual(['old-only'])
  expect(Object.keys(result.state.apartmentQuestStates)).toEqual(['kapt:live'])
  expect(result.state.visitsByApartmentId).toEqual({ 'kapt:live':state.visitsByApartmentId['kapt:live'] })
  expect(result.state.userEvaluations).toEqual({})
  expect(catalogForState(result.state).list().map(record => record.apartment.id)).toEqual(['kapt:live'])
  expect(state.visitsByApartmentId.old).toHaveLength(1)
  expect(removeUnlinkedRecords(result.state).ids.size).toBe(0)
})

it('leaves an empty installation unchanged', () => {
  expect(removeUnlinkedRecords(initialQuestState).state).toBe(initialQuestState)
})
