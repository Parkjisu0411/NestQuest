import { useEffect, useRef, useState } from 'react'
import { isAndroidApp } from '../../platform/native.ts'
import { Link, useParams } from 'react-router'
import { useQuestState } from '../../app/useQuest.ts'
import type { VisitPhoto } from '../../domain/models.ts'
import { OBSERVATION_STATUS_LABELS, VISIT_OBSERVATION_GROUPS } from '../../domain/visitObservations.ts'
import { formatVisitWhen } from '../../domain/visitFormat.ts'
import { useApartmentCatalog } from '../../data/useApartmentCatalog.ts'
import { getPhotoBlob } from '../../persistence/repository.ts'
import { PageChrome } from '../../ui/PageChrome.tsx'
import styles from './VisitDetailScreen.module.css'

export function VisitDetailScreen() {
  const apartmentCatalog = useApartmentCatalog()
  const { apartmentId = '', visitId = '' } = useParams()
  const { visitsByApartmentId } = useQuestState()
  const visit = visitsByApartmentId[apartmentId]?.find((item) => item.id === visitId)
  const apartment = apartmentCatalog.find(apartmentId)?.apartment

  return (
    <main className={styles.page}>
      <PageChrome backTo={`/apartments/${apartmentId}`} backLabel="단지로" />
      <h1 className={styles.title}>임장 기록</h1>
      {visit ? (
        <>
          <header className={styles.header}>
            <p>{apartment?.name ?? '저장한 단지'}</p>
            <p>{formatVisitWhen(visit.visitedAt, visit.visitType)}</p>
            <p className={styles.meta}>방문 시각 {formatTime(visit.visitedAt)}</p>
            <Link className={styles.photoLink} to={`/apartments/${apartmentId}/visits/${visit.id}/edit`}>기록 수정</Link>
          </header>
          <div className={styles.layout}>
            <div className={styles.notes}>
              {visit.observations ? <section className={styles.section} aria-label="현장 확인">
                <h2>현장 확인</h2>
                {VISIT_OBSERVATION_GROUPS.filter((group) => group.id !== 'interior' || group.items.some((item) => visit.observations?.[item.id])).map((group) => <div key={group.id}>
                  <h3>{group.label}</h3>
                  {group.items.map((item) => {
                    const entry = visit.observations?.[item.id]
                    return <div key={item.id}><strong>{item.label} · {OBSERVATION_STATUS_LABELS[entry?.status ?? 'unchecked']}</strong>
                      {entry?.note ? <p className={styles.text}>{entry.note}</p> : null}
                      {entry?.photoIds?.length ? <p>{entry.photoIds.map((id) => {
                        const index = visit.photos.findIndex((photo) => photo.id === id)
                        return index < 0 ? null : <a key={id} className={styles.photoLink} href={`#visit-photo-${index + 1}`}>사진 {index + 1} 보기</a>
                      })}</p> : null}
                    </div>
                  })}
                </div>)}
              </section> : null}
              <Observations title="좋았던 점" items={visit.pros} />
              <Observations title="아쉬웠던 점" items={visit.cons} />
              <section className={styles.section} aria-label="자유 메모">
                <h2>메모</h2>
                <p className={styles.text}>{visit.memo?.trim() ? visit.memo : '남긴 메모가 없습니다.'}</p>
              </section>
            </div>
            <section className={styles.section} aria-label="방문 사진">
              <h2>사진 {visit.photos.length}장</h2>
              {visit.photos.length === 0 ? <p>첨부한 사진이 없습니다.</p> : (
                <>
                  <p className={styles.meta}>사진을 누르면 {isAndroidApp() ? '앱 안에서' : '새 탭에서'} 크게 볼 수 있습니다.</p>
                  <ul className={styles.photos}>
                    {visit.photos.map((photo, index) => (
                      <li key={`${photo.id}:${photo.blobKey}`} id={`visit-photo-${index + 1}`} tabIndex={-1}>
                        <SavedPhoto photo={photo} number={index + 1} />
                        <p className={styles.meta}>{VISIT_OBSERVATION_GROUPS.flatMap((group) => group.items.filter((item) => visit.observations?.[item.id]?.photoIds?.includes(photo.id)).map((item) => item.label)).join(' · ') || '방문 공통 사진'}</p>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>
        </>
      ) : (
        <div className={styles.section}>
          <p>이 방문 기록을 찾을 수 없습니다.</p>
          <Link to={`/apartments/${apartmentId}`}>단지의 방문 목록으로</Link>
        </div>
      )}
    </main>
  )
}

function Observations({ title, items }: { title: string; items: string[] }) {
  return (
    <section className={styles.section} aria-label={title}>
      <h2>{title}</h2>
      {items.length > 0 ? (
        <ul className={styles.observations}>
          {items.map((item, index) => <li className={styles.text} key={index}>{item}</li>)}
        </ul>
      ) : <p>남긴 기록이 없습니다.</p>}
    </section>
  )
}

type PhotoState =
  | { status: 'loading' | 'missing' | 'error' }
  | { status: 'ready'; url: string }

function SavedPhoto({ photo, number }: { photo: VisitPhoto; number: number }) {
  const [attempt, setAttempt] = useState(0)
  return <PhotoAttempt key={attempt} photo={photo} number={number} onRetry={() => setAttempt((value) => value + 1)} />
}

function PhotoAttempt({ photo, number, onRetry }: {
  photo: VisitPhoto; number: number; onRetry: () => void
}) {
  const [state, setState] = useState<PhotoState>({ status: 'loading' })
  const [expanded, setExpanded] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (expanded) dialog.current?.showModal() }, [expanded])

  useEffect(() => {
    let cancelled = false
    let url: string | undefined
    getPhotoBlob(photo.blobKey).then((blob) => {
      if (cancelled) return
      if (!blob) {
        setState({ status: 'missing' })
        return
      }
      url = URL.createObjectURL(blob)
      setState({ status: 'ready', url })
    }).catch(() => {
      if (!cancelled) setState({ status: 'error' })
    })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [photo.blobKey])

  return (
    <figure className={styles.photo}>
      {state.status === 'ready' ? (
        isAndroidApp() ? <>
          <button type="button" aria-label={`방문 사진 ${number} 크게 보기`} onClick={() => setExpanded(true)}>
            <img src={state.url} alt={`방문 사진 ${number}`} onError={() => setState({ status: 'error' })} />
          </button>
          {expanded ? <dialog className="photo-viewer" ref={dialog} onCancel={() => setExpanded(false)} onClose={() => setExpanded(false)} aria-label={`방문 사진 ${number} 원본`}>
            <button autoFocus onClick={() => setExpanded(false)}>사진 닫기</button>
            <div><img src={state.url} alt={`방문 사진 ${number} 원본`} /></div>
          </dialog> : null}
        </> :
        <a href={state.url} target="_blank" rel="noreferrer" aria-label={`방문 사진 ${number} 크게 보기 (새 탭)`}>
          <img src={state.url} alt={`방문 사진 ${number}`} onError={() => setState({ status: 'error' })} />
        </a>
      ) : (
        <div className={styles.placeholder} role="status">
          {state.status === 'loading' ? '사진을 불러오는 중입니다.' : state.status === 'missing' ? (
            <>
              <p>이 기기에 사진 원본이 없습니다.</p>
              <p>JSON 백업에는 사진 원본이 포함되지 않습니다.</p>
            </>
          ) : <p>사진을 불러올 수 없습니다.</p>}
          {state.status === 'error' ? <button type="button" onClick={onRetry}>다시 불러오기</button> : null}
        </div>
      )}
      <figcaption>사진 {number}</figcaption>
    </figure>
  )
}

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

