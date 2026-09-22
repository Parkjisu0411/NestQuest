import { CameraInput } from './CameraInput.tsx'
import { Icon } from '../../ui/Icon.tsx'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useQuestPersist } from '../../app/persistContext.ts'
import { useQuestState } from '../../app/useQuest.ts'
import { saveVisitDraft, userMessageFromUnknown, visitPhotoBlobKey } from '../../persistence/repository.ts'
import { DRAFT_WRITE_ERROR, type VisitDraft, type VisitPhase } from '../../persistence/visitDraft.ts'
import { createDraftAutosave, type DraftSaveStatus } from '../../persistence/draftAutosave.ts'
import { VisitDraftLoader } from './VisitDraftLoader.tsx'
import { UnsavedChangesGuard } from '../../ui/UnsavedChangesGuard.tsx'
import { DraftPhotoPreview } from './DraftPhotoPreview.tsx'
import { unlinkObservationPhoto, type ObservationId } from '../../domain/visitObservations.ts'
import { VisitObservationsEditor } from './VisitObservationsEditor.tsx'
import type { VisitObservations, ObservationGroupId } from '../../domain/visitObservations.ts'
import { PERSIST_WRITE_ERROR } from '../../persistence/errors.ts'
import {
  ADJUSTMENT_TYPE_LABELS,
  EVALUATION_METRIC_LABELS,
  EVALUATION_METRIC_ORDER,
  EVALUATION_PRIORITY_LABELS,
  VISIT_TYPE_LABELS,
  VISIT_TYPE_ORDER,
  type AdjustmentType,
  type EvaluationAdjustment,
  type EvaluationRating,
  type UserEvaluation,
  type VisitPhoto,
  type VisitType,
} from '../../domain/models.ts'
import { calculateMyScore, formatMyScore } from '../../domain/scoring.ts'
import { useApartmentCatalog } from '../../data/useApartmentCatalog.ts'
import styles from './VisitScreen.module.css'

type Phase = VisitPhase

const RATINGS: Array<Exclude<EvaluationRating, null>> = [1, 2, 3, 4, 5]

const METRIC_QUESTIONS: Record<(typeof EVALUATION_METRIC_ORDER)[number], string> = {
  stationAccess: '역 접근성은 어땠나요?',
  commuteFeel: '통근 체감은 어땠나요?',
  commercial: '상권은 어땠나요?',
  school: '학군은 어땠나요?',
  nature: '자연 / 산책은 어땠나요?',
  neighborhood: '동네 분위기는 어땠나요?',
}

const METRIC_GUIDANCE: Record<(typeof EVALUATION_METRIC_ORDER)[number], string> = {
  stationAccess: '집에서 주요 지하철역까지 실제로 이동하기 얼마나 편한가?',
  commuteFeel: '이 경로를 평일마다 반복한다고 생각했을 때 얼마나 괜찮은가?',
  commercial: '실제 거주했을 때 일상 상업시설을 이용하기 얼마나 좋은가?',
  school: '내가 중요하게 생각하는 교육환경을 얼마나 충족하는가?',
  nature: '집 주변에서 걷거나 쉬거나 야외활동을 하기 얼마나 좋은가?',
  neighborhood: '이 동네에서 실제로 살고 싶은 느낌이 드는가?',
}

interface DraftPhoto {
  id: string
  file: Blob
}

export function VisitScreen() {
  const apartmentCatalog = useApartmentCatalog()
  const { apartmentId = '' } = useParams()
  const { quest } = useQuestState()
  if (!quest || !apartmentCatalog.find(apartmentId)) return <p>단지를 찾을 수 없습니다.</p>
  return (
    <VisitDraftLoader key={`${quest.id}:${apartmentId}`} questId={quest.id} apartmentId={apartmentId}>
      {(draft) => <VisitEditor initialDraft={draft} />}
    </VisitDraftLoader>
  )
}

function VisitEditor({ initialDraft }: { initialDraft: VisitDraft | null }) {
  const apartmentCatalog = useApartmentCatalog()
  const { apartmentId = '' } = useParams()
  const navigate = useNavigate()
  const persist = useQuestPersist()
  const { quest, visitsByApartmentId, userEvaluations } = useQuestState()
  const record = apartmentCatalog.find(apartmentId)
  const existingEvaluation = userEvaluations[apartmentId]
  const existingVisits = visitsByApartmentId[apartmentId] ?? []

  const [phase, setPhase] = useState<Phase>(initialDraft?.phase ?? 'capture')
  const [visitedLocal, setVisitedLocal] = useState(initialDraft?.visitedLocal ?? toDatetimeLocalValue(new Date()))
  const [visitType, setVisitType] = useState<VisitType | ''>(initialDraft?.visitType ?? '')
  const [photos, setPhotos] = useState<DraftPhoto[]>(initialDraft?.photos ?? [])
  const [pros, setPros] = useState<string[]>(initialDraft?.pros ?? [])
  const [cons, setCons] = useState<string[]>(initialDraft?.cons ?? [])
  const [proDraft, setProDraft] = useState(initialDraft?.proDraft ?? '')
  const [conDraft, setConDraft] = useState(initialDraft?.conDraft ?? '')
  const [memo, setMemo] = useState(initialDraft?.memo ?? '')
  const [observations, setObservations] = useState<VisitObservations>(initialDraft?.observations ?? {})
  const [observationGroup, setObservationGroup] = useState<ObservationGroupId>(initialDraft?.observationGroup ?? 'access')
  const [metricIndex, setMetricIndex] = useState(initialDraft?.metricIndex ?? 0)
  const [ratings, setRatings] = useState<UserEvaluation['ratings']>(initialDraft?.ratings ?? emptyRatings())
  const [adjustments, setAdjustments] = useState<EvaluationAdjustment[]>(initialDraft?.adjustments ?? [])
  const [factorType, setFactorType] = useState<AdjustmentType>(initialDraft?.factorType ?? 'POSITIVE')
  const [factorText, setFactorText] = useState(initialDraft?.factorText ?? '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const savingRef = useRef(false)
  const allowLeave = useRef(false)
  const [visitId] = useState(() => initialDraft?.id ?? crypto.randomUUID())
  const mounted = useRef(true)
  const [draftStatus, setDraftStatus] = useState<DraftSaveStatus>('saved')
  const autosave = useMemo(() => createDraftAutosave<VisitDraft>(saveVisitDraft, setDraftStatus), [])
  const draft = useMemo<VisitDraft>(() => ({
    version: 1, id: visitId, questId: quest?.id ?? '', apartmentId,
    phase, visitedLocal, visitType, photos, pros, cons, proDraft, conDraft,
    memo, observations, observationGroup, metricIndex, ratings, adjustments, factorType, factorText,
    updatedAt: new Date().toISOString(),
  }), [visitId, quest?.id, apartmentId, phase, visitedLocal, visitType, photos, pros, cons, proDraft, conDraft, memo, observations, observationGroup, metricIndex, ratings, adjustments, factorType, factorText])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      void autosave.flush()
    }
  }, [autosave])

  useEffect(() => { autosave.update(draft) }, [autosave, draft])

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!savingRef.current && autosave.getStatus() === 'saved') return
      void autosave.flush()
      event.preventDefault()
      event.returnValue = ''
    }
    const flush = () => { if (document.visibilityState === 'hidden') void autosave.flush() }
    document.addEventListener('visibilitychange', flush)
    window.addEventListener('beforeunload', warn)
    return () => {
      document.removeEventListener('visibilitychange', flush)
      window.removeEventListener('beforeunload', warn)
    }
  }, [autosave])

  const previewScore = useMemo(() => {
    if (!quest) {
      return undefined
    }
    return calculateMyScore({
      hasVisit: true,
      evaluation: {
        questId: quest.id,
        apartmentId,
        ratings,
        adjustments,
        updatedAt: new Date().toISOString(),
      },
      priorities: quest.evaluationPriorities,
    })
  }, [adjustments, apartmentId, quest, ratings])

  if (!record || !quest) {
    return (
      <main className={styles.page}>
        <Link to="/" className={styles.back}>
          내 집 찾기
        </Link>
        <p className={styles.support}>단지를 찾을 수 없습니다.</p>
      </main>
    )
  }

  const backTo = `/apartments/${apartmentId}`
  const activeQuest = quest
  const metric = EVALUATION_METRIC_ORDER[metricIndex]
  const priority = metric ? activeQuest.evaluationPriorities[metric] : 0

  async function finishVisit(evaluation?: UserEvaluation) {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setSaveError(null)
    try {
      await autosave.pause()
      const now = new Date().toISOString()
      const visitPhotos: VisitPhoto[] = photos.map((photo) => ({
        id: photo.id,
        visitId,
        blobKey: visitPhotoBlobKey(photo.id),
        createdAt: now,
      }))

      await persist.completeVisit({
        type: 'completeVisit',
        visit: {
          id: visitId,
          questId: activeQuest.id,
          apartmentId,
          visitedAt: visitedAtFromLocal(visitedLocal),
          visitType: visitType === '' ? undefined : visitType,
          pros: proDraft.trim() ? [...pros, proDraft.trim()] : pros,
          cons: conDraft.trim() ? [...cons, conDraft.trim()] : cons,
          memo: memo.trim() === '' ? undefined : memo.trim(),
          observations,
          photos: visitPhotos,
          createdAt: now,
          updatedAt: now,
        },
        evaluation: evaluation && factorText.trim() ? {
          ...evaluation,
          adjustments: [...evaluation.adjustments, {
            id: crypto.randomUUID(), type: factorType, description: factorText.trim(), createdAt: now,
          }],
        } : evaluation,
      }, photos.map((photo) => ({ blobKey: visitPhotoBlobKey(photo.id), blob: photo.file })))
      allowLeave.current = true
      if (mounted.current) navigate(backTo)
    } catch (error) {
      autosave.resume()
      autosave.update(draft)
      void autosave.flush()
      if (mounted.current) setSaveError(`${userMessageFromUnknown(error, PERSIST_WRITE_ERROR)} 저장 버튼을 눌러 다시 시도해 주세요.`)
    } finally {
      savingRef.current = false
      if (mounted.current) setSaving(false)
    }
  }

  function startEvaluation(fromExisting: boolean) {
    setRatings(fromExisting && existingEvaluation ? existingEvaluation.ratings : emptyRatings())
    setAdjustments(
      fromExisting && existingEvaluation ? existingEvaluation.adjustments : [],
    )
    setMetricIndex(0)
    setPhase('rate')
  }

  function selectRating(value: EvaluationRating) {
    if (!metric) {
      return
    }
    setRatings((current) => ({ ...current, [metric]: value }))
    if (metricIndex < EVALUATION_METRIC_ORDER.length - 1) {
      setMetricIndex((index) => index + 1)
      return
    }
    setPhase('factors')
  }

  function addObservation(
    kind: 'pro' | 'con',
  ) {
    const raw = kind === 'pro' ? proDraft : conDraft
    const text = raw.trim()
    if (text === '') {
      return
    }
    if (kind === 'pro') {
      setPros((current) => [...current, text])
      setProDraft('')
    } else {
      setCons((current) => [...current, text])
      setConDraft('')
    }
  }

  function addPhotos(fileList: FileList | null, observationId?: ObservationId) {
    if (!fileList) {
      return
    }
    const next = [...fileList]
      .filter((file) => file.type.startsWith('image/'))
      .map((file) => {
        return {
          id: crypto.randomUUID(),
          file,
        }
      })
    if (next.length > 0) {
      setPhotos((current) => [...current, ...next])
      if (observationId) setObservations((current) => ({ ...current, [observationId]: {
        ...(current[observationId] ?? { status: 'unchecked', note: '' }),
        photoIds: [...(current[observationId]?.photoIds ?? []), ...next.map((photo) => photo.id)],
      } }))
    }
  }

  function removePhoto(id: string) {
    setPhotos((current) => current.filter((photo) => photo.id !== id))
    setObservations((current) => unlinkObservationPhoto(current, id))
  }

  function addFactor() {
    const description = factorText.trim()
    if (description === '') {
      return
    }
    setAdjustments((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        type: factorType,
        description,
        createdAt: new Date().toISOString(),
      },
    ])
    setFactorText('')
  }

  function saveEvaluation() {
    finishVisit({
      questId: activeQuest.id,
      apartmentId,
      ratings,
      adjustments,
      updatedAt: new Date().toISOString(),
    })
  }

  return (
    <main className={styles.page}>
      {initialDraft ? <p className={styles.support}>이전 초안</p> : null}
      <p className={styles.support} role="status">
        {draftStatus === 'saved' ? '자동 저장됨' : draftStatus === 'error' ? DRAFT_WRITE_ERROR : '초안 저장 중…'}
      </p>
      {draftStatus === 'error' ? <button type="button" className={styles.secondary} disabled={saving} onClick={() => { void autosave.flush() }}>초안 다시 저장</button> : null}
      {saving || draftStatus === 'error' ? <UnsavedChangesGuard saving={saving} allowLeave={allowLeave} /> : null}
      {saving ? <p className={styles.saveStatus} role="status">저장 중…</p> : null}
      {saveError ? <p className={styles.saveError} role="alert">{saveError}</p> : null}
      <div inert={saving} aria-busy={saving}>
      <header className={styles.top}>
        {phase === 'capture' ? (
          <Link to={backTo} className="icon-button" aria-label="단지로">
            <Icon name="back" />
          </Link>
        ) : (
          <button
            type="button"
            className={styles.back}
            onClick={() => {
              if (phase === 'rate' && metricIndex > 0) {
                setMetricIndex((index) => index - 1)
                return
              }
              if (phase === 'factors') {
                setMetricIndex(EVALUATION_METRIC_ORDER.length - 1)
                setPhase('rate')
                return
              }
              if (phase === 'keep-or-update') {
                setPhase('capture')
                return
              }
              setPhase(existingEvaluation ? 'keep-or-update' : 'capture')
            }}
          >
            뒤로
          </button>
        )}
        <p className={styles.progress}>
          {phase === 'capture' || phase === 'keep-or-update'
            ? ''
            : phase === 'rate'
              ? `평가 ${metricIndex + 1} / 6`
              : '추가 장단점'}
        </p>
      </header>

      <p className={styles.kicker}>{record.apartment.name}</p>

      {phase === 'capture' ? (
        <section className={styles.step}>
          <h1 className={styles.question}>임장 기록</h1>
          

          <label className={styles.field}>
            <span>방문 시각</span>
            <input
              type="datetime-local"
              value={visitedLocal}
              onChange={(event) => setVisitedLocal(event.target.value)}
            />
          </label>

          <fieldset className={styles.fieldset}>
            <legend>방문 시간대</legend>
            <div className={styles.choices}>
              {VISIT_TYPE_ORDER.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={visitType === type ? `${styles.choice} ${styles.choiceOn}` : styles.choice}
                  aria-pressed={visitType === type}
                  onClick={() => setVisitType(type)}
                >
                  {VISIT_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </fieldset>

          <VisitObservationsEditor value={observations} onChange={setObservations} groupId={observationGroup} onGroupChange={setObservationGroup} photos={photos} onAddPhotos={(id, files) => addPhotos(files, id)} />
          <div className={styles.block}>
            <p className={styles.label}>사진</p>
            <CameraInput onFiles={(files) => addPhotos(files)} />
            <label className={styles.photoAdd}>
              사진 추가
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => {
                  addPhotos(event.target.files)
                  event.target.value = ''
                }}
              />
            </label>
            {photos.length > 0 ? (
              <ul className={styles.previews}>
                {photos.map((photo, index) => (
                  <li key={photo.id}>
                    <DraftPhotoPreview blob={photo.file} />
                    <span>사진 {index + 1}</span>
                    <button type="button" aria-label={`사진 ${index + 1} 삭제 (모든 항목 연결도 해제)`} onClick={() => removePhoto(photo.id)}>
                      삭제
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>


          <ObservationField
            id="visit-pros"
            label="좋았던 점"
            value={proDraft}
            items={pros}
            onChange={setProDraft}
            onAdd={() => addObservation('pro')}
            onRemove={(index) => setPros((current) => current.filter((_, i) => i !== index))}
          />
          <ObservationField
            id="visit-cons"
            label="아쉬웠던 점"
            value={conDraft}
            items={cons}
            onChange={setConDraft}
            onAdd={() => addObservation('con')}
            onRemove={(index) => setCons((current) => current.filter((_, i) => i !== index))}
          />

          <label className={styles.field}>
            <span>메모</span>
            <textarea
              rows={3}
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              placeholder="자유롭게 남겨 주세요"
            />
          </label>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              onClick={() => {
                if (existingEvaluation) {
                  setPhase('keep-or-update')
                  return
                }
                startEvaluation(false)
              }}
            >
              평가하기
            </button>
            <button type="button" className={styles.skip} onClick={() => finishVisit()}>
              평가 없이 기록만 남기기
            </button>
          </div>
        </section>
      ) : null}

      {phase === 'keep-or-update' ? (
        <section className={styles.step}>
          <h1 className={styles.question}>기존 평가도 수정할까요?</h1>
          <p className={styles.support}>
            임장 기록은 따로 남습니다. 평가는 이 집에 대한 지금의 판단입니다.
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              onClick={() => startEvaluation(true)}
            >
              평가 수정
            </button>
            <button type="button" className={styles.secondary} onClick={() => finishVisit()}>
              그대로 유지
            </button>
          </div>
        </section>
      ) : null}

      {phase === 'rate' && metric ? (
        <section className={styles.step}>
          <h1 className={styles.question}>{METRIC_QUESTIONS[metric]}</h1>
          <p className={styles.support}>{METRIC_GUIDANCE[metric]}</p>
          <p className={styles.priority}>
            중요도 · {EVALUATION_PRIORITY_LABELS[activeQuest.evaluationPriorities[metric]]}
            {priority === 0 ? ' — 점수는 반영하지 않아요' : ''}
          </p>
          <p className={styles.scale}>1 아쉬움 · 3 보통 · 5 매우 좋음</p>
          <div className={styles.ratings} role="group" aria-label={EVALUATION_METRIC_LABELS[metric]}>
            {RATINGS.map((value) => (
              <button
                key={value}
                type="button"
                className={
                  ratings[metric] === value ? `${styles.rating} ${styles.choiceOn}` : styles.rating
                }
                aria-pressed={ratings[metric] === value}
                onClick={() => selectRating(value)}
              >
                {value}
              </button>
            ))}
          </div>
          <button type="button" className={styles.skip} onClick={() => selectRating(null)}>
            평가하지 않음
          </button>
        </section>
      ) : null}

      {phase === 'factors' ? (
        <section className={styles.step}>
          <h1 className={styles.question}>숫자로 담기지 않는 중요한 점이 있나요?</h1>
          <p className={styles.support}>추가 장단점을 남겨 주세요. 점수에는 반영하지 않습니다.</p>
          {previewScore !== undefined ? (
            <p className={styles.scoreHint}>내 점수 {formatMyScore(previewScore)}</p>
          ) : (
            <p className={styles.support}>지금은 점수가 생기지 않습니다.</p>
          )}

          {adjustments.length > 0 ? (
            <ul className={styles.factorList}>
              {adjustments.map((item) => (
                <li key={item.id}>
                  <span>
                    {item.type === 'POSITIVE' ? '+' : '-'} {item.description}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setAdjustments((current) => current.filter((entry) => entry.id !== item.id))
                    }
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className={styles.factorForm}>
            <div className={styles.choices}>
              {(['POSITIVE', 'NEGATIVE'] as AdjustmentType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  className={factorType === type ? `${styles.choice} ${styles.choiceOn}` : styles.choice}
                  aria-pressed={factorType === type}
                  onClick={() => setFactorType(type)}
                >
                  {ADJUSTMENT_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
            <label className={styles.field}>
              <span>내용</span>
              <input
                value={factorText}
                onChange={(event) => setFactorText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addFactor()
                  }
                }}
              />
            </label>
            <button type="button" className={styles.secondary} onClick={addFactor}>
              장단점 추가
            </button>
          </div>

          <button type="button" className={`${styles.primary} ${styles.complete}`} onClick={saveEvaluation}>
            임장 완료
          </button>
          {existingVisits.length > 0 ? (
            <p className={styles.support}>이전 임장 기록은 그대로 남겨 둡니다.</p>
          ) : null}
        </section>
      ) : null}
      </div>
    </main>
  )
}

function ObservationField({
  id,
  label,
  value,
  items,
  onChange,
  onAdd,
  onRemove,
}: {
  id: string
  label: string
  value: string
  items: string[]
  onChange: (value: string) => void
  onAdd: () => void
  onRemove: (index: number) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  function addAndKeepFocus() {
    onAdd()
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  return (
    <div className={styles.block}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <div className={styles.addRow}>
        <input
          id={id}
          ref={inputRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addAndKeepFocus()
            }
          }}
        />
        <button type="button" className={styles.add} onClick={addAndKeepFocus}>
          추가
        </button>
      </div>
      {items.length > 0 ? (
        <ul className={styles.chips}>
          {items.map((item, index) => (
            <li key={`${item}-${index}`}>
              <span>{item}</span>
              <button type="button" onClick={() => onRemove(index)}>
                삭제
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function emptyRatings(): UserEvaluation['ratings'] {
  return {
    stationAccess: null,
    commuteFeel: null,
    commercial: null,
    school: null,
    nature: null,
    neighborhood: null,
  }
}

function toDatetimeLocalValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function visitedAtFromLocal(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString()
  }
  return parsed.toISOString()
}

