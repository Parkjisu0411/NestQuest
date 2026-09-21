import { LiveDataSync } from '../../ui/LiveDataSync.tsx'
import { CommuteStatus } from '../../ui/CommuteStatus.tsx'
import { useMemo, useState } from 'react'
import { transactionsForUnit } from '../../domain/unitTransactions.ts'
import { Link, useParams } from 'react-router'
import { useQuestDispatch, useQuestState } from '../../app/useQuest.ts'
import {
  calculateBuildingAge,
  calculateDiscoverBudgetCeiling,
  calculateParkingPerHousehold,
  calculatePurchaseBudget,
  formatEok,
  formatManWon,
} from '../../domain/calculations.ts'
import { buildDiscoverMatch, discoverApartments } from '../../domain/discover.ts'
import type {
  AIResearch,
  AIResearchCategory,
  ApartmentUnitType,
  CommuteRouteSegment,
  EvaluationPriorities,
  QuestStage,
  PassReason,
  QuestState,
  Transaction,
  UserEvaluation,
  Visit,
} from '../../domain/models.ts'
import {
  ADJUSTMENT_TYPE_LABELS,
  EVALUATION_METRIC_LABELS,
  EVALUATION_METRIC_ORDER,
  PRICE_CONFIDENCE_LABELS,
  RESEARCH_CATEGORY_LABELS,
} from '../../domain/models.ts'
import { calculateMyScore, formatMyScore } from '../../domain/scoring.ts'
import { formatVisitWhen, formatVisitClock } from '../../domain/visitFormat.ts'
import { useApartmentCatalog } from '../../data/useApartmentCatalog.ts'
import { PageChrome } from '../../ui/PageChrome.tsx'
import { StatusLabel } from '../../ui/StatusLabel.tsx'
import styles from './ApartmentDetailScreen.module.css'

const RESEARCH_CATEGORIES: AIResearchCategory[] = ['COMMERCIAL', 'SCHOOL_DISTRICT']
const PASS_LABELS: Record<PassReason, string> = { PRICE: '가격', COMMUTE: '통근', COMPLEX: '단지 조건', NEIGHBORHOOD: '주변 환경', AFTER_VISIT: '임장 후 판단', OTHER: '기타' }

export function ApartmentDetailScreen() {
  const apartmentCatalog = useApartmentCatalog()
  const { apartmentId = '' } = useParams()
  const dispatch = useQuestDispatch()
  const { quest, apartmentQuestStates, visitsByApartmentId, userEvaluations } =
    useQuestState()
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [openGuide, setOpenGuide] = useState<AIResearchCategory | null>(null)

  const record = apartmentCatalog.find(apartmentId)
  const questState = apartmentQuestStates[apartmentId]
  const stage = questState?.stage ?? 'DISCOVERED'

  const match = useMemo(() => {
    if (!record || !quest) {
      return undefined
    }
    return (
      discoverApartments([record], quest.searchCriteria)[0] ??
      (questState && questState.stage !== 'DISCOVERED'
        ? buildDiscoverMatch(record, quest.searchCriteria, new Date(), 'retained')
        : undefined)
    )
  }, [quest, questState, record])

  if (!record) {
    return (
      <main className={styles.page}>
        <PageChrome backTo="/" backLabel="내 집 찾기" />
        <p className={styles.missing}>단지를 찾을 수 없습니다.</p>
      </main>
    )
  }

  const targetUnits =
    match?.eligibleUnitTypes ??
    (questState
      ? record.unitTypes.filter((unit) =>
          questState.targetUnitTypeIds.includes(unit.id),
        )
      : record.unitTypes)
  const units = targetUnits.length > 0 ? targetUnits : record.unitTypes
  const selectedUnit =
    units.find((unit) => unit.id === selectedUnitId) ??
    match?.displayUnit ??
    units[0]
  const destination = quest?.searchCriteria.commuteDestination
  const commute = destination
    ? (match?.commute ??
      record.commutes.find((item) => item.destinationId === destination.id))
    : undefined
  const destinationName = destination?.name
  const purchaseBudget = quest
    ? calculatePurchaseBudget(
        quest.searchCriteria.availableCash,
        quest.searchCriteria.expectedLoanLimit,
      )
    : undefined
  const ceiling =
    purchaseBudget === undefined
      ? undefined
      : calculateDiscoverBudgetCeiling(purchaseBudget)
  const estimatedPrice = selectedUnit?.priceEstimate?.estimatedPrice
  const nearBudget =
    purchaseBudget !== undefined &&
    ceiling !== undefined &&
    estimatedPrice !== undefined &&
    estimatedPrice > purchaseBudget &&
    estimatedPrice <= ceiling
  const transactions = transactionsForUnit(record.transactions ?? [], selectedUnit)
  const researchByCategory = new Map(
    (record.research ?? []).map((item) => [item.category, item]),
  )

  return (
    <main className={styles.page}>
      <PageChrome backTo="/" backLabel="내 집 찾기" />

      <LiveDataSync apartmentId={apartmentId} />
      {!commute ? <p role="status"><CommuteStatus apartment={record.apartment} /></p> : null}
      <section className={styles.section} aria-labelledby="overview-heading">
        
        <h1 id="overview-heading" className={styles.title}>
          {record.apartment.name}
        </h1>
        <p className={styles.body}>{record.apartment.address}</p>
        {record.source ? <details className={styles.meta}><summary>자료 정보</summary><p>{record.source.provider} · {record.source.fetchedAt.slice(0, 10)}</p><p>12개월 실거래 중앙값 · 매물 호가 아님</p></details> : null}
        
        <p className={styles.location}>
          {record.area.sidoName} {record.area.sigunguName}
        </p>
        <StatusLabel stage={stage} />
        {units.length > 0 ? (
          <div className={styles.units} role="group" aria-label="대상 평형">
            {units.map((unit) => {
              const selected = unit.id === selectedUnit?.id
              return (
                <button
                  key={unit.id}
                  type="button"
                  className={selected ? `${styles.chip} ${styles.chipOn}` : styles.chip}
                  aria-pressed={selected}
                  onClick={() => setSelectedUnitId(unit.id)}
                >
                  {units.filter(other => other.areaGroup === unit.areaGroup).length > 1 ? unit.exclusiveAreas.join(' / ') : unit.areaGroup}㎡
                </button>
              )
            })}
          </div>
        ) : null}
      </section>

      {selectedUnit ? (
        <PriceSection
          isLive={apartmentCatalog.mode === 'live'}
          unit={selectedUnit}
          nearBudget={nearBudget}
          transactions={transactions}
        />
      ) : null}

      {commute ? (
        <section className={styles.section} aria-labelledby="commute-heading">
          <h2 id="commute-heading" className={styles.heading}>
            출퇴근
          </h2>
          <p className={styles.lead}>
            {destinationName}까지 {Math.round(commute.totalMinutes)}분
          </p>
          {commute.provider === 'Kakao' ? <p className={styles.meta}>카카오 · {commute.calculatedAt.slice(0,10)} 조회 결과 · <Link to="/connections">통근 갱신</Link></p> : null}
          <ol className={styles.route}>
            {commute.route.map((segment, index) => (
              <li key={`${segment.type}-${index}`}>{formatSegment(segment)}</li>
            ))}
          </ol>
          {commute.walkingMinutes !== undefined || commute.transferCount ? (
            <p className={styles.meta}>
              {[
                commute.walkingMinutes !== undefined
                  ? `도보 ${Math.round(commute.walkingMinutes)}분`
                  : undefined,
                commute.transferCount ? `환승 ${commute.transferCount}회` : undefined,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          ) : null}
        </section>
      ) : null}

      <ComplexFactsSection apartment={record.apartment} />

      <details className={`${styles.section} ${styles.research}`}>
        <summary>주변 조사</summary>
        
        {RESEARCH_CATEGORIES.map((category) => (
          <ResearchBlock
            key={category}
            category={category}
            research={researchByCategory.get(category)}
            apartmentName={record.apartment.name}
            address={record.apartment.address}
            guideOpen={openGuide === category}
            onToggleGuide={() =>
              setOpenGuide((current) => (current === category ? null : category))
            }
          />
        ))}
      </details>

      <section className={styles.section} aria-labelledby="quest-heading">
        <h2 id="quest-heading" className={styles.heading}>
          이 집에 대한 내 기록
        </h2>
        <StatusLabel stage={stage} />
        <MyQuestPanel
          key={apartmentId}
          apartmentId={record.apartment.id}
          stage={stage}
          questState={questState}
          visits={visitsByApartmentId[record.apartment.id] ?? []}
          evaluation={userEvaluations[record.apartment.id]}
          priorities={quest?.evaluationPriorities}
          onAddCandidate={() =>
            dispatch({ type: 'markCandidate', apartmentId: record.apartment.id })
          }
        />
      </section>
      <div className={styles.quickAction}>
        <Link to={`/apartments/${apartmentId}/visit`} className={styles.primary}>임장 기록</Link>
      </div>
    </main>
  )
}

function PriceSection({
  isLive,
  unit,
  nearBudget,
  transactions,
}: {
  isLive: boolean
  unit: ApartmentUnitType
  nearBudget: boolean
  transactions: Transaction[]
}) {
  const estimate = unit.priceEstimate
  const exclusive = unit.exclusiveAreas[0]

  return (
    <section className={styles.section} aria-labelledby="price-heading">
      <h2 id="price-heading" className={styles.heading}>
        가격
      </h2>
      <p className={styles.lead}>
        {unit.areaGroup}㎡
        {exclusive !== undefined && exclusive !== unit.areaGroup
          ? ` · 전용 ${exclusive}㎡`
          : ''}
      </p>
      {estimate ? (
        <>
          <p className={styles.price}>
            {formatEok(estimate.estimatedPrice)}
            {nearBudget ? <span className={styles.near}>예산 근처</span> : null}
          </p>
          <p className={styles.priceMeta}>
            {`최근 ${formatEok(estimate.lowPrice)}–${formatEok(estimate.highPrice)} · ${formatEok(estimate.latestPrice)} · ${estimate.transactionCount}건 · ${PRICE_CONFIDENCE_LABELS[estimate.confidence]}`}
          </p>
        </>
      ) : (
        <p className={styles.body}>가격 추정이 없습니다.</p>
      )}
      {transactions.length > 0 ? (
        <ul className={styles.sales}>
          {transactions.map((item) => (
            <li key={item.id}>
              <span>{formatDotDate(item.contractDate)}</span>
              <span>{formatEok(item.price)}</span>
              <span>{item.floor !== undefined ? `${item.floor}층` : ''}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className={styles.note}>{isLive ? '공개 실거래를 바탕으로 한 참고 가격입니다. 현재 매물 호가가 아닙니다.' : '예시 시세입니다. 현재 시장가가 아닙니다.'}</p>
    </section>
  )
}

function ComplexFactsSection({
  apartment,
}: {
  apartment: {
    approvalDate?: string
    householdCount?: number
    buildingCount?: number
    parkingCount?: number
    heatingType?: string
    managementFee?: { monthlyAverage?: number; periodMonths?: number }
  }
}) {
  const buildingAge = apartment.approvalDate
    ? calculateBuildingAge(apartment.approvalDate)
    : undefined
  const parking =
    apartment.parkingCount !== undefined && apartment.householdCount !== undefined
      ? calculateParkingPerHousehold(apartment.parkingCount, apartment.householdCount)
      : undefined
  const rows: Array<{ label: string; value: string }> = []

  if (apartment.approvalDate) {
    const year = apartment.approvalDate.slice(0, 4)
    rows.push({
      label: '준공',
      value:
        buildingAge === undefined ? `${year}년` : `${year}년 · ${buildingAge}년차`,
    })
  }
  if (apartment.householdCount !== undefined) {
    rows.push({
      label: '세대수',
      value: `${apartment.householdCount.toLocaleString('ko-KR')}세대`,
    })
  }
  if (apartment.buildingCount !== undefined) {
    rows.push({
      label: '동수',
      value: `${apartment.buildingCount}동`,
    })
  }
  if (parking !== undefined) {
    rows.push({
      label: '주차',
      value: `${formatParking(parking)}대/세대`,
    })
  } else if (apartment.parkingCount !== undefined) {
    rows.push({
      label: '주차',
      value: `${apartment.parkingCount.toLocaleString('ko-KR')}대`,
    })
  }
  if (apartment.heatingType) {
    rows.push({ label: '난방', value: apartment.heatingType })
  }
  if (apartment.managementFee?.monthlyAverage !== undefined) {
    rows.push({
      label: '관리비',
      value: `월 평균 ${formatManWon(apartment.managementFee.monthlyAverage)}`,
    })
  }

  if (rows.length === 0) {
    return null
  }

  return (
    <section className={styles.section} aria-labelledby="facts-heading">
      <h2 id="facts-heading" className={styles.heading}>
        단지 정보
      </h2>
      <dl className={styles.factGrid}>
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function ResearchBlock({
  category,
  research,
  apartmentName,
  address,
  guideOpen,
  onToggleGuide,
}: {
  category: AIResearchCategory
  research: AIResearch | undefined
  apartmentName: string
  address: string
  guideOpen: boolean
  onToggleGuide: () => void
}) {
  return (
    <div className={styles.researchBlock}>
      <h3 className={styles.subheading}>{RESEARCH_CATEGORY_LABELS[category]}</h3>
      {research ? (
        <>
          <p className={styles.body}>{research.summary}</p>
          {research.sources.length > 0 ? (
            <ul className={styles.sources}>
              {research.sources.map((source, index) => (
                <li key={`${source.url ?? source.title ?? index}`}>
                  {source.url ? (
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {source.title ?? source.url}
                    </a>
                  ) : (
                    <span>{source.title ?? '출처'}</span>
                  )}
                  {source.publisher ? (
                    <span className={styles.publisher}> · {source.publisher}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          <p className={styles.meta}>조사일 {formatDotDate(research.researchedAt)}</p>
        </>
      ) : (
        <>
          <p className={styles.body}>아직 조사하지 않았어요.</p>
          <button
            type="button"
            className={styles.guide}
            aria-expanded={guideOpen}
            onClick={onToggleGuide}
          >
            AI 리서치 가이드
          </button>
          {guideOpen ? (
            <aside className={styles.stub} aria-label="AI 리서치 안내">
              <p>NestQuest는 AI를 호출하지 않습니다. 아래 안내를 외부에서 참고하세요.</p>
              <pre className={styles.prompt}>
                {researchGuidePrompt(apartmentName, address, category)}
              </pre>
            </aside>
          ) : null}
        </>
      )}
    </div>
  )
}

function formatSegment(segment: CommuteRouteSegment): string {
  if (segment.type === 'WALK') {
    const toward = segment.to ? ` · ${segment.to}` : ''
    return `도보 ${Math.round(segment.durationMinutes)}분${toward}`
  }

  const line = segment.lineName ?? (segment.type === 'BUS' ? '버스' : '지하철')
  const span =
    segment.from && segment.to ? ` · ${segment.from} → ${segment.to}` : ''
  return `${line}${span} ${Math.round(segment.durationMinutes)}분`
}

function formatDotDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) {
    return value
  }
  return `${match[1]}.${match[2]}.${match[3]}`
}

function formatParking(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function MyQuestPanel({
  apartmentId,
  stage,
  questState,
  visits,
  evaluation,
  priorities,
  onAddCandidate,
}: {
  apartmentId: string
  stage: QuestStage
  questState: QuestState | undefined
  visits: Visit[]
  evaluation: UserEvaluation | undefined
  priorities: EvaluationPriorities | undefined
  onAddCandidate: () => void
}) {
  const dispatch = useQuestDispatch()
  const hasVisit = visits.length > 0
  const [passing, setPassing] = useState(false)
  const [reason, setReason] = useState<PassReason>('OTHER')
  const [passMemo, setPassMemo] = useState('')
  const myScore =
    priorities === undefined
      ? undefined
      : calculateMyScore({ hasVisit, evaluation, priorities })
  const history = [...visits].sort((left, right) =>
    right.visitedAt.localeCompare(left.visitedAt),
  )

  return (
    <>
      {stage === 'SHORTLIST' ? (
        <p className={styles.body}>
          내가 남긴 최종 후보
          {questState?.shortlistRank !== undefined ? ` · 내 순서 ${questState.shortlistRank}` : ''}
          . 점수가 자리를 정하지 않습니다.
        </p>
      ) : null}

      {myScore !== undefined ? (
        <p className={styles.score}>내 점수 {formatMyScore(myScore)}</p>
      ) : null}

      {evaluation ? (
        <dl className={styles.ratings}>
          {EVALUATION_METRIC_ORDER.map((metric) => {
            const rating = evaluation.ratings[metric]
            return (
              <div key={metric}>
                <dt>{EVALUATION_METRIC_LABELS[metric]}</dt>
                <dd>{rating === null ? '평가 안 함' : rating}</dd>
              </div>
            )
          })}
        </dl>
      ) : null}

      {evaluation && evaluation.adjustments.length > 0 ? (
        <ul className={styles.factors}>
          {evaluation.adjustments.map((item) => (
            <li key={item.id}>
              {ADJUSTMENT_TYPE_LABELS[item.type]} · {item.description}
            </li>
          ))}
        </ul>
      ) : null}

      {hasVisit ? (
        <div className={styles.history}>
          <h3 className={styles.subheading}>내 임장</h3>
          <ul>
            {history.map((visit) => (
              <li key={visit.id}>
                <p className={styles.historyWhen}>
                  {formatVisitWhen(visit.visitedAt, visit.visitType)}
                  {' · '}{formatVisitClock(visit.visitedAt)}
                </p>
                {visit.pros[0] ? <p className={styles.body}>+ {visit.pros[0]}</p> : null}
                {visit.cons[0] ? <p className={styles.body}>- {visit.cons[0]}</p> : null}
                <Link
                  to={`/apartments/${apartmentId}/visits/${visit.id}`}
                  className={styles.quiet}
                  aria-label={`${formatVisitWhen(visit.visitedAt, visit.visitType)} ${formatVisitClock(visit.visitedAt)} 기록 전체 보기 · 사진 ${visit.photos.length}장`}
                >
                  기록 전체 보기 · 사진 {visit.photos.length}장
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className={styles.body}>아직 방문 기록이 없어요.</p>
      )}

      <div className={styles.actions}>
        {stage === 'PASSED' ? (
          <div className={styles.passPanel}>
            <h3 className={styles.subheading}>제외한 집</h3>
            <p className={styles.body}>{questState?.passReason ? PASS_LABELS[questState.passReason] : '사유 없음'}</p>
            {questState?.passMemo ? <p className={styles.passMemo}>{questState.passMemo}</p> : null}
            <p className={styles.body}>방문 기록과 평가는 보관됩니다. 복원하면 {hasVisit ? '다녀온 집' : '관심'}으로 돌아갑니다.</p>
            <button type="button" className={styles.primary} onClick={() => dispatch({ type: 'restoreApartment', apartmentId })}>다시 검토하기</button>
          </div>
        ) : passing ? (
          <form className={styles.passPanel} onSubmit={(event) => {
            event.preventDefault()
            dispatch({ type: 'passApartment', apartmentId, reason, memo: passMemo })
            setPassing(false)
            setPassMemo('')
          }}>
            <label>제외 사유<select value={reason} onChange={(event) => setReason(event.target.value as PassReason)}>
              {Object.entries(PASS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            <label>제외 메모 (선택)<textarea value={passMemo} onChange={(event) => setPassMemo(event.target.value)} rows={3} /></label>
            <p className={styles.body}>목록에서 숨기고 방문 기록·사진·평가는 보관합니다. 최종 후보 순위에서는 빠집니다.</p>
            <button type="submit" className={styles.secondary}>제외하기</button>
            <button type="button" className={styles.quiet} onClick={() => setPassing(false)}>취소</button>
          </form>
        ) : <button type="button" className={styles.quiet} onClick={() => setPassing(true)}>후보 제외</button>}
        {hasVisit ? (
          <Link to={`/apartments/${apartmentId}/evaluation`} className={styles.secondary}>
            {evaluation ? '평가 수정' : '평가하기'}
          </Link>
        ) : null}
        {stage === 'DISCOVERED' ? (
          <button type="button" className={styles.primary} onClick={onAddCandidate}>
            관심에 담기
          </button>
        ) : null}
        {stage !== 'PASSED' && stage !== 'SHORTLIST' ? (
          <button
            type="button"
            className={styles.primary}
            onClick={() => dispatch({ type: 'addToShortlist', apartmentId })}
          >
            최종 후보에 추가
          </button>
        ) : null}
        {stage === 'SHORTLIST' ? (
          <ShortlistMemoEditor
            key={apartmentId}
            apartmentId={apartmentId}
            initialMemo={questState?.shortlistMemo ?? ''}
          />
        ) : null}
      </div>
    </>
  )
}

function ShortlistMemoEditor({
  apartmentId,
  initialMemo,
}: {
  apartmentId: string
  initialMemo: string
}) {
  const dispatch = useQuestDispatch()
  const [memo, setMemo] = useState(initialMemo)

  return (
    <>
      <label className={styles.memoField}>
        <span>왜 이 집을 남겨 두었나요?</span>
        <textarea
          rows={3}
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
          placeholder="출퇴근이 우선이면 1순위로 두고 싶다"
        />
      </label>
      <button
        type="button"
        className={styles.secondary}
        onClick={() => dispatch({ type: 'setShortlistMemo', apartmentId, memo })}
      >
        메모 저장
      </button>
      <button
        type="button"
        className={styles.quiet}
        onClick={() => dispatch({ type: 'removeFromShortlist', apartmentId })}
      >
        최종 후보에서 빼기
      </button>
    </>
  )
}

function researchGuidePrompt(
  apartmentName: string,
  address: string,
  category: AIResearchCategory,
): string {
  const topic = RESEARCH_CATEGORY_LABELS[category]
  return `아래 아파트의 ${topic}을 조사해 주세요.

단지: ${apartmentName}
주소: ${address}

- 확인된 사실과 확인하지 못한 점을 구분하세요.
- 추측하지 마세요.
- 근거와 출처, 조사 날짜를 밝혀 주세요.
- 점수를 매기지 마세요.

NestQuest는 이 내용을 확인된 사실로 취급하지 않습니다.`
}
