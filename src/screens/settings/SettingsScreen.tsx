import { Icon } from '../../ui/Icon.tsx'
import { isAndroidApp } from '../../platform/native.ts'
import { useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { useBrowse } from '../../app/browseContext.ts'
import { listQuestHomeMatches } from '../../domain/discover.ts'
import { useApartmentCatalog } from '../../data/useApartmentCatalog.ts'
import { useQuestPersist } from '../../app/persistContext.ts'
import { useQuestDispatch, useQuestState } from '../../app/useQuest.ts'
import {
  calculateMonthlyLoanPayment,
  calculatePurchaseBudget,
  eokToWon,
  formatEok,
  formatLoanPercent,
  formatManWon,
  percentToAnnualRate,
  wonToEok,
} from '../../domain/calculations.ts'
import { formatAreaSummary, type SidoAvailability } from '../../domain/questContext.ts'
import {
  formatCommuteSummary,
  withBudget,
  withCommute,
  withOptionalField,
} from '../../domain/searchCriteria.ts'
import {
  EVALUATION_METRIC_LABELS,
  EVALUATION_METRIC_ORDER,
  EVALUATION_PRIORITY_LABELS,
  type CommuteDestination,
  type EvaluationPriorities,
  type EvaluationPriority,
  type QuestArea,
  type SearchCriteria,
} from '../../domain/models.ts'
import { StationPicker } from '../../ui/StationPicker.tsx'
import {
  SEOUL_SIDO_CODE,
  groupedSetupRegions,
  mergeQuestAreas,
  questAreasForSido,
  toQuestArea,
} from '../../mock/areas.ts'
import { PageChrome } from '../../ui/PageChrome.tsx'
import { readBackupFile } from '../../persistence/photoBackup.ts'
import { BACKUP_UNREADABLE } from '../../persistence/errors.ts'
import { userMessageFromUnknown } from '../../persistence/repository.ts'
import styles from './SettingsScreen.module.css'
import { StorageStatus } from '../../ui/StorageStatus.tsx'

type ConditionField =
  | 'areas'
  | 'budget'
  | 'minArea'
  | 'maxAge'
  | 'minHouseholds'
  | 'commute'
  | 'loan'

type OpenField = ConditionField | keyof EvaluationPriorities | null

const PRIORITY_CHOICES: EvaluationPriority[] = [0, 1, 2, 3, 4]

const SIDO_AVAILABILITY: SidoAvailability[] = groupedSetupRegions().map((group) => ({
  sidoCode: group.sidoCode,
  label: group.sidoName,
  total: group.regions.length,
}))

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

function eokDraft(won: number | undefined): string {
  return won === undefined ? '' : String(wonToEok(won))
}

function optionalDraft(value: number | undefined): string {
  return value === undefined ? '' : String(value)
}

export function SettingsScreen({ searchOnly = false }: { searchOnly?: boolean }) {
  const apartmentCatalog = useApartmentCatalog()
  const navigate = useNavigate()
  const { setState: setBrowse, scrollTop: scrollTopRef } = useBrowse()
  const dispatch = useQuestDispatch()
  const persist = useQuestPersist()
  const { quest, apartmentQuestStates } = useQuestState()
  const [criteriaDraft, setCriteriaDraft] = useState(() => quest?.searchCriteria)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [openField, setOpenField] = useState<OpenField>(null)
  const [cashDraft, setCashDraft] = useState('')
  const [loanLimitDraft, setLoanLimitDraft] = useState('')
  const [numberDraft, setNumberDraft] = useState('')
  const [areasDraft, setAreasDraft] = useState<QuestArea[]>([])
  const [destinationDraft, setDestinationDraft] = useState<CommuteDestination | undefined>(undefined)
  const [minutesDraft, setMinutesDraft] = useState('')
  const [ratePercent, setRatePercent] = useState('')
  const [termYears, setTermYears] = useState('')
  const [hint, setHint] = useState('')
  const [restoreRaw, setRestoreRaw] = useState<File | null>(null)
  const [restoreSummary, setRestoreSummary] = useState('')
  const [restoreName, setRestoreName] = useState('')
  const [dataError, setDataError] = useState('')
  const [dataBusy, setDataBusy] = useState(false)
  const [backupStatus, setBackupStatus] = useState('')

  const criteria = searchOnly ? criteriaDraft : quest?.searchCriteria
  const loan = quest?.loanAssumption
  const areaGroups = useMemo(() => groupedSetupRegions().filter(group => group.sidoCode === SEOUL_SIDO_CODE), [])

  if (!quest || !criteria || !loan) {
    return null
  }

  const currentPriorities = quest.evaluationPriorities

  const purchaseBudget = calculatePurchaseBudget(
    criteria.availableCash,
    criteria.expectedLoanLimit,
  )
  const savedMonthly =
    criteria.expectedLoanLimit === undefined
      ? undefined
      : calculateMonthlyLoanPayment(
          criteria.expectedLoanLimit,
          loan.annualInterestRate,
          loan.termYears,
        )

  const selectedCodes = new Set(areasDraft.map((area) => area.sigunguCode))
  const seoulAreas = questAreasForSido(SEOUL_SIDO_CODE)
  const allSeoulSelected =
    seoulAreas.length > 0 &&
    seoulAreas.every((area) => selectedCodes.has(area.sigunguCode))

  const ratePct = parseEnteredNumber(ratePercent)
  const years = parseEnteredNumber(termYears)
  const draftMonthly =
    criteria.expectedLoanLimit !== undefined &&
    ratePct !== undefined &&
    years !== undefined
      ? calculateMonthlyLoanPayment(
          criteria.expectedLoanLimit,
          percentToAnnualRate(ratePct),
          years,
        )
      : undefined

  function openEditor(field: OpenField) {
    if (!criteria || !loan) {
      return
    }
    setHint('')
    setOpenField(field)
    if (field === 'areas') {
      setAreasDraft(criteria.areas)
    }
    if (field === 'budget') {
      setCashDraft(eokDraft(criteria.availableCash))
      setLoanLimitDraft(eokDraft(criteria.expectedLoanLimit))
    }
    if (field === 'minArea') {
      setNumberDraft(optionalDraft(criteria.minExclusiveArea))
    }
    if (field === 'maxAge') {
      setNumberDraft(optionalDraft(criteria.maxBuildingAge))
    }
    if (field === 'minHouseholds') {
      setNumberDraft(optionalDraft(criteria.minHouseholdCount))
    }
    if (field === 'commute') {
      setDestinationDraft(criteria.commuteDestination)
      setMinutesDraft(optionalDraft(criteria.maxCommuteMinutes))
    }
    if (field === 'loan') {
      setRatePercent(formatLoanPercent(loan.annualInterestRate))
      setTermYears(String(loan.termYears))
    }
  }

  function closeEditor() {
    setOpenField(null)
    setHint('')
  }

  function toggleField(field: OpenField) {
    if (openField === field) {
      closeEditor()
      return
    }
    openEditor(field)
  }

  function applyCriteria(next: SearchCriteria) {
    if (searchOnly) setCriteriaDraft(next)
    else dispatch({ type: 'updateQuest', searchCriteria: next })
    closeEditor()
  }

  function applyOptionalNumber(key: 'minExclusiveArea' | 'maxBuildingAge' | 'minHouseholdCount') {
    if (!criteria) {
      return
    }
    const value = parseEnteredNumber(numberDraft)
    if (value !== undefined && value < 0) {
      setHint('0 이상으로 입력하거나 비워 주세요.')
      return
    }
    applyCriteria(withOptionalField(criteria, key, value))
  }

  function toggleArea(area: QuestArea) {
    setAreasDraft((current) => {
      const exists = current.some((item) => item.sigunguCode === area.sigunguCode)
      if (exists) {
        return current.filter((item) => item.sigunguCode !== area.sigunguCode)
      }
      return [...current, area]
    })
    setHint('')
  }

  function selectSido(sidoCode: string) {
    setAreasDraft((current) => mergeQuestAreas(current, questAreasForSido(sidoCode)))
    setHint('')
  }

  function applyAreas() {
    if (!criteria) {
      return
    }
    if (areasDraft.length === 0) {
      setHint('지역을 하나 이상 남겨 주세요.')
      return
    }
    applyCriteria({ ...criteria, areas: areasDraft })
  }

  function applyBudget(event: FormEvent) {
    event.preventDefault()
    if (!criteria) {
      return
    }
    const cashEok = parseEnteredNumber(cashDraft)
    const loanEok = parseEnteredNumber(loanLimitDraft)
    if ((cashEok !== undefined && cashEok < 0) || (loanEok !== undefined && loanEok < 0)) {
      setHint('0 이상으로 입력하거나 비워 주세요.')
      return
    }
    applyCriteria(
      withBudget(
        criteria,
        cashEok === undefined ? undefined : eokToWon(cashEok),
        loanEok === undefined ? undefined : eokToWon(loanEok),
      ),
    )
  }

  function applyCommute(event: FormEvent) {
    event.preventDefault()
    if (!criteria) {
      return
    }
    const destination = destinationDraft
    const minutes = parseEnteredNumber(minutesDraft)
    if (minutes !== undefined && minutes < 0) {
      setHint('0 이상으로 입력하거나 비워 주세요.')
      return
    }
    applyCriteria(withCommute(criteria, destination, minutes))
  }

  function clearCommute() {
    if (!criteria) {
      return
    }
    applyCriteria(withCommute(criteria, undefined, undefined))
  }

  function applyLoan(event: FormEvent) {
    event.preventDefault()
    if (ratePct === undefined || ratePct < 0 || years === undefined || years <= 0) {
      setHint('금리와 기간을 입력해 주세요.')
      return
    }
    dispatch({
      type: 'updateQuest',
      loanAssumption: {
        annualInterestRate: percentToAnnualRate(ratePct),
        termYears: years,
      },
    })
    closeEditor()
  }

  function setPriority(metric: keyof EvaluationPriorities, choice: EvaluationPriority) {
    dispatch({
      type: 'updateQuest',
      evaluationPriorities: {
        ...currentPriorities,
        [metric]: choice,
      },
    })
  }

  async function makeBackup() {
    setDataError('')
    try {
      persist.exportBackupFile()
    } catch {
      setDataError('백업 파일을 만들지 못했습니다.')
    }
  }

  function onBackupFile(event: FormEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ''
    if (!file) {
      return
    }
    setDataError('')
    setRestoreRaw(null)
    setDataBusy(true)
    void readBackupFile(file).then((contents) => {
        setRestoreRaw(file)
        setRestoreName(file.name)
        const visits = Object.values(contents.state.visitsByApartmentId).flat().length
        setRestoreSummary(`방문 ${visits}개 · ${contents.includesPhotos ? `사진 원본 ${contents.photos.length}개 포함` : '사진 원본 없는 JSON 백업'}`)
      }).catch((error: unknown) => {
        setRestoreRaw(null)
        setRestoreName('')
        setDataError(userMessageFromUnknown(error, BACKUP_UNREADABLE))
      }).finally(() => setDataBusy(false))
  }

  function cancelRestore() {
    setRestoreRaw(null)
    setRestoreName('')
  }

  async function confirmRestore() {
    if (restoreRaw === null) {
      return
    }
    setDataBusy(true)
    setDataError('')
    try {
      await persist.restoreBackupFile(restoreRaw)
      setRestoreRaw(null)
      setRestoreName('')
    } catch (error: unknown) {
      setDataError(userMessageFromUnknown(error, BACKUP_UNREADABLE))
    } finally {
      setDataBusy(false)
    }
  }

  return (
    <main className={styles.page}>
      {searchOnly ? <PageChrome backTo="/" backLabel="내 집 찾기" /> : null}

      <h1 className={styles.title}>{searchOnly ? '검색 조건' : '설정'}</h1>

      <section className={styles.section} aria-labelledby="search-conditions">
        <h2 id="search-conditions" className={styles.heading}>
          탐색 조건
        </h2>
        <label className={styles.field}>
          <span><input type="checkbox" checked={criteria.includeUnknown !== false} disabled={openField !== null} onChange={(event) => applyCriteria({ ...criteria, includeUnknown: event.target.checked })} /> 정보 미확인 단지 포함</span>
        </label>

        <SettingRow
          label="지역"
          value={formatAreaSummary(criteria.areas, SIDO_AVAILABILITY)}
          open={openField === 'areas'}
          onToggle={() => toggleField('areas')}
        >
          <div className={styles.bulkRow}>
            <button
              type="button"
              className={allSeoulSelected ? `${styles.chip} ${styles.chipOn}` : styles.chip}
              aria-pressed={allSeoulSelected}
              onClick={() => selectSido(SEOUL_SIDO_CODE)}
            >
              서울 전체
            </button>

            <button
              type="button"
              className={styles.chip}
              onClick={() => {
                setAreasDraft([])
                setHint('')
              }}
            >
              전체 해제
            </button>
          </div>
          <p>실제 단지 수집과 경계 지도는 서울 25개 구를 지원합니다.</p>
          {areaGroups.map((group) => (
            <div key={group.sidoCode} className={styles.areaGroup}>
              <p className={styles.groupLabel}>{group.sidoName}{group.sidoCode !== SEOUL_SIDO_CODE ? ' · 예시 자료' : ''}</p>
              <div className={styles.chipRow}>
                {group.regions.map((region) => {
                  const selected = selectedCodes.has(region.sigunguCode)
                  return (
                    <button
                      key={region.sigunguCode}
                      type="button"
                      className={selected ? `${styles.chip} ${styles.chipOn}` : styles.chip}
                      aria-pressed={selected}
                      onClick={() => toggleArea(toQuestArea(region))}
                    >
                      {region.sigunguName}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          <p className={styles.note} aria-live="polite">
            {formatAreaSummary(areasDraft, SIDO_AVAILABILITY)}
          </p>
          {openField === 'areas' && hint ? <InlineHint message={hint} /> : null}
          <button type="button" className={styles.apply} onClick={applyAreas}>
            적용
          </button>
        </SettingRow>

        <SettingRow
          label="예산"
          value={purchaseBudget === undefined ? '조건 없음' : formatEok(purchaseBudget)}
          open={openField === 'budget'}
          onToggle={() => toggleField('budget')}
        >
          <form className={styles.editorForm} onSubmit={applyBudget}>
            <NumberField
              id="settings-cash"
              label="내 자금"
              value={cashDraft}
              suffix="억"
              hint="비우면 이 값은 쓰지 않습니다."
              autoFocus
              onChange={setCashDraft}
            />
            <NumberField
              id="settings-loan-limit"
              label="예상 대출한도"
              value={loanLimitDraft}
              suffix="억"
              hint="비우면 이 값은 쓰지 않습니다."
              onChange={setLoanLimitDraft}
            />
            {openField === 'budget' && hint ? <InlineHint message={hint} /> : null}
            <div className={styles.editorActions}>
              <button type="submit" className={styles.apply}>
                적용
              </button>
              <button
                type="button"
                className={styles.quiet}
                onClick={() => {
                  if (!criteria) {
                    return
                  }
                  applyCriteria(withBudget(criteria, undefined, undefined))
                }}
              >
                조건 없음으로
              </button>
            </div>
          </form>
        </SettingRow>

        <SettingRow
          label="최소 면적"
          value={
            criteria.minExclusiveArea === undefined
              ? '조건 없음'
              : `${criteria.minExclusiveArea}㎡ 이상`
          }
          open={openField === 'minArea'}
          onToggle={() => toggleField('minArea')}
        >
          <OptionalNumberEditor
            id="settings-min-area"
            label="최소 전용면적"
            suffix="㎡"
            value={numberDraft}
            hint={openField === 'minArea' ? hint : ''}
            onChange={setNumberDraft}
            onSubmit={() => applyOptionalNumber('minExclusiveArea')}
          />
        </SettingRow>

        <SettingRow
          label="연식"
          value={
            criteria.maxBuildingAge === undefined
              ? '조건 없음'
              : `${criteria.maxBuildingAge}년 이하`
          }
          open={openField === 'maxAge'}
          onToggle={() => toggleField('maxAge')}
        >
          <OptionalNumberEditor
            id="settings-max-age"
            label="최대 연식"
            suffix="년"
            value={numberDraft}
            hint={openField === 'maxAge' ? hint : ''}
            onChange={setNumberDraft}
            onSubmit={() => applyOptionalNumber('maxBuildingAge')}
          />
        </SettingRow>

        <SettingRow
          label="세대수"
          value={
            criteria.minHouseholdCount === undefined
              ? '조건 없음'
              : `${criteria.minHouseholdCount.toLocaleString('ko-KR')}세대 이상`
          }
          open={openField === 'minHouseholds'}
          onToggle={() => toggleField('minHouseholds')}
        >
          <OptionalNumberEditor
            id="settings-min-households"
            label="최소 세대수"
            suffix="세대"
            integer
            value={numberDraft}
            hint={openField === 'minHouseholds' ? hint : ''}
            onChange={setNumberDraft}
            onSubmit={() => applyOptionalNumber('minHouseholdCount')}
          />
        </SettingRow>

        <SettingRow
          label="출퇴근"
          value={formatCommuteSummary(criteria)}
          open={openField === 'commute'}
          onToggle={() => toggleField('commute')}
        >
          <form className={styles.editorForm} onSubmit={applyCommute}>
            <p className={styles.groupLabel}>출퇴근지</p>
            <StationPicker value={destinationDraft} onSelect={(value) => { setDestinationDraft(value); setHint('') }} />
            {destinationDraft ? (
              <NumberField
                id="settings-max-minutes"
                label="최대 통근시간"
                value={minutesDraft}
                suffix="분"
                integer
                hint="비우면 시간 필터는 쓰지 않습니다."
                onChange={setMinutesDraft}
              />
            ) : (
              <p className={styles.note}>목적지를 정하지 않으면 출퇴근 필터를 쓰지 않습니다.</p>
            )}
            {openField === 'commute' && hint ? <InlineHint message={hint} /> : null}
            <div className={styles.editorActions}>
              <button type="submit" className={styles.apply}>
                적용
              </button>
              <button type="button" className={styles.quiet} onClick={clearCommute}>
                설정 안 함
              </button>
            </div>
          </form>
        </SettingRow>
      </section>

      {searchOnly ? (
        <footer className={styles.searchFooter}>
          {openField ? <p role="status" className={styles.note}>편집한 항목을 먼저 적용하세요.</p> : null}
          <button type="button" className={styles.apply} disabled={openField !== null} onClick={() => {
            dispatch({ type: 'updateQuest', searchCriteria: criteria })
            scrollTopRef.current = 0
            setBrowse((current) => ({ ...current, stageFilter: 'all', showPassed: false, selectedId: null }))
            navigate('/')
          }}>
            {listQuestHomeMatches(apartmentCatalog.list(), criteria, apartmentQuestStates).filter((item) => apartmentQuestStates[item.apartment.id]?.stage !== 'PASSED').length}개 결과 보기
          </button>
          <Link to="/" className={styles.back}>변경 취소</Link>
        </footer>
      ) : <>
      <section className={styles.section} aria-labelledby="evaluation-priorities">
        <h2 id="evaluation-priorities" className={styles.heading}>
          평가 기준
        </h2>
        {EVALUATION_METRIC_ORDER.map((metric) => {
          const current = currentPriorities[metric]
          const open = openField === metric
          return (
            <SettingRow
              key={metric}
              label={EVALUATION_METRIC_LABELS[metric]}
              value={EVALUATION_PRIORITY_LABELS[current]}
              open={open}
              onToggle={() => toggleField(metric)}
            >
              <div
                className={styles.chipRow}
                role="group"
                aria-label={EVALUATION_METRIC_LABELS[metric]}
              >
                {PRIORITY_CHOICES.map((choice) => {
                  const selected = current === choice
                  return (
                    <button
                      key={choice}
                      type="button"
                      className={
                        selected
                          ? `${styles.chip} ${choice === 0 ? styles.chipIgnore : styles.chipOn}`
                          : styles.chip
                      }
                      aria-pressed={selected}
                      onClick={() => setPriority(metric, choice)}
                    >
                      {EVALUATION_PRIORITY_LABELS[choice]}
                    </button>
                  )
                })}
              </div>
            </SettingRow>
          )
        })}
      </section>

      <section className={`${styles.section} ${styles.secondary}`} aria-labelledby="loan-reference">
        <h2 id="loan-reference" className={styles.heading}>
          대출 상환 참고
        </h2>
        <p className={styles.note}>
          월 상환액을 가늠할 때만 씁니다. 한도·승인·추천이 아닙니다.
        </p>
        <SettingRow
          label="참고 가정"
          value={`${formatLoanPercent(loan.annualInterestRate)}% · ${loan.termYears}년 · 원리금균등`}
          open={openField === 'loan'}
          onToggle={() => toggleField('loan')}
        >
          <form className={styles.editorForm} onSubmit={applyLoan}>
            <NumberField
              id="settings-rate"
              label="기준 금리"
              value={ratePercent}
              suffix="%"
              onChange={setRatePercent}
            />
            <NumberField
              id="settings-term"
              label="기간"
              value={termYears}
              suffix="년"
              integer
              onChange={setTermYears}
            />
            {draftMonthly !== undefined ? (
              <p className={styles.monthly}>
                참고 월 상환액
                <strong>{formatManWon(draftMonthly)}</strong>
                <span>원리금균등 · 예상 대출한도 기준</span>
              </p>
            ) : (
              <p className={styles.note}>예상 대출한도를 넣은 경우에만 참고 금액이 보입니다.</p>
            )}
            {openField === 'loan' && hint ? <InlineHint message={hint} /> : null}
            <button type="submit" className={styles.apply}>
              적용
            </button>
          </form>
        </SettingRow>
        {openField !== 'loan' && savedMonthly !== undefined ? (
          <p className={styles.savedMonthly}>참고 월 상환액 {formatManWon(savedMonthly)}</p>
        ) : null}
      </section>

      <section className={styles.data} aria-labelledby="data">
        <h2 id="data" className={styles.heading}>
          데이터
        </h2>
        <p className={styles.note}>
          기록과 사진 원본은 이 기기에 저장됩니다. 사진 포함 백업은 .nestquest 파일로 저장합니다(최대 200MB).
          작성 중인 임장 초안은 백업에 포함하지 않습니다.
        </p>
        <p><Link to="/connections">데이터 관리</Link></p>
        <details><summary>기기 저장 공간</summary><StorageStatus /></details>
        <button type="button" className={styles.dataButton} disabled={dataBusy} onClick={() => {
          setDataBusy(true)
          setDataError('')
          setBackupStatus('')
          void persist.exportPhotoBackup().then(() => setBackupStatus(isAndroidApp() ? '선택한 위치에 사진 포함 백업을 저장했습니다.' : '사진 포함 백업 파일을 만들었습니다. 브라우저 다운로드 목록에서 저장 결과를 확인해 주세요.')).catch((error) => setDataError(userMessageFromUnknown(error, '사진 백업을 만들지 못했습니다.'))).finally(() => setDataBusy(false))
        }}>사진 포함 백업</button>
        <button type="button" className={styles.dataButton} disabled={dataBusy} onClick={makeBackup}>
          기록 백업
        </button>
        <button
          type="button"
          className={styles.dataButton}
          disabled={dataBusy}
          onClick={() => fileInputRef.current?.click()}
        >
          백업에서 복원
        </button>
        <input
          ref={fileInputRef}
          className={styles.fileInput}
          type="file"
          accept={isAndroidApp() ? "*/*" : "application/json,.json,.nestquest"}
          disabled={dataBusy}
          onChange={onBackupFile}
        />
        {restoreRaw ? (
          <div className={styles.restoreConfirm}>
            <p className={styles.note}>
              현재 NestQuest 기록이 백업 파일의 기록으로 교체됩니다.
              이 기기의 사진은 백업에 포함된 원본으로 교체되고, 작성 중인 임장 초안은 삭제됩니다.
              JSON 백업에는 원본이 없어 복원 후 사진을 볼 수 없습니다.
            </p>
            {restoreName ? <p className={styles.fieldHint}>{restoreName}</p> : null}
            <p className={styles.note}>{restoreSummary}</p>
            <div className={styles.editorActions}>
              <button
                type="button"
                className={styles.apply}
                disabled={dataBusy}
                onClick={() => {
                  void confirmRestore()
                }}
              >
                복원
              </button>
              <button
                type="button"
                className={styles.quiet}
                disabled={dataBusy}
                onClick={cancelRestore}
              >
                취소
              </button>
            </div>
          </div>
        ) : null}
        {dataBusy ? <p role="status">백업을 처리하고 있습니다. 화면을 닫지 말아 주세요.</p> : null}
        {!dataBusy && backupStatus ? <p role="status">{backupStatus}</p> : null}
        {dataError ? <p role="alert" className={styles.error}>{dataError}</p> : null}
      </section>
      </>}
    </main>
  )
}

function SettingRow({
  label,
  value,
  open,
  onToggle,
  children,
}: {
  label: string
  value: string
  open: boolean
  onToggle: () => void
  children?: ReactNode
}) {
  return (
    <div className={open ? `${styles.row} ${styles.rowOpen}` : styles.row}>
      <button type="button" className={styles.rowTrigger} aria-expanded={open} onClick={onToggle} aria-label={label + (open ? ' 편집 취소' : ' 변경')}>
        <span><span className={styles.label}>{label}</span><span className={styles.value}>{value}</span></span>
        <Icon name={open ? 'close' : 'chevron'} size={20} />
      </button>
      {open ? <div className={styles.editor}>{children}</div> : null}
    </div>
  )
}

function OptionalNumberEditor({
  id,
  label,
  suffix,
  value,
  integer,
  hint,
  onChange,
  onSubmit,
}: {
  id: string
  label: string
  suffix: string
  value: string
  integer?: boolean
  hint: string
  onChange: (value: string) => void
  onSubmit: () => void
}) {
  return (
    <form
      className={styles.editorForm}
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <NumberField
        id={id}
        label={label}
        value={value}
        suffix={suffix}
        integer={integer}
        hint="비우면 제한 없음"
        autoFocus
        onChange={onChange}
      />
      {hint ? <InlineHint message={hint} /> : null}
      <button type="submit" className={styles.apply}>
        적용
      </button>
    </form>
  )
}

function NumberField({
  id,
  label,
  value,
  suffix,
  integer,
  hint,
  autoFocus,
  onChange,
}: {
  id: string
  label: string
  value: string
  suffix: string
  integer?: boolean
  hint?: string
  autoFocus?: boolean
  onChange: (value: string) => void
}) {
  const hintId = hint ? `${id}-hint` : undefined
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <span className={styles.inputRow}>
        <input
          id={id}
          type="number"
          inputMode={integer ? 'numeric' : 'decimal'}
          min="0"
          step={integer ? '1' : '0.1'}
          value={value}
          autoFocus={autoFocus}
          aria-describedby={hintId}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className={styles.suffix}>{suffix}</span>
      </span>
      {hint ? (
        <p id={hintId} className={styles.fieldHint}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}

function InlineHint({ message }: { message: string }) {
  return (
    <p className={styles.error} role="alert">
      {message}
    </p>
  )
}
