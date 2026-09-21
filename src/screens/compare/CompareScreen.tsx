import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useQuestState } from '../../app/useQuest.ts'
import {
  calculateBuildingAge,
  calculateParkingPerHousehold,
  formatEok,
} from '../../domain/calculations.ts'
import { listQuestHomeMatches, type DiscoverMatch } from '../../domain/discover.ts'
import type { UserEvaluation, Visit } from '../../domain/models.ts'
import {
  ADJUSTMENT_TYPE_LABELS,
  EVALUATION_METRIC_LABELS,
  EVALUATION_METRIC_ORDER,
} from '../../domain/models.ts'
import { calculateMyScore, formatMyScore } from '../../domain/scoring.ts'
import { listedShortlist } from '../../domain/shortlist.ts'
import { useApartmentCatalog } from '../../data/useApartmentCatalog.ts'
import styles from './CompareScreen.module.css'

const MAX_COMPARE = 4

interface CompareColumn {
  id: string
  name: string
  rank?: number
  memo?: string
  match: DiscoverMatch
  evaluation?: UserEvaluation
  visits: Visit[]
  myScore?: number
}

export function CompareScreen() {
  const apartmentCatalog = useApartmentCatalog()
  const { quest, apartmentQuestStates, visitsByApartmentId, userEvaluations } =
    useQuestState()
  const [extraIds, setExtraIds] = useState<string[]>(() => listedShortlist(apartmentQuestStates).slice(0, MAX_COMPARE).map((item) => item.apartmentId))
  const [query,setQuery]=useState('')
  const [optionPage,setOptionPage]=useState(0)

  const matches = useMemo(
    () =>
      quest
        ? listQuestHomeMatches(
            apartmentCatalog.list(),
            quest.searchCriteria,
            apartmentQuestStates,
          )
        : [],
    [apartmentQuestStates, quest, apartmentCatalog],
  )
  const matchById = useMemo(
    () => new Map(matches.map((match) => [match.apartment.id, match])),
    [matches],
  )

  const normalizedQuery=query.normalize('NFKC').replace(/\s/g,'').toLocaleLowerCase('ko')
  const options=matches.filter(item => apartmentQuestStates[item.apartment.id]?.stage !== 'PASSED' && !extraIds.includes(item.apartment.id) &&
    `${item.apartment.name} ${item.apartment.address}`.normalize('NFKC').replace(/\s/g,'').toLocaleLowerCase('ko').includes(normalizedQuery))
  const optionPages=Math.max(1,Math.ceil(options.length/30))
  const page=Math.min(optionPage,optionPages-1)
  const visibleOptions=options.slice(page*30,(page+1)*30)
  const selectedIds = extraIds.slice(0, MAX_COMPARE)

  const columns = selectedIds.flatMap((id): CompareColumn[] => {
    const match = matchById.get(id)
    const questState = apartmentQuestStates[id]
    if (!match || !quest) {
      return []
    }
    const visits = visitsByApartmentId[id] ?? []
    return [
      {
        id,
        name: match.apartment.name,
        rank: questState?.shortlistRank,
        memo: questState?.shortlistMemo,
        match,
        evaluation: userEvaluations[id],
        visits,
        myScore: calculateMyScore({
          hasVisit: visits.length > 0,
          evaluation: userEvaluations[id],
          priorities: quest.evaluationPriorities,
        }),
      },
    ]
  })

  function toggleExtra(apartmentId: string) {
    setExtraIds((current) => {
      if (current.includes(apartmentId)) {
        return current.filter((id) => id !== apartmentId)
      }
      const used = current.length
      if (used >= MAX_COMPARE) {
        return current
      }
      return [...current, apartmentId]
    })
  }

  if (!quest) {
    return null
  }

  return (
    <main className={styles.page}>

      <h1 className={styles.title}>단지 비교</h1>
      <p className={styles.note}>
        최대 4개 · 가로로 넘겨보기
      </p>

      {matches.length > 0 ? (
        <section className={styles.extras} aria-label="비교할 집 선택">
          <p className={styles.kicker}>비교할 집 선택</p>
          {extraIds.length ? <div className={styles.chips} aria-label="선택한 집">{extraIds.map(id => <button key={id} className={`${styles.chip} ${styles.chipOn}`} aria-pressed onClick={()=>toggleExtra(id)}>{matchById.get(id)?.apartment.name ?? '목록에 없는 단지'} ×</button>)}</div> : null}
          <details><summary>단지 추가</summary>
          <label>단지 이름·주소 검색 <input type="search" value={query} onChange={event=>{setQuery(event.target.value);setOptionPage(0)}} placeholder="단지 이름 또는 주소" /></label>
          <p role="status">추가할 수 있는 단지 {options.length}개 · 선택 {extraIds.length}/4</p>
          <div className={styles.chips}>
            {visibleOptions.map((item) => {
              const match = item
              const selected = extraIds.includes(item.apartment.id)
              if (!match) {
                return null
              }
              return (
                <button
                  key={item.apartment.id}
                  type="button"
                  className={selected ? `${styles.chip} ${styles.chipOn}` : styles.chip}
                  aria-pressed={selected}
                  disabled={!selected && extraIds.length >= MAX_COMPARE}
                  onClick={() => toggleExtra(item.apartment.id)}
                >
                  {match.apartment.name}
                </button>
              )
            })}
          </div>
          {optionPages>1 ? <nav className={styles.chips} aria-label="비교 단지 검색 페이지"><button className={styles.chip} disabled={page===0} onClick={()=>setOptionPage(page-1)}>이전</button><span>{page+1} / {optionPages}</span><button className={styles.chip} disabled={page===optionPages-1} onClick={()=>setOptionPage(page+1)}>다음</button></nav> : null}
          </details>
        </section>
      ) : null}

      {columns.length === 0 ? (
        <p className={styles.empty}>비교할 단지를 추가하세요.</p>
      ) : (
        <>
          <CompareSection title="확인된 정보" columns={columns} rows={verifiedRows(columns)} />
          <CompareSection title="나의 평가" columns={columns} rows={evaluationRows(columns)} />
          <CompareSection title="내가 남긴 이유" columns={columns} rows={decisionRows(columns)} />
        </>
      )}
    </main>
  )
}

function CompareSection({
  title,
  columns,
  rows,
}: {
  title: string
  columns: CompareColumn[]
  rows: Array<{ label: string; values: string[] }>
}) {
  return (
    <section className={styles.section} aria-labelledby={`${title}-heading`}>
      <h2 id={`${title}-heading`} className={styles.heading}>
        {title}
      </h2>
      <div
        className={styles.grid}
        tabIndex={0}
        role="region"
        aria-label={`${title} 비교표`}
      >
        <table className={styles.table} aria-label={title}>
        <thead><tr><th scope="col" className={styles.label}>단지</th>
        {columns.map((column) => (
          <th scope="col" key={column.id} className={styles.value}>
            <Link to={`/apartments/${column.id}`}>{column.name}</Link>
          </th>
        ))}
        </tr></thead><tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th scope="row" className={styles.label}>{row.label}</th>
            {row.values.map((value, index) => (
              <td key={`${row.label}-${columns[index]?.id ?? index}`} className={styles.value}>
                {value}
              </td>
            ))}
          </tr>
        ))}
        </tbody></table>
      </div>
    </section>
  )
}

function verifiedRows(
  columns: CompareColumn[],
): Array<{ label: string; values: string[] }> {
  const showParking = columns.some(
    (column) =>
      column.match.apartment.parkingCount !== undefined &&
      column.match.apartment.householdCount !== undefined,
  )
  const showFee = columns.some(
    (column) => column.match.apartment.managementFee?.monthlyAverage !== undefined,
  )

  const rows = [
    {
      label: '전용면적',
      values: columns.map((column) => column.match.displayUnit ? `${column.match.displayUnit.areaGroup}㎡` : '미확인'),
    },
    {
      label: '추정 가격',
      values: columns.map((column) => {
        const price = column.match.displayUnit?.priceEstimate?.estimatedPrice
        return price === undefined ? '—' : formatEok(price)
      }),
    },
    {
      label: '최근 범위',
      values: columns.map((column) => {
        const estimate = column.match.displayUnit?.priceEstimate
        return estimate
          ? `${formatEok(estimate.lowPrice)}–${formatEok(estimate.highPrice)}`
          : '—'
      }),
    },
    {
      label: '준공',
      values: columns.map((column) => formatApproval(column.match)),
    },
    {
      label: '세대수',
      values: columns.map((column) =>
        column.match.apartment.householdCount === undefined
          ? '—'
          : `${column.match.apartment.householdCount.toLocaleString('ko-KR')}세대`,
      ),
    },
  ]

  if (columns.some((column) => column.match.commute !== undefined)) {
    rows.splice(3, 0, {
      label: '통근',
      values: columns.map((column) => {
        const commute = column.match.commute
        return commute === undefined ? '—' : `${Math.round(commute.totalMinutes)}분`
      }),
    })
  }

  if (showParking) {
    rows.push({
      label: '주차',
      values: columns.map((column) => formatParking(column.match)),
    })
  }
  if (showFee) {
    rows.push({
      label: '관리비',
      values: columns.map((column) => {
        const fee = column.match.apartment.managementFee?.monthlyAverage
        return fee === undefined ? '—' : `월 ${Math.round(fee / 10_000)}만`
      }),
    })
  }

  return rows
}

function evaluationRows(
  columns: CompareColumn[],
): Array<{ label: string; values: string[] }> {
  return [
    {
      label: '내 점수',
      values: columns.map((column) =>
        column.myScore === undefined ? '—' : formatMyScore(column.myScore),
      ),
    },
    {
      label: '내 순서',
      values: columns.map((column) =>
        column.rank === undefined ? '최종 후보 아님' : String(column.rank),
      ),
    },
    ...EVALUATION_METRIC_ORDER.map((metric) => ({
      label: EVALUATION_METRIC_LABELS[metric],
      values: columns.map((column) => {
        const rating = column.evaluation?.ratings[metric]
        if (rating === undefined || rating === null) {
          return '평가 안 함'
        }
        return String(rating)
      }),
    })),
  ]
}

function decisionRows(
  columns: CompareColumn[],
): Array<{ label: string; values: string[] }> {
  return [
    {
      label: '추가 장단점',
      values: columns.map((column) => formatFactors(column.evaluation)),
    },
    {
      label: '최종 후보 메모',
      values: columns.map((column) => column.memo?.trim() || '—'),
    },
    {
      label: '임장 횟수',
      values: columns.map((column) => `${column.visits.length}회`),
    },
    {
      label: '좋았던 점',
      values: columns.map((column) => formatNotes(latestVisit(column.visits)?.pros)),
    },
    {
      label: '아쉬웠던 점',
      values: columns.map((column) => formatNotes(latestVisit(column.visits)?.cons)),
    },
  ]
}

function latestVisit(visits: Visit[]): Visit | undefined {
  return [...visits].sort((left, right) => right.visitedAt.localeCompare(left.visitedAt))[0]
}

function formatNotes(notes: string[] | undefined): string {
  if (!notes || notes.length === 0) {
    return '—'
  }
  return notes.slice(0, 2).join(' · ')
}

function formatFactors(evaluation: UserEvaluation | undefined): string {
  if (!evaluation || evaluation.adjustments.length === 0) {
    return '—'
  }
  return evaluation.adjustments
    .slice(0, 3)
    .map(
      (item) =>
        `${ADJUSTMENT_TYPE_LABELS[item.type]} · ${item.description}`,
    )
    .join(' · ')
}

function formatApproval(match: DiscoverMatch): string {
  const approval = match.apartment.approvalDate
  if (!approval) {
    return '—'
  }
  const age = calculateBuildingAge(approval)
  const year = approval.slice(0, 4)
  return age === undefined ? `${year}년` : `${year}년 · ${age}년차`
}

function formatParking(match: DiscoverMatch): string {
  const { parkingCount, householdCount } = match.apartment
  if (parkingCount === undefined || householdCount === undefined) {
    return '—'
  }
  const value = calculateParkingPerHousehold(parkingCount, householdCount)
  if (value === undefined) {
    return '—'
  }
  const rounded = Math.round(value * 10) / 10
  return `${Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)}대/세대`
}
