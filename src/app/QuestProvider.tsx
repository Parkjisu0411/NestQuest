import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import { backupFilename, createBackup, restoreFromBackupText, serializeBackup } from '../persistence/backup.ts'
import { downloadJsonFile, downloadBlobFile } from '../persistence/download.ts'
import { createPhotoBackup, readBackupFile } from '../persistence/photoBackup.ts'
import { PERSIST_READ_ERROR, PERSIST_WRITE_ERROR } from '../persistence/errors.ts'
import {
  loadPersistedAppState,
  getPhotoBlob,
  saveVisitWithPhotos,
  type PhotoBlobWrite,
  replacePersistedAppState,
  savePersistedAppState,
  userMessageFromUnknown,
} from '../persistence/repository.ts'
import { QuestPersistContext } from './persistContext.ts'
import { saveEvaluationChange } from './saveEvaluation.ts'
import type { UserEvaluation, Visit } from '../domain/models.ts'
import { saveVisitEditChange } from './saveVisitEdit.ts'
import { visitDraftKey } from '../persistence/visitDraft.ts'
import { BrowseProvider } from './BrowseProvider.tsx'
import {
  initialQuestState,
  QuestDispatchContext,
  QuestStateContext,
  questReducer,
  type QuestAction,
} from './questStore.ts'
import styles from './QuestProvider.module.css'
import { RestoreScreen } from '../screens/setup/RestoreScreen.tsx'
import { mergeCatalog } from '../data/catalogSnapshot.ts'
import type { DiscoverableApartment } from '../domain/discover.ts'

export function QuestProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(questReducer, initialQuestState)
  const latestState = useRef(state)
  useLayoutEffect(() => { latestState.current = state }, [state])
  const [ready, setReady] = useState(false)
  const [readError, setReadError] = useState<string | null>(null)
  const [readAttempt, setReadAttempt] = useState(0)
  const [recoverBackup, setRecoverBackup] = useState(false)
  const [writeError, setWriteError] = useState<string | null>(null)
  const [writeAttempt, setWriteAttempt] = useState(0)
  const persistPaused = useRef(true)
  const mutationSaving = useRef(false)

  useEffect(() => {
    let cancelled = false

    loadPersistedAppState()
      .then((loaded) => {
        if (cancelled) {
          return
        }
        if (loaded !== null) {
          dispatch({ type: 'replaceState', state: loaded })
        }
        persistPaused.current = false
        setReady(true)
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }
        // Never enable setup/autosave after a failed read: it could overwrite existing data.
        setReadError(userMessageFromUnknown(error, PERSIST_READ_ERROR))
      })

    return () => {
      cancelled = true
    }
  }, [readAttempt])

  useEffect(() => {
    if (!ready || persistPaused.current || !state.setupCompleted) {
      return
    }

    let cancelled = false
    savePersistedAppState(state).then(
      () => {
        if (!cancelled) {
          setWriteError(null)
        }
      },
      (error: unknown) => {
        if (!cancelled) {
          setWriteError(userMessageFromUnknown(error, PERSIST_WRITE_ERROR))
        }
      },
    )

    return () => {
      cancelled = true
    }
  }, [ready, state, writeAttempt])

  const persist = useMemo(
    () => ({
      writeError,
      async saveCatalog(records: DiscoverableApartment[]) {
        if (mutationSaving.current) throw new Error('다른 저장이 끝난 뒤 다시 시도해 주세요.')
        mutationSaving.current = true
        persistPaused.current = true
        try {
          const current = latestState.current
          const next = { ...current, catalogSnapshot: mergeCatalog(current.catalogSnapshot, records) }
          await savePersistedAppState(next)
          latestState.current = next
          dispatch({ type: 'replaceState', state: next })
          setWriteError(null)
        } finally { mutationSaving.current = false; persistPaused.current = false }
      },
      async exportBackupFile() {
        const backup = createBackup(state)
        await downloadJsonFile(backupFilename(), serializeBackup(backup))
      },
      async restoreBackupText(raw: string) {
        if (mutationSaving.current) {
          throw new Error('저장이 끝난 뒤 복원해 주세요.')
        }
        mutationSaving.current = true
        persistPaused.current = true
        try {
          const next = await restoreFromBackupText(raw, {
            replace: replacePersistedAppState,
          })
          dispatch({ type: 'replaceState', state: next })
          setWriteError(null)
        } finally {
          mutationSaving.current = false
          persistPaused.current = false
        }
      },
      async completeVisit(action: Extract<QuestAction, { type: 'completeVisit' }>, photos: PhotoBlobWrite[]) {
        if (mutationSaving.current) {
          throw new Error('이미 기록을 저장하고 있습니다.')
        }
        const next = questReducer(state, action)
        if (next === state) {
          throw new Error('방문 기록을 추가할 수 없습니다.')
        }
        mutationSaving.current = true
        persistPaused.current = true
        try {
          await saveVisitWithPhotos(next, photos, visitDraftKey(action.visit.questId, action.visit.apartmentId))
          dispatch(action)
          setWriteError(null)
        } finally {
          mutationSaving.current = false
          persistPaused.current = false
        }
      },
      async exportPhotoBackup() {
        if (mutationSaving.current) throw new Error('저장이 끝난 뒤 백업해 주세요.')
        mutationSaving.current = true
        try {
          const file = await createPhotoBackup(state, getPhotoBlob)
          await downloadBlobFile(backupFilename().replace('.json', '.nestquest'), file)
        } finally { mutationSaving.current = false }
      },
      async restoreBackupFile(file: Blob) {
        if (mutationSaving.current) throw new Error('저장이 끝난 뒤 복원해 주세요.')
        mutationSaving.current = true
        persistPaused.current = true
        try {
          const contents = await readBackupFile(file)
          await replacePersistedAppState(contents.state, contents.photos)
          dispatch({ type: 'replaceState', state: contents.state })
          setWriteError(null)
          setReadError(null)
          setRecoverBackup(false)
          setReady(true)
        } finally {
          mutationSaving.current = false
          persistPaused.current = false
        }
      },
      async saveEvaluation(evaluation: UserEvaluation) {
        if (mutationSaving.current) {
          throw new Error('이미 기록을 저장하고 있습니다.')
        }
        mutationSaving.current = true
        persistPaused.current = true
        try {
          await saveEvaluationChange(state, evaluation, savePersistedAppState, () => {
            dispatch({ type: 'updateEvaluation', evaluation })
          })
          setWriteError(null)
        } finally {
          mutationSaving.current = false
          persistPaused.current = false
        }
      },
      async saveVisitEdit(visit: Visit, photos: PhotoBlobWrite[]) {
        if (mutationSaving.current) throw new Error('이미 기록을 저장하고 있습니다.')
        mutationSaving.current = true
        persistPaused.current = true
        try {
          const previousKeys = state.visitsByApartmentId[visit.apartmentId]?.find((item) => item.id === visit.id)?.photos.map((photo) => photo.blobKey) ?? []
          const nextKeys = new Set(visit.photos.map((photo) => photo.blobKey))
          await saveVisitEditChange(state, visit, (next) => saveVisitWithPhotos(next, photos, undefined, previousKeys.filter((key) => !nextKeys.has(key))), () => dispatch({ type: 'updateVisit', visit }))
          setWriteError(null)
        } finally {
          mutationSaving.current = false
          persistPaused.current = false
        }
      },
    }),
    [state, writeError],
  )

  if (!ready) {
    if (readError && recoverBackup) return <QuestStateContext.Provider value={state}>
      <QuestPersistContext.Provider value={persist}>
        <RestoreScreen onCancel={() => setRecoverBackup(false)} />
      </QuestPersistContext.Provider>
    </QuestStateContext.Provider>
    return (
      <div className={styles.boot}>
        {readError ? <section role="alert"><h1>기록을 불러오지 못했습니다</h1><p>{readError}</p><p>저장된 기록을 보호하기 위해 편집을 멈췄습니다.</p><button onClick={() => { setReadError(null); setReadAttempt((value) => value + 1) }}>다시 불러오기</button>{' '}<button onClick={() => setRecoverBackup(true)}>백업에서 복구</button></section> : <p>불러오는 중</p>}
      </div>
    )
  }

  return (
    <QuestStateContext.Provider value={state}>
      <QuestDispatchContext.Provider value={dispatch}>
        <QuestPersistContext.Provider value={persist}>
          {writeError ? (
            <p className={styles.banner} role="status">
              {writeError}
              <button type="button" onClick={() => setWriteAttempt((value) => value + 1)}>저장 다시 시도</button>
            </p>
          ) : null}
          <BrowseProvider key={state.quest?.id ?? 'setup'}>{children}</BrowseProvider>
        </QuestPersistContext.Provider>
      </QuestDispatchContext.Provider>
    </QuestStateContext.Provider>
  )
}
