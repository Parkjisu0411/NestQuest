import { createApartmentCatalog } from './apartmentCatalog.ts'
import type { DiscoverableApartment } from '../domain/discover.ts'
import type { QuestAppState } from '../app/questStore.ts'
import type { Quest, QuestState } from '../domain/models.ts'

// Production never falls back to fictional apartment facts.
export const apartmentCatalog = createApartmentCatalog([], 'live')
export function catalogForState(state: QuestAppState) {
  const records = (state.catalogSnapshot?.records ?? []).filter(record => record.apartment.id.startsWith('kapt:'))
  const ids = new Set(records.map(record => record.apartment.id))
  const legacy: DiscoverableApartment[] = []
  const retained = new Set([...Object.keys(state.visitsByApartmentId), ...Object.keys(state.apartmentQuestStates), ...Object.keys(state.userEvaluations)])
  for (const id of retained) {
    if (ids.has(id) || (!state.visitsByApartmentId[id]?.length && !state.userEvaluations[id] && (!state.apartmentQuestStates[id] || state.apartmentQuestStates[id].stage === 'DISCOVERED'))) continue
    const now = state.quest?.updatedAt ?? '2026-01-01T00:00:00.000Z'
    legacy.push({ apartment:{id,name:'이전 기록 · 실제 단지 미연결 ('+id+')',address:'실제 주소 미확인',createdAt:now,updatedAt:now},
      area:{sidoCode:'unknown',sidoName:'미확인',sigunguCode:'unknown',sigunguName:'기존 기록'},unitTypes:[],commutes:[] })
  }
  return createApartmentCatalog([...records,...legacy], 'live')
}
export function createInitialApartmentQuestStates(_quest: Quest): Record<string, QuestState> {
  void _quest
  return {}
}
