import { CameraInput } from './CameraInput.tsx'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useQuestState } from '../../app/useQuest.ts'
import { useQuestPersist } from '../../app/persistContext.ts'
import { VISIT_TYPE_LABELS, VISIT_TYPE_ORDER, type Visit, type VisitType } from '../../domain/models.ts'
import { unlinkObservationPhoto, type ObservationGroupId, type ObservationId } from '../../domain/visitObservations.ts'
import { getPhotoBlob, userMessageFromUnknown, visitPhotoBlobKey } from '../../persistence/repository.ts'
import { VisitObservationsEditor } from './VisitObservationsEditor.tsx'
import { DraftPhotoPreview } from './DraftPhotoPreview.tsx'
import { editedVisitTime, toLocalVisitTime } from '../../domain/visitTime.ts'
import styles from './VisitScreen.module.css'
import { UnsavedChangesGuard } from '../../ui/UnsavedChangesGuard.tsx'

export function VisitEditScreen() {
  const { apartmentId = '', visitId = '' } = useParams()
  const { quest, visitsByApartmentId } = useQuestState()
  const visit = visitsByApartmentId[apartmentId]?.find((item) => item.id === visitId && item.questId === quest?.id)
  return visit ? <Editor key={visit.id} original={visit} /> : <main className={styles.page}><p>수정할 임장 기록을 찾을 수 없습니다.</p><Link to={`/apartments/${apartmentId}`}>단지로</Link></main>
}

function Editor({ original }: { original: Visit }) {
  const persist = useQuestPersist()
  const navigate = useNavigate()
  const backTo = `/apartments/${original.apartmentId}/visits/${original.id}`
  const [value, setValue] = useState(original)
  const [localTime, setLocalTime] = useState(() => toLocalVisitTime(original.visitedAt))
  const [files, setFiles] = useState<Record<string, Blob>>({})
  const [added, setAdded] = useState<Record<string, Blob>>({})
  const [group, setGroup] = useState<ObservationGroupId>('access')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const savingRef = useRef(false)
  const allowLeave = useRef(false)
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])
  useEffect(() => {
    let active = true
    Promise.all(original.photos.map(async (photo) => [photo.id, await getPhotoBlob(photo.blobKey).catch(() => null)] as const)).then((entries) => {
      if (active) setFiles(Object.fromEntries(entries.filter((entry): entry is readonly [string, Blob] => entry[1] instanceof Blob)))
    })
    return () => { active = false }
  }, [original])
  useEffect(() => {
    if (!dirty && !saving) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, saving])
  function addPhotos(list: FileList | null, id?: ObservationId) {
    setDirty(true)
    const next = Array.from(list ?? []).filter((file) => file.type.startsWith('image/')).map((file) => ({ id: crypto.randomUUID(), file }))
    const now = new Date().toISOString()
    setAdded((current) => ({ ...current, ...Object.fromEntries(next.map((photo) => [photo.id, photo.file])) }))
    setValue((current) => ({ ...current,
      photos: [...current.photos, ...next.map((photo) => ({ id: photo.id, visitId: current.id, blobKey: visitPhotoBlobKey(photo.id), createdAt: now }))],
      observations: id ? { ...current.observations, [id]: { ...(current.observations?.[id] ?? { status: 'unchecked', note: '' }), photoIds: [...(current.observations?.[id]?.photoIds ?? []), ...next.map((photo) => photo.id)] } } : current.observations,
    }))
  }
  async function save() {
    if (savingRef.current) return
    const date = new Date(localTime)
    if (!localTime || Number.isNaN(date.getTime())) { setError('방문 시각을 확인해 주세요.'); return }
    savingRef.current = true
    setSaving(true)
    setError('')
    try {
      await persist.saveVisitEdit({ ...value, visitedAt: editedVisitTime(original.visitedAt, localTime), updatedAt: new Date().toISOString() }, value.photos.flatMap((photo) => added[photo.id] ? [{ blobKey: photo.blobKey, blob: added[photo.id] }] : []))
      allowLeave.current = true
      if (mountedRef.current) navigate(backTo, { replace: true })
    } catch (cause) { setError(userMessageFromUnknown(cause, '수정 내용을 저장하지 못했습니다. 다시 시도해 주세요.')) }
    finally { savingRef.current = false; if (mountedRef.current) setSaving(false) }
  }
  return <main className={styles.page}>
    {dirty || saving ? <UnsavedChangesGuard saving={saving} allowLeave={allowLeave} /> : null}
    <h1>임장 기록 수정</h1>
    <p>저장을 눌러야 반영됩니다. 취소하면 변경을 버립니다. 수정 중 내용은 자동 저장되지 않습니다.</p>
    {error ? <p role="alert" className={styles.saveError}>{error}</p> : null}
    <form onChange={() => setDirty(true)} onSubmit={(event) => { event.preventDefault(); void save() }}>
      <fieldset disabled={saving} className={styles.editFields}>
        <label className={styles.field}>방문 시각<input type="datetime-local" required value={localTime} onChange={(event) => setLocalTime(event.target.value)} /></label>
        <label className={styles.field}>방문 시간대<select value={value.visitType ?? ''} onChange={(event) => setValue({ ...value, visitType: event.target.value as VisitType || undefined })}>
          <option value="">미지정</option>{VISIT_TYPE_ORDER.map((type) => <option key={type} value={type}>{VISIT_TYPE_LABELS[type]}</option>)}
        </select></label>
        <VisitObservationsEditor value={value.observations ?? {}} onChange={(observations) => { setValue({ ...value, observations }); setDirty(true) }} groupId={group} onGroupChange={setGroup} photos={value.photos.map((photo) => ({ id: photo.id, file: added[photo.id] ?? files[photo.id] }))} onAddPhotos={(id, list) => addPhotos(list, id)} />
        <Rows label="좋았던 점" value={value.pros} onChange={(pros) => { setValue({ ...value, pros }); setDirty(true) }} />
        <Rows label="아쉬웠던 점" value={value.cons} onChange={(cons) => { setValue({ ...value, cons }); setDirty(true) }} />
        <label className={styles.field}>메모<textarea rows={4} value={value.memo ?? ''} onChange={(event) => setValue({ ...value, memo: event.target.value })} /></label>
        <h2>방문 사진</h2>
        <p>원본이 없거나 읽지 못한 사진도 정보와 연결은 유지됩니다. 삭제를 누른 사진만 기록에서 빠집니다.</p>
        <CameraInput onFiles={(files) => addPhotos(files)} />
        <label className={styles.field}>사진 추가<input type="file" accept="image/*" multiple onChange={(event) => { addPhotos(event.target.files); event.target.value = '' }} /></label>
        <ul className={styles.previews}>{value.photos.map((photo, index) => <li key={photo.id}>
          {added[photo.id] || files[photo.id] ? <DraftPhotoPreview blob={added[photo.id] ?? files[photo.id]} /> : <p>원본 없음 또는 불러올 수 없음</p>}
          <span>사진 {index + 1}</span>
          <button type="button" aria-label={`사진 ${index + 1} 삭제`} onClick={() => { setDirty(true); setValue({ ...value, photos: value.photos.filter((item) => item.id !== photo.id), observations: unlinkObservationPhoto(value.observations ?? {}, photo.id) }) }}>삭제</button>
        </li>)}</ul>
        <div className={styles.actions}>
        <button type="submit" className={styles.primary}>{saving ? '저장 중…' : '수정 저장'}</button>
        <button type="button" className={styles.secondary} onClick={() => navigate(backTo, { replace: true })}>변경 취소</button>
        </div>
      </fieldset>
    </form>
  </main>
}

function Rows({ label, value, onChange }: { label: string; value: string[]; onChange: (value: string[]) => void }) {
  return <section><h2>{label}</h2>{value.map((text, index) => <div key={index}>
    <label className={styles.field}>{label} {index + 1}<textarea value={text} onChange={(event) => onChange(value.map((item, i) => i === index ? event.target.value : item))} /></label>
    <button type="button" onClick={() => onChange(value.filter((_, i) => i !== index))}>{label} {index + 1} 삭제</button>
  </div>)}<button type="button" onClick={() => onChange([...value, ''])}>{label} 추가</button></section>
}
