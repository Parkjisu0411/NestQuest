import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { useQuestDispatch, useQuestState } from '../../app/useQuest.ts'
import { calculatePurchaseBudget, eokToWon, formatEok } from '../../domain/calculations.ts'
import {
  EVALUATION_METRIC_LABELS,
  EVALUATION_METRIC_ORDER,
  REFERENCE_LOAN_ASSUMPTION,
  type CommuteDestination,
  type EvaluationPriorities,
  type EvaluationPriority,
  type QuestArea,
  type SearchCriteria,
} from '../../domain/models.ts'
import { StationPicker } from '../../ui/StationPicker.tsx'
import {
  SEOUL_SIDO_CODE,
  mergeQuestAreas,
  questAreasForSido,
} from '../../mock/areas.ts'
import { AreaSelector } from './AreaSelector.tsx'
import styles from './SetupScreen.module.css'

type PriorityDraft = Record<keyof EvaluationPriorities, EvaluationPriority | null>

const STEP_LABELS = ['지역', '예산', '집 조건', '출퇴근', '내가 중요하게 보는 것']
const PRIORITY_CHOICES: EvaluationPriority[] = [0, 1, 2, 3, 4]

const PRIORITY_CHOICE_LABELS: Record<EvaluationPriority, string> = {
  0: '평가 안 함',
  1: '낮음',
  2: '보통',
  3: '높음',
  4: '매우 높음',
}

const PRIORITY_QUESTIONS: Record<keyof EvaluationPriorities, string> = {
  stationAccess: '역 접근성은 얼마나 중요한가요?',
  commuteFeel: '통근 체감은 얼마나 중요한가요?',
  commercial: '상권은 얼마나 중요한가요?',
  school: '학군은 얼마나 중요한가요?',
  nature: '자연 / 산책은 얼마나 중요한가요?',
  neighborhood: '동네 분위기는 얼마나 중요한가요?',
}

const LOAN_GUIDE_PROMPT = `아래 조건으로 주택담보대출 한도를 조사해 주세요.

- 실제 한도를 계산하거나 승인 여부를 단정하지 마세요.
- 확인해야 할 서류, 질문, 주의점을 근거와 함께 알려 주세요.
- 모르는 것은 추측하지 마세요.
- 조사 날짜를 밝혀 주세요.

NestQuest는 대출 심사를 하지 않습니다. 사용자가 직접 한도를 입력합니다.`

function parseEnteredNumber(raw: string): number | undefined {
  const trimmed = raw.trim()
  if (trimmed === '') {
    return undefined
  }
  const value = Number(trimmed)
  if (!Number.isFinite(value)) {
    return undefined
  }
  return value
}

function toEvaluationPriorities(draft: PriorityDraft): EvaluationPriorities | null {
  const { stationAccess, commuteFeel, commercial, school, nature, neighborhood } =
    draft
  if (
    stationAccess === null ||
    commuteFeel === null ||
    commercial === null ||
    school === null ||
    nature === null ||
    neighborhood === null
  ) {
    return null
  }

  return {
    stationAccess,
    commuteFeel,
    commercial,
    school,
    nature,
    neighborhood,
  }
}

function emptyPriorities(): PriorityDraft {
  return {
    stationAccess: null,
    commuteFeel: null,
    commercial: null,
    school: null,
    nature: null,
    neighborhood: null,
  }
}

function firstUnansweredPriority(draft: PriorityDraft): number {
  const index = EVALUATION_METRIC_ORDER.findIndex((metric) => draft[metric] === null)
  return index === -1 ? EVALUATION_METRIC_ORDER.length : index
}

function optionalDraft(value: number | undefined, scale = 1): string {
  return value === undefined ? '' : String(value / scale)
}

function isValidOptional(value: number | undefined): boolean {
  return value === undefined || value >= 0
}

function omittedLabel(value: string | undefined): string {
  return value ?? '조건 없음'
}

export function SetupScreen() {
  const navigate = useNavigate()
  const dispatch = useQuestDispatch()
  const { quest, setupCompleted } = useQuestState()

  const [step, setStep] = useState(0)
  const [commutePhase, setCommutePhase] = useState<'destination' | 'minutes'>(
    'destination',
  )
  const [priorityIndex, setPriorityIndex] = useState(0)

  const [areas, setAreas] = useState<QuestArea[]>(quest?.searchCriteria.areas ?? [])
  const [cashEok, setCashEok] = useState(
    optionalDraft(quest?.searchCriteria.availableCash, 100_000_000),
  )
  const [loanEok, setLoanEok] = useState(
    optionalDraft(quest?.searchCriteria.expectedLoanLimit, 100_000_000),
  )
  const [minExclusiveArea, setMinExclusiveArea] = useState(
    optionalDraft(quest?.searchCriteria.minExclusiveArea),
  )
  const [maxBuildingAge, setMaxBuildingAge] = useState(
    optionalDraft(quest?.searchCriteria.maxBuildingAge),
  )
  const [minHouseholdCount, setMinHouseholdCount] = useState(
    optionalDraft(quest?.searchCriteria.minHouseholdCount),
  )
  const [destination, setDestination] = useState<CommuteDestination | undefined>(quest?.searchCriteria.commuteDestination)
  const [maxCommuteMinutes, setMaxCommuteMinutes] = useState(
    optionalDraft(quest?.searchCriteria.maxCommuteMinutes),
  )
  const [priorities, setPriorities] = useState<PriorityDraft>(
    quest?.evaluationPriorities ?? emptyPriorities(),
  )
  const [loanGuideOpen, setLoanGuideOpen] = useState(false)
  const [hint, setHint] = useState('')

  const selectedCodes = useMemo(
    () => new Set(areas.map((area) => area.sigunguCode)),
    [areas],
  )

  const cashEokValue = parseEnteredNumber(cashEok)
  const loanEokValue = parseEnteredNumber(loanEok)
  const cashWonValue = cashEokValue === undefined ? undefined : eokToWon(cashEokValue)
  const loanWon = loanEokValue === undefined ? undefined : eokToWon(loanEokValue)
  const minArea = parseEnteredNumber(minExclusiveArea)
  const maxAge = parseEnteredNumber(maxBuildingAge)
  const minHouseholds = parseEnteredNumber(minHouseholdCount)
  const maxMinutes = parseEnteredNumber(maxCommuteMinutes)

  const purchaseBudget = calculatePurchaseBudget(cashWonValue, loanWon)

  const prioritiesComplete = EVALUATION_METRIC_ORDER.every(
    (metric) => priorities[metric] !== null,
  )
  const reviewingPriorities = priorityIndex >= EVALUATION_METRIC_ORDER.length
  const activeMetric = EVALUATION_METRIC_ORDER[priorityIndex]
  const seoulAreas = questAreasForSido(SEOUL_SIDO_CODE)
  const allSeoulSelected =
    seoulAreas.length > 0 &&
    seoulAreas.every((area) => selectedCodes.has(area.sigunguCode))

  const canFinish =
    areas.length > 0 &&
    prioritiesComplete &&
    isValidOptional(cashWonValue) &&
    isValidOptional(loanWon) &&
    isValidOptional(minArea) &&
    isValidOptional(maxAge) &&
    isValidOptional(minHouseholds) &&
    isValidOptional(maxMinutes)

  function toggleArea(area: QuestArea) {
    setAreas((current) => {
      const exists = current.some((item) => item.sigunguCode === area.sigunguCode)
      if (exists) {
        return current.filter((item) => item.sigunguCode !== area.sigunguCode)
      }
      return [...current, area]
    })
  }

  function selectSido(sidoCode: string) {
    setAreas((current) => mergeQuestAreas(current, questAreasForSido(sidoCode)))
    setHint('')
  }

  function clearAreas() {
    setAreas([])
    setHint('')
  }

  function goBack() {
    setHint('')
    if (step === 3 && commutePhase === 'minutes') {
      setCommutePhase('destination')
      return
    }
    if (step === 4 && priorityIndex > 0) {
      setPriorityIndex((current) => current - 1)
      return
    }
    if (step > 0) {
      setStep((current) => current - 1)
    }
  }

  function goNext() {
    if (step === 0 && areas.length === 0) {
      setHint('지역을 하나 이상 골라 주세요.')
      return
    }
    if (step === 1 && (!isValidOptional(cashWonValue) || !isValidOptional(loanWon))) {
      setHint('0 이상으로 입력하거나 비워 주세요.')
      return
    }
    if (
      step === 2 &&
      (!isValidOptional(minArea) ||
        !isValidOptional(maxAge) ||
        !isValidOptional(minHouseholds))
    ) {
      setHint('0 이상으로 입력하거나 비워 주세요.')
      return
    }
    if (step === 3 && commutePhase === 'destination') {
      if (!destination) {
        skipCommuteDestination()
        return
      }
      setHint('')
      setCommutePhase('minutes')
      return
    }
    if (step === 3 && commutePhase === 'minutes' && !isValidOptional(maxMinutes)) {
      setHint('0 이상으로 입력하거나 비워 주세요.')
      return
    }
    if (step === 4 && !prioritiesComplete) {
      setHint('여섯 가지를 모두 골라 주세요.')
      return
    }

    setHint('')
    if (step === 3) {
      setPriorityIndex(firstUnansweredPriority(priorities))
    }
    setStep((current) => current + 1)
  }

  function skipCommuteDestination() {
    setDestination(undefined)
    setMaxCommuteMinutes('')
    setCommutePhase('destination')
    setHint('')
    setPriorityIndex(firstUnansweredPriority(priorities))
    setStep(4)
  }

  function selectDestination(value: CommuteDestination | undefined) {
    setDestination(value)
    setHint('')
    if (value) setCommutePhase('minutes')
  }

  function selectPriority(choice: EvaluationPriority) {
    if (!activeMetric) {
      return
    }

    const nextDraft: PriorityDraft = { ...priorities, [activeMetric]: choice }
    setPriorities(nextDraft)
    setHint('')

    if (EVALUATION_METRIC_ORDER.every((metric) => nextDraft[metric] !== null)) {
      setPriorityIndex(EVALUATION_METRIC_ORDER.length)
      return
    }

    const nextUnanswered = EVALUATION_METRIC_ORDER.findIndex(
      (metric, index) => index > priorityIndex && nextDraft[metric] === null,
    )
    if (nextUnanswered >= 0) {
      setPriorityIndex(nextUnanswered)
      return
    }
    setPriorityIndex(firstUnansweredPriority(nextDraft))
  }

  function completeSetup() {
    if (!canFinish) {
      setHint('평가 중요도를 모두 골라 주세요.')
      return
    }

    const evaluationPriorities = toEvaluationPriorities(priorities)
    if (evaluationPriorities === null) {
      setHint('평가 중요도를 모두 골라 주세요.')
      return
    }

    const searchCriteria: SearchCriteria = {
      areas,
    }
    if (destination !== undefined) {
      searchCriteria.commuteDestination = destination
    }
    if (cashWonValue !== undefined) {
      searchCriteria.availableCash = cashWonValue
    }
    if (loanWon !== undefined) {
      searchCriteria.expectedLoanLimit = loanWon
    }
    if (minArea !== undefined) {
      searchCriteria.minExclusiveArea = minArea
    }
    if (maxAge !== undefined) {
      searchCriteria.maxBuildingAge = maxAge
    }
    if (minHouseholds !== undefined) {
      searchCriteria.minHouseholdCount = minHouseholds
    }
    if (destination !== undefined && maxMinutes !== undefined) {
      searchCriteria.maxCommuteMinutes = maxMinutes
    }

    const now = new Date().toISOString()
    dispatch({
      type: 'completeSetup',
      quest: {
        id: quest?.id ?? crypto.randomUUID(),
        searchCriteria,
        evaluationPriorities,
        loanAssumption: quest?.loanAssumption ?? REFERENCE_LOAN_ASSUMPTION,
        createdAt: quest?.createdAt ?? now,
        updatedAt: now,
      },
    })
    navigate('/')
  }

  const showBack = step > 0 || commutePhase === 'minutes' || priorityIndex > 0
  const showNext = step < 4
  const showFinish = step === 4 && reviewingPriorities

  if (setupCompleted) {
    return <Navigate to="/" replace />
  }

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.top}>
          <p className={styles.brand}>NestQuest</p>
          <p className={styles.progress}>
            {STEP_LABELS[step]} · {step + 1} / {STEP_LABELS.length}
          </p>
        </div>
        {showBack ? (
          <button type="button" className={styles.back} onClick={goBack}>
            이전
          </button>
        ) : null}
      </header>
      {step === 0 ? <Link className={styles.restoreLink} to="/restore">백업으로 시작</Link> : null}

      {step === 0 ? (
        <section className={styles.step}>
          <h1 className={styles.question}>탐색 지역</h1>
          <div className={styles.bulkRow}>
            <button
              type="button"
              className={allSeoulSelected ? `${styles.bulk} ${styles.bulkOn}` : styles.bulk}
              aria-pressed={allSeoulSelected}
              onClick={() => selectSido(SEOUL_SIDO_CODE)}
            >
              서울 전체
            </button>

            <button type="button" className={styles.bulk} onClick={clearAreas}>
              전체 해제
            </button>
          </div>
          
          <AreaSelector selectedCodes={selectedCodes} onToggle={toggleArea} />
          <p className={styles.selectedAreas} aria-live="polite">
            {areas.length === 0
              ? '지도에서 지역을 선택하세요'
              : allSeoulSelected ? '서울 전체 선택' : `${areas.length}개 구 선택`}
          </p>
        </section>
      ) : null}

      {step === 1 ? (
        <section className={styles.step}>
          <h1 className={styles.question}>구매 예산</h1>
          <p className={styles.support}>선택 입력</p>
          <label className={styles.field}>
            <span>내 자금</span>
            <span className={styles.inputRow}>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                placeholder="예: 3.0"
                value={cashEok}
                onChange={(event) => setCashEok(event.target.value)}
              />
              <span className={styles.suffix}>억</span>
            </span>
          </label>
          <label className={styles.field}>
            <span>예상 대출한도</span>
            <span className={styles.inputRow}>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                placeholder="예: 5.0"
                value={loanEok}
                onChange={(event) => setLoanEok(event.target.value)}
              />
              <span className={styles.suffix}>억</span>
            </span>
          </label>
          <p className={styles.budget}>
            구매예산
            <strong>
              {purchaseBudget === undefined ? '조건 없음' : formatEok(purchaseBudget)}
            </strong>
          </p>
          <button
            type="button"
            className={styles.ghostButton}
            onClick={() => setLoanGuideOpen((open) => !open)}
            aria-expanded={loanGuideOpen}
          >
            대출한도 알아보기
          </button>
          {loanGuideOpen ? (
            <aside className={styles.stub} aria-label="대출한도 조사 안내">
              <p>한도는 직접 입력합니다. 아래 안내를 외부에서 참고하세요.</p>
              <pre className={styles.prompt}>{LOAN_GUIDE_PROMPT}</pre>
            </aside>
          ) : null}
        </section>
      ) : null}

      {step === 2 ? (
        <section className={styles.step}>
          <h1 className={styles.question}>단지 조건</h1>
          <p className={styles.support}>선택 입력</p>
          <label className={styles.field}>
            <span>최소 전용면적</span>
            <span className={styles.inputRow}>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="1"
                placeholder="예: 59"
                value={minExclusiveArea}
                onChange={(event) => setMinExclusiveArea(event.target.value)}
              />
              <span className={styles.suffix}>㎡</span>
            </span>
          </label>
          <label className={styles.field}>
            <span>최대 연식</span>
            <span className={styles.inputRow}>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                placeholder="예: 20"
                value={maxBuildingAge}
                onChange={(event) => setMaxBuildingAge(event.target.value)}
              />
              <span className={styles.suffix}>년</span>
            </span>
          </label>
          <label className={styles.field}>
            <span>최소 세대수</span>
            <span className={styles.inputRow}>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                placeholder="예: 300"
                value={minHouseholdCount}
                onChange={(event) => setMinHouseholdCount(event.target.value)}
              />
              <span className={styles.suffix}>세대</span>
            </span>
          </label>
        </section>
      ) : null}

      {step === 3 ? (
        <section className={styles.step}>
          {commutePhase === 'destination' ? (
            <>
              <h1 className={styles.question}>출근역</h1>
              <p></p>
              <StationPicker value={destination} onSelect={selectDestination} />
              <button
                type="button"
                className={styles.ghostButton}
                onClick={skipCommuteDestination}
              >
                아직 정하지 않았어요
              </button>
            </>
          ) : (
            <>
              <h1 className={styles.question}>최대 통근시간</h1>
              {destination ? (
                <p className={styles.support}>{destination.name} 기준</p>
              ) : null}
              <p className={styles.support}>선택 입력</p>
              <label className={styles.field}>
                <span>최대 통근시간</span>
                <span className={styles.inputRow}>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    placeholder="예: 60"
                    value={maxCommuteMinutes}
                    onChange={(event) => setMaxCommuteMinutes(event.target.value)}
                  />
                  <span className={styles.suffix}>분</span>
                </span>
              </label>
            </>
          )}
        </section>
      ) : null}

      {step === 4 ? (
        <section className={styles.step}>
          <p className={styles.kicker}>내가 중요하게 보는 것</p>
          {reviewingPriorities ? (
            <>
              <h1 className={styles.question}>이렇게 볼까요?</h1>
              <ul className={styles.review}>
                {EVALUATION_METRIC_ORDER.map((metric, index) => {
                  const value = priorities[metric]
                  return (
                    <li key={metric}>
                      <button
                        type="button"
                        className={styles.reviewRow}
                        onClick={() => setPriorityIndex(index)}
                      >
                        <span>{EVALUATION_METRIC_LABELS[metric]}</span>
                        <strong>
                          {value === null ? '아직 고르지 않음' : PRIORITY_CHOICE_LABELS[value]}
                        </strong>
                      </button>
                    </li>
                  )
                })}
              </ul>
              <dl className={styles.summary}>
                <div>
                  <dt>지역</dt>
                  <dd>{areas.map((area) => area.sigunguName).join(' · ')}</dd>
                </div>
                <div>
                  <dt>예산</dt>
                  <dd>
                    {omittedLabel(
                      purchaseBudget === undefined ? undefined : formatEok(purchaseBudget),
                    )}
                  </dd>
                </div>
                <div>
                  <dt>최소 전용면적</dt>
                  <dd>{omittedLabel(minArea === undefined ? undefined : `${minArea}㎡`)}</dd>
                </div>
                <div>
                  <dt>최대 연식</dt>
                  <dd>{omittedLabel(maxAge === undefined ? undefined : `${maxAge}년`)}</dd>
                </div>
                <div>
                  <dt>최소 세대수</dt>
                  <dd>
                    {omittedLabel(
                      minHouseholds === undefined
                        ? undefined
                        : `${minHouseholds.toLocaleString('ko-KR')}세대`,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>통근</dt>
                  <dd>
                    {destination === undefined
                      ? '조건 없음'
                      : maxMinutes === undefined
                        ? destination.name
                        : `${destination.name} · ${maxMinutes}분`}
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <>
              <p className={styles.subProgress}>
                {priorityIndex + 1} / {EVALUATION_METRIC_ORDER.length}
              </p>
              <h1 className={styles.question}>{PRIORITY_QUESTIONS[activeMetric]}</h1>
              <div className={styles.choices} role="group" aria-label={EVALUATION_METRIC_LABELS[activeMetric]}>
                {PRIORITY_CHOICES.map((choice) => {
                  const selected = priorities[activeMetric] === choice
                  return (
                    <button
                      key={choice}
                      type="button"
                      className={
                        selected
                          ? `${styles.choice} ${choice === 0 ? styles.choiceIgnore : styles.choiceOn}`
                          : styles.choice
                      }
                      aria-pressed={selected}
                      onClick={() => selectPriority(choice)}
                    >
                      {PRIORITY_CHOICE_LABELS[choice]}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </section>
      ) : null}

      {hint ? (
        <p className={styles.error} role="alert">
          {hint}
        </p>
      ) : null}

      {showNext || showFinish ? (
        <div className={styles.footer}>
          {showNext ? (
            <button type="button" className={styles.next} onClick={goNext}>
              다음
            </button>
          ) : null}
          {showFinish ? (
            <button type="button" className={styles.next} onClick={completeSetup}>
              집 찾아보기
            </button>
          ) : null}
        </div>
      ) : null}
    </main>
  )
}
