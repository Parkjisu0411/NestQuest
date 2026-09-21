import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useQuestState } from '../../app/useQuest.ts'
import { useQuestPersist } from '../../app/persistContext.ts'
import {
  ADJUSTMENT_TYPE_LABELS, EVALUATION_METRIC_LABELS, EVALUATION_METRIC_ORDER,
  EVALUATION_PRIORITY_LABELS,
  type AdjustmentType, type EvaluationAdjustment, type UserEvaluation,
} from '../../domain/models.ts'
import { calculateMyScore, formatMyScore } from '../../domain/scoring.ts'
import { useApartmentCatalog } from '../../data/useApartmentCatalog.ts'
import { PERSIST_WRITE_ERROR } from '../../persistence/errors.ts'
import { userMessageFromUnknown } from '../../persistence/repository.ts'
import { PageChrome } from '../../ui/PageChrome.tsx'
import styles from './EvaluationScreen.module.css'
import { UnsavedChangesGuard } from '../../ui/UnsavedChangesGuard.tsx'

export function EvaluationScreen() {
  const apartmentCatalog = useApartmentCatalog()
  const { apartmentId = '' } = useParams()
  const { quest, visitsByApartmentId, userEvaluations } = useQuestState()
  const hasVisit = (visitsByApartmentId[apartmentId] ?? []).some((visit) => visit.questId === quest?.id)
  const apartment = apartmentCatalog.find(apartmentId)?.apartment
  const existing = userEvaluations[apartmentId]

  if (!quest || !apartment || !hasVisit) {
    return (
      <main className={styles.page}>
        <PageChrome backTo={`/apartments/${apartmentId}`} backLabel="단지로" />
        <h1>평가</h1>
        <p>{!apartment ? '단지를 찾을 수 없습니다.' : '임장 기록을 남긴 뒤 평가할 수 있습니다.'}</p>
      </main>
    )
  }

  return <EvaluationEditor key={`${quest.id}:${apartmentId}`} apartmentId={apartmentId} name={apartment.name} existing={existing} />
}

function EvaluationEditor({ apartmentId, name, existing }: {
  apartmentId: string; name: string; existing?: UserEvaluation
}) {
  const { quest } = useQuestState()
  const persist = useQuestPersist()
  const navigate = useNavigate()
  const [ratings, setRatings] = useState<UserEvaluation['ratings']>(() => ({
    stationAccess: null, commuteFeel: null, commercial: null,
    school: null, nature: null, neighborhood: null, ...existing?.ratings,
  }))
  const [notes, setNotes] = useState<EvaluationAdjustment[]>(() => existing?.adjustments.map((note) => ({ ...note })) ?? [])
  const [noteType, setNoteType] = useState<AdjustmentType>('POSITIVE')
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savingRef = useRef(false)
  const allowLeave = useRef(false)
  const dirty = JSON.stringify(ratings) !== JSON.stringify({ stationAccess: null, commuteFeel: null, commercial: null, school: null, nature: null, neighborhood: null, ...existing?.ratings }) || JSON.stringify(notes) !== JSON.stringify(existing?.adjustments ?? []) || noteText.trim() !== ''
  const mounted = useRef(true)
  const backTo = `/apartments/${apartmentId}`

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (!saving) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [saving])

  if (!quest) return null
  const activeQuest = quest
  const score = calculateMyScore({
    hasVisit: true,
    evaluation: { questId: quest.id, apartmentId, ratings, adjustments: notes, updatedAt: '' },
    priorities: quest.evaluationPriorities,
  })

  function withDraftNote() {
    return noteText.trim() ? [...notes, {
      id: crypto.randomUUID(), type: noteType, description: noteText.trim(), createdAt: new Date().toISOString(),
    }] : notes
  }

  async function save() {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setError(null)
    try {
      await persist.saveEvaluation({
        questId: activeQuest.id, apartmentId, ratings,
        adjustments: withDraftNote(), updatedAt: new Date().toISOString(),
      })
      allowLeave.current = true
      if (mounted.current) navigate(backTo)
    } catch (cause) {
      if (mounted.current) setError(`${userMessageFromUnknown(cause, PERSIST_WRITE_ERROR)} 다시 저장해 주세요.`)
    } finally {
      savingRef.current = false
      if (mounted.current) setSaving(false)
    }
  }

  return (
    <main className={styles.page}>
      {dirty || saving ? <UnsavedChangesGuard saving={saving} allowLeave={allowLeave} /> : null}
      {saving ? <p role="status">평가를 저장하고 있습니다.</p> : null}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <div inert={saving} aria-busy={saving}>
        <PageChrome backTo={backTo} backLabel="단지로" />
        <p className={styles.meta}>{name}</p>
        <h1>{existing ? '평가 수정' : '평가하기'}</h1>
        
        <div className={styles.metrics}>
          {EVALUATION_METRIC_ORDER.map((metric) => (
            <fieldset className={styles.metric} key={metric}>
              <legend>{EVALUATION_METRIC_LABELS[metric]}</legend>
              <p className={styles.meta}>중요도 · {EVALUATION_PRIORITY_LABELS[quest.evaluationPriorities[metric]]}</p>
              <div className={styles.choices}>
                {([1, 2, 3, 4, 5, null] as const).map((value) => (
                  <label key={value ?? 'unrated'} className={styles.choice}>
                    <input type="radio" name={metric} checked={ratings[metric] === value}
                      onChange={() => setRatings((current) => ({ ...current, [metric]: value }))} />
                    {value ?? '평가 안 함'}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <p className={styles.meta}>1 아쉬움 · 3 보통 · 5 매우 좋음</p>
        <section className={styles.notes} aria-label="추가 장단점">
          <h2>추가 장단점</h2>
          
          {notes.map((note) => (
            <div className={styles.note} key={note.id}>
              <label>
                {ADJUSTMENT_TYPE_LABELS[note.type]}
                <textarea value={note.description} rows={2} onChange={(event) => {
                  const description = event.target.value
                  setNotes((current) => current.map((item) => item.id === note.id ? { ...item, description } : item))
                }} />
              </label>
              <button type="button" onClick={() => setNotes((current) => current.filter((item) => item.id !== note.id))}>삭제</button>
            </div>
          ))}
          <label>장단점 종류
            <select value={noteType} onChange={(event) => setNoteType(event.target.value as AdjustmentType)}>
              <option value="POSITIVE">좋았던 점</option>
              <option value="NEGATIVE">아쉬웠던 점</option>
            </select>
          </label>
          <label>추가 내용<textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} rows={2} /></label>
          <button type="button" onClick={() => { setNotes(withDraftNote()); setNoteText('') }}>장단점 추가</button>
        </section>
        <div className={styles.actions}>
          <p>{score === undefined ? '평가한 항목과 중요도가 있어야 점수가 표시됩니다.' : `내 점수 ${formatMyScore(score)}`}</p>
          <button className={styles.primary} type="button" onClick={() => { void save() }}>평가 저장</button>
          <Link to={backTo}>취소</Link>
        </div>
      </div>
    </main>
  )
}
