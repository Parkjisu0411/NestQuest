import type { QuestStage } from './models.ts'

export type StageFilterId = 'all' | 'candidate' | 'visited' | 'shortlist'

export const STAGE_FILTER_STAGES: Record<StageFilterId, readonly QuestStage[]> = {
  all: ['DISCOVERED', 'CANDIDATE', 'VISITED', 'SHORTLIST'],
  candidate: ['CANDIDATE', 'VISITED', 'SHORTLIST'],
  visited: ['VISITED', 'SHORTLIST'],
  shortlist: ['SHORTLIST'],
}

export const STAGE_FILTERS: Array<{ id: StageFilterId; label: string }> = [
  { id: 'all', label: '전체' },
  { id: 'candidate', label: '관심' },
  { id: 'visited', label: '다녀온 집' },
  { id: 'shortlist', label: '최종 후보' },
]

export const QUEST_STAGE_LABELS: Record<QuestStage, string> = {
  DISCOVERED: '',
  CANDIDATE: '관심',
  VISITED: '다녀온 집',
  SHORTLIST: '★ 최종 후보',
  PASSED: '제외한 집',
}

export function isStageVisible(
  stage: QuestStage,
  filter: StageFilterId,
  showPassed: boolean,
  hasVisit = stage === 'VISITED',
): boolean {
  if (stage === 'PASSED') {
    return showPassed
  }
  if (filter === 'visited' && stage === 'SHORTLIST' && !hasVisit) return false

  return STAGE_FILTER_STAGES[filter].includes(stage)
}

export function stageAfterVisit(stage: QuestStage): QuestStage {
  if (stage === 'SHORTLIST' || stage === 'PASSED') {
    return stage
  }

  return 'VISITED'
}
