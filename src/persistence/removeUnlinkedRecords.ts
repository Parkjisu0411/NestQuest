import type { QuestAppState } from '../app/questStore.ts'
import { catalogForState } from '../data/apartments.ts'
import { withNormalizedShortlistRanks } from '../domain/shortlist.ts'

/** Same records shown as “이전 기록 · 실제 단지 미연결”, including missing K-apt identities. */
export function removeUnlinkedRecords(state: QuestAppState) {
  const ids = new Set(catalogForState(state).list().filter(record => record.area.sigunguCode === 'unknown').map(record => record.apartment.id))
  const keep = <T,>(values: Record<string, T>) => Object.fromEntries(Object.entries(values).filter(([id]) => !ids.has(id)))
  const next: QuestAppState = ids.size ? {
    ...state,
    ...(state.catalogSnapshot ? { catalogSnapshot: { ...state.catalogSnapshot, records: state.catalogSnapshot.records.filter(record => !ids.has(record.apartment.id)) } } : {}),
    apartmentQuestStates: withNormalizedShortlistRanks(keep(state.apartmentQuestStates), new Date().toISOString()),
    visitsByApartmentId: keep(state.visitsByApartmentId),
    userEvaluations: keep(state.userEvaluations),
  } : state
  const retainedPhotos = new Set(Object.values(next.visitsByApartmentId).flatMap(visits => visits.flatMap(visit => visit.photos.map(photo => photo.blobKey))))
  const photoKeys = new Set([...ids].flatMap(id => (state.visitsByApartmentId[id] ?? []).flatMap(visit => visit.photos.map(photo => photo.blobKey))).filter(key => !retainedPhotos.has(key)))
  return { state: next, ids, photoKeys }
}
