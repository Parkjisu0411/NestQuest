import { OBSERVATION_STATUS_LABELS, VISIT_OBSERVATION_GROUPS, type ObservationGroupId, type ObservationStatus, type VisitObservations } from '../../domain/visitObservations.ts'
import styles from './VisitObservationsEditor.module.css'
import type { ObservationId } from '../../domain/visitObservations.ts'
import { DraftPhotoPreview } from './DraftPhotoPreview.tsx'
import { CameraInput } from './CameraInput.tsx'

export function VisitObservationsEditor({ value, onChange, groupId, onGroupChange, photos, onAddPhotos }: {
  value: VisitObservations; onChange: (value: VisitObservations) => void
  groupId: ObservationGroupId; onGroupChange: (group: ObservationGroupId) => void
  photos: { id: string; file?: Blob }[]
  onAddPhotos: (id: ObservationId, files: FileList | null) => void
}) {
  const group = VISIT_OBSERVATION_GROUPS.find((item) => item.id === groupId)!
  const checked = Object.values(value).filter((item) => item?.status === 'checked').length
  const skipped = Object.values(value).filter((item) => item?.status === 'notApplicable').length
  return <section className={styles.section} aria-labelledby="observations-heading">
    <h2 id="observations-heading">현장 확인</h2>
    <p aria-live="polite">확인함 {checked} · 해당 없음 {skipped} · 미확인 {VISIT_OBSERVATION_GROUPS.reduce((sum, item) => sum + item.items.length, 0) - checked - skipped}</p>
    
    <div className={styles.layout}>
      <nav className={styles.groups} aria-label="현장 확인 구역">
        {VISIT_OBSERVATION_GROUPS.map((item) => <button key={item.id} type="button" aria-pressed={item.id === groupId} onClick={() => onGroupChange(item.id)}>{item.label}</button>)}
      </nav>
      <div className={styles.items}>
        {group.items.map((item) => {
          const entry = value[item.id] ?? { status: 'unchecked', note: '' }
          return <fieldset key={item.id} className={styles.item}>
            <legend>{item.label}</legend>
            <div className={styles.statuses}>
              {Object.entries(OBSERVATION_STATUS_LABELS).map(([status, label]) => <label key={status}>
                <input type="radio" name={`observation-${item.id}`} checked={entry.status === status} onChange={() => onChange({ ...value, [item.id]: { ...entry, status: status as ObservationStatus } })} />{label}
              </label>)}
            </div>
            <label className={styles.note}>관찰 메모
              <textarea rows={2} value={entry.note} placeholder={item.hint} onChange={(event) => onChange({ ...value, [item.id]: { ...entry, note: event.target.value } })} />
            </label>
            <label className="file-action">사진 추가
              <input type="file" accept="image/*" multiple onChange={(event) => { onAddPhotos(item.id, event.target.files); event.target.value = '' }} />
            </label>
            <CameraInput onFiles={(files) => onAddPhotos(item.id, files)} />
            {photos.length > 0 ? <details className={styles.photoPicker}>
              <summary>사진 연결 · {entry.photoIds?.length ?? 0}장</summary>
              
              <div className={styles.photoGrid}>
                {photos.map((photo, index) => <label key={photo.id}>
                  {photo.file ? <DraftPhotoPreview blob={photo.file} /> : <span>미리보기 없음</span>}
                  <span><input type="checkbox" checked={entry.photoIds?.includes(photo.id) ?? false} onChange={(event) => onChange({ ...value, [item.id]: {
                    ...entry, photoIds: event.target.checked ? [...(entry.photoIds ?? []), photo.id] : (entry.photoIds ?? []).filter((id) => id !== photo.id),
                  } })} />사진 {index + 1}</span>
                </label>)}
              </div>
            </details> : null}
          </fieldset>
        })}
      </div>
    </div>
  </section>
}
