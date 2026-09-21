import { EVALUATION_METRIC_ORDER, VISIT_TYPE_ORDER, type AdjustmentType, type EvaluationAdjustment, type UserEvaluation, type VisitType } from '../domain/models.ts'
import { parseUserEvaluation } from './snapshot.ts'
import { PersistError } from './errors.ts'
import { validateObservationPhotos } from '../domain/visitObservations.ts'
import { parseVisitObservations, VISIT_OBSERVATION_GROUPS, type VisitObservations, type ObservationGroupId } from '../domain/visitObservations.ts'

export type VisitPhase = 'capture' | 'keep-or-update' | 'rate' | 'factors'
export interface VisitDraft {
  observations?: VisitObservations
  observationGroup?: ObservationGroupId
  version: 1
  id: string
  questId: string
  apartmentId: string
  phase: VisitPhase
  visitedLocal: string
  visitType: VisitType | ''
  photos: Array<{ id: string; file: Blob }>
  pros: string[]
  cons: string[]
  proDraft: string
  conDraft: string
  memo: string
  metricIndex: number
  ratings: UserEvaluation['ratings']
  adjustments: EvaluationAdjustment[]
  factorType: AdjustmentType
  factorText: string
  updatedAt: string
}

export const DRAFT_READ_ERROR = '작성 중인 임장을 불러오지 못했습니다. 다시 시도해 주세요.'
export const DRAFT_WRITE_ERROR = '초안을 저장하지 못했습니다. 화면을 닫기 전에 다시 저장해 주세요.'

export function visitDraftKey(questId: string, apartmentId: string): string {
  return JSON.stringify([questId, apartmentId])
}

export function parseVisitDraft(value: unknown, questId: string, apartmentId: string): VisitDraft {
  const fail = () => { throw new PersistError(DRAFT_READ_ERROR) }
  if (!value || typeof value !== 'object') return fail()
  const draft = value as VisitDraft
  if (draft.version !== 1 || draft.questId !== questId || draft.apartmentId !== apartmentId ||
    typeof draft.id !== 'string' || !draft.id ||
    !['capture', 'keep-or-update', 'rate', 'factors'].includes(draft.phase) ||
    !['', ...VISIT_TYPE_ORDER].includes(draft.visitType) ||
    !Number.isInteger(draft.metricIndex) || draft.metricIndex < 0 || draft.metricIndex >= EVALUATION_METRIC_ORDER.length ||
    !['POSITIVE', 'NEGATIVE'].includes(draft.factorType)) return fail()
  for (const text of [draft.visitedLocal, draft.proDraft, draft.conDraft, draft.memo, draft.factorText, draft.updatedAt]) {
    if (typeof text !== 'string') return fail()
  }
  for (const list of [draft.pros, draft.cons]) {
    if (!Array.isArray(list) || !list.every((text) => typeof text === 'string')) return fail()
  }
  if (!Array.isArray(draft.photos) || !draft.photos.every((photo) => photo && typeof photo.id === 'string' && photo.file instanceof Blob)) return fail()
  try {
    parseVisitObservations(draft.observations)
    validateObservationPhotos(draft.observations, draft.photos)
    if (draft.observationGroup !== undefined && !VISIT_OBSERVATION_GROUPS.some((group) => group.id === draft.observationGroup)) return fail()
    parseUserEvaluation({ questId, apartmentId, ratings: draft.ratings, adjustments: draft.adjustments, updatedAt: draft.updatedAt })
  } catch { return fail() }
  return draft
}
