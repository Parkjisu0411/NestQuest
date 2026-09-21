import type { UserEvaluation } from '../domain/models.ts'
import { PersistError } from '../persistence/errors.ts'
import { questReducer, type QuestAppState } from './questStore.ts'

/** Publish only after persistence completes; failed saves leave current state intact. */
export async function saveEvaluationChange(
  state: QuestAppState,
  evaluation: UserEvaluation,
  write: (next: QuestAppState) => Promise<void>,
  publish: () => void,
): Promise<void> {
  const next = questReducer(state, { type: 'updateEvaluation', evaluation })
  if (next === state) {
    throw new PersistError('방문 기록이 있는 단지에서 평가를 저장할 수 있습니다.')
  }
  await write(next)
  publish()
}
