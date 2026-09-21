import { isAndroidApp } from '../../platform/native.ts'
import { useRef, useState, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuestPersist } from '../../app/persistContext.ts'
import { useQuestState } from '../../app/useQuest.ts'
import { readBackupFile } from '../../persistence/photoBackup.ts'
import { userMessageFromUnknown } from '../../persistence/repository.ts'
import { BACKUP_UNREADABLE } from '../../persistence/errors.ts'
import styles from './SetupScreen.module.css'

export function RestoreScreen({ onCancel }: { onCancel?: () => void }) {
  const navigate = useNavigate()
  const persist = useQuestPersist()
  const { setupCompleted } = useQuestState()
  const [file, setFile] = useState<File | null>(null)
  const [summary, setSummary] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!selected || locked.current) return
    locked.current = true
    setBusy(true)
    setFile(null)
    setError('')
    try {
      const contents = await readBackupFile(selected)
      const visits = Object.values(contents.state.visitsByApartmentId).flat().length
      setSummary(`방문 ${visits}개 · ${contents.includesPhotos ? `사진 원본 ${contents.photos.length}개 포함` : '사진 원본 미포함 (JSON)'}`)
      setFile(selected)
    } catch (cause) {
      setError(userMessageFromUnknown(cause, BACKUP_UNREADABLE))
    } finally {
      locked.current = false
      setBusy(false)
    }
  }

  async function restore() {
    if (!file || locked.current) return
    locked.current = true
    setBusy(true)
    setError('')
    try {
      await persist.restoreBackupFile(file)
      navigate('/', { replace: true })
    } catch (cause) {
      setError(userMessageFromUnknown(cause, '복원하지 못했습니다. 다시 시도해 주세요.'))
    } finally {
      locked.current = false
      setBusy(false)
    }
  }

  return (
    <main className={styles.page} aria-busy={busy}>
      <header className={styles.top}>
        {busy ? <span>백업 처리 중</span> : onCancel ? <button onClick={onCancel}>돌아가기</button> : <Link className={styles.restoreLink} to={setupCompleted ? '/settings' : '/setup'}>돌아가기</Link>}
        <p className={styles.brand}>NestQuest</p>
      </header>
      <section className={styles.step}>
        <h1 className={styles.question}>백업으로 시작</h1>
        <p className={styles.support}>저장해 둔 백업에서 탐색 조건과 임장 기록을 가져옵니다. 사진 포함 백업(.nestquest) 또는 기록만 저장한 JSON 파일을 선택해 주세요.</p>
        <label className={styles.field}>
          백업 파일 선택
          <input className={styles.backupFile} type="file" accept={isAndroidApp() ? "*/*" : ".nestquest,.json,application/json"} disabled={busy} onChange={(event) => void selectFile(event)} />
        </label>
        {file ? <>
          <p className={styles.backupName}>{file.name}</p>
          <p role="status">{summary}</p>
          <p className={styles.support}>이 브라우저에 저장된 기록과 사진은 백업 내용으로 교체되고, 작성 중인 초안은 지워집니다. JSON에는 사진 원본이 들어 있지 않습니다.</p>
          <button className={styles.next} disabled={busy} onClick={() => void restore()}>이 백업 복원하기</button>
          <button className={styles.ghostButton} disabled={busy} onClick={() => setFile(null)}>선택 취소</button>
        </> : null}
        {busy ? <p role="status">백업을 처리하고 있습니다. 잠시 기다려 주세요.</p> : null}
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
      </section>
    </main>
  )
}
