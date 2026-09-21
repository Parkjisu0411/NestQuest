import { STAGE_FILTERS, type StageFilterId } from '../../domain/stages.ts'
import styles from './StageFilter.module.css'

interface StageFilterProps {
  value: StageFilterId
  counts: Record<StageFilterId, number>
  onChange: (id: StageFilterId) => void
}

export function StageFilter({ value, counts, onChange }: StageFilterProps) {
  return (
    <div className={styles.row} role="group" aria-label="단지 단계">
      {STAGE_FILTERS.map((filter) => {
        const selected = filter.id === value
        return (
          <button
            key={filter.id}
            type="button"
            aria-pressed={selected}
            className={selected ? `${styles.tab} ${styles.selected}` : styles.tab}
            onClick={() => onChange(filter.id)}
          >
            <span className={styles.label}>{filter.label}</span>
            <span className={styles.count}>{counts[filter.id]}</span>
          </button>
        )
      })}
    </div>
  )
}
