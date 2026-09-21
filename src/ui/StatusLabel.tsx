import type { QuestStage } from '../domain/models.ts'
import { QUEST_STAGE_LABELS } from '../domain/stages.ts'
import styles from './StatusLabel.module.css'

export function StatusLabel({ stage }: { stage: QuestStage }) {
  const label = QUEST_STAGE_LABELS[stage]
  if (!label) {
    return null
  }

  return <span className={`${styles.label} ${stageClass(stage)}`}>{label}</span>
}

function stageClass(stage: QuestStage): string {
  switch (stage) {
    case 'CANDIDATE':
      return styles.candidate
    case 'VISITED':
      return styles.visited
    case 'SHORTLIST':
      return styles.shortlist
    case 'PASSED':
      return styles.passed
    default:
      return styles.plain
  }
}
