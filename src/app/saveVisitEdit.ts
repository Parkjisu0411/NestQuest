import type { Visit } from '../domain/models.ts'
import { validateObservationPhotos } from '../domain/visitObservations.ts'
import { questReducer, type QuestAppState } from './questStore.ts'

export async function saveVisitEditChange(state: QuestAppState, visit: Visit, write: (next: QuestAppState) => Promise<void>, publish: () => void) {
  validateObservationPhotos(visit.observations, visit.photos)
  const next = questReducer(state, { type: 'updateVisit', visit })
  if (next === state) throw new Error('수정할 방문 기록을 찾을 수 없습니다.')
  await write(next)
  publish()
}
