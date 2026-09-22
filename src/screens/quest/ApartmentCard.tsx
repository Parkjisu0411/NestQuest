import { Icon } from '../../ui/Icon.tsx'
import { Link } from 'react-router'
import { formatEok } from '../../domain/calculations.ts'
import { formatMyScore } from '../../domain/scoring.ts'
import type { DiscoverMatch } from '../../domain/discover.ts'
import type { QuestStage } from '../../domain/models.ts'
import { StatusLabel } from '../../ui/StatusLabel.tsx'
import styles from './ApartmentCard.module.css'

interface ApartmentCardProps {
  match: DiscoverMatch
  stage: QuestStage
  myScore?: number
  commuteDestinationName?: string
  shortlistRank?: number
  shortlistMemo?: string
  onAddCandidate: () => void
  selected: boolean
  onSelect: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
}

export function ApartmentCard({
  match,
  stage,
  myScore,
  commuteDestinationName,
  shortlistRank,
  shortlistMemo,
  onAddCandidate,
  selected,
  onSelect,
  onMoveUp,
  onMoveDown,
}: ApartmentCardProps) {
  const { apartment, displayUnit, commute, nearBudget, area } = match
  const estimatedPrice = displayUnit?.priceEstimate?.estimatedPrice
  const passed = stage === 'PASSED'
  const commuteText =
    commute !== undefined && commuteDestinationName
      ? `${commuteDestinationName} ${Math.round(commute.totalMinutes)}분`
      : undefined
  const facts = [
    estimatedPrice !== undefined ? formatEok(estimatedPrice) : undefined,
    commuteText,
  ].filter((item): item is string => item !== undefined)

  return (
    <article
      className={`${styles.card} ${passed ? styles.excluded : ''} ${selected ? styles.selected : ''}`}
      data-apartment-id={apartment.id}
      data-selected={selected}
    >
      <button type="button" className={styles.body} onClick={onSelect} aria-pressed={selected} aria-label={`${apartment.name} 지도에서 선택`}>
        <span className={styles.top}>
          {shortlistRank !== undefined ? (
            <span className={styles.rank}>내 순서 {shortlistRank}</span>
          ) : null}
          <span className={styles.name}>{apartment.name}</span>
        </span>
        <span className={styles.area}>
          {area.sigunguName} · {displayUnit ? `${displayUnit.areaGroup}㎡` : '면적 미확인'}
        </span>
        {facts.length > 0 ? (
          <span className={styles.facts}>
            {facts.join(' · ')}
            {nearBudget ? <span className={styles.near}>예산 근처</span> : null}
          </span>
        ) : null}
        {stage !== 'DISCOVERED' || myScore !== undefined ? (
          <span className={styles.status}>
            <StatusLabel stage={stage} />
            {myScore !== undefined ? (
              <span className={styles.score}>내 점수 {formatMyScore(myScore)}</span>
            ) : null}
          </span>
        ) : null}
        {shortlistMemo ? <span className={styles.memo}>{shortlistMemo}</span> : null}
        {match.unknownFields.length ? <span className={styles.memo}>{match.unknownFields.join('·')} 미확인</span> : null}
        
        {displayUnit?.priceEstimate ? <span className={styles.memo}>가격 · {displayUnit.priceEstimate.calculatedAt.slice(0,10)} 기준</span> : null}
        {commute?.provider === 'Kakao' ? <span className={styles.memo}>카카오 통근 · {commute.calculatedAt.slice(0,10)} 조회</span> : null}
      </button>
      <Link to={`/apartments/${apartment.id}`} className={styles.detail} aria-label={`${apartment.name} 상세`}>상세<Icon name="chevron" size={16} /></Link>
      {stage === 'DISCOVERED' ? (
        <button
          type="button"
          className={styles.cta}
          onClick={(event) => {
            event.stopPropagation()
            onAddCandidate()
          }}
        >
          <Icon name="heart" size={18} /> 관심
        </button>
      ) : null}
      {onMoveUp || onMoveDown ? (
        <div className={styles.reorder}>
          <button type="button" disabled={!onMoveUp} onClick={onMoveUp}>
            위로
          </button>
          <button type="button" disabled={!onMoveDown} onClick={onMoveDown}>
            아래로
          </button>
        </div>
      ) : null}
    </article>
  )
}
