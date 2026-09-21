import type { QuestAppState } from '../app/questStore.ts'
import { removeUnlinkedRecords } from './removeUnlinkedRecords.ts'
import {
  openNestQuestDb,
  requestToPromise,
  transactionDone,
} from './idb.ts'
import {
  PHOTO_BLOB_STORE,
  USER_STATE_KEY,
  USER_STATE_STORE,
  VISIT_DRAFT_STORE,
} from './schema.ts'
import { collectPhotoBlobKeys, parsePersistedUserState, persistedToAppState, toPersistedUserState } from './snapshot.ts'
import { PERSIST_READ_ERROR, PERSIST_WRITE_ERROR, PersistError } from './errors.ts'
import { DRAFT_READ_ERROR, DRAFT_WRITE_ERROR, parseVisitDraft, visitDraftKey, type VisitDraft } from './visitDraft.ts'

let writeChain: Promise<unknown> = Promise.resolve()

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = writeChain.then(task, task)
  writeChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

export function loadPersistedAppState(): Promise<QuestAppState | null> {
  return enqueue(async () => {
    const db = await openNestQuestDb()
    // User-requested cleanup runs once per installation, atomically with its marker.
    const migrationKey = 'cleanup-unlinked-2026-09-21'
    const transaction = db.transaction([USER_STATE_STORE, PHOTO_BLOB_STORE, VISIT_DRAFT_STORE], 'readwrite')
    const done = transactionDone(transaction, PERSIST_WRITE_ERROR)
    const store = transaction.objectStore(USER_STATE_STORE)
    try {
      const [raw, cleaned] = await Promise.all([
        requestToPromise(store.get(USER_STATE_KEY), PERSIST_READ_ERROR),
        requestToPromise(store.get(migrationKey), PERSIST_READ_ERROR),
      ])
      if (raw === undefined) { await done; return null }
      const loaded = persistedToAppState(parsePersistedUserState(raw))
      if (cleaned) { await done; return loaded }
      const result = removeUnlinkedRecords(loaded)
      if (result.ids.size) {
        store.put(toPersistedUserState(result.state), USER_STATE_KEY)
        for (const key of result.photoKeys) transaction.objectStore(PHOTO_BLOB_STORE).delete(key)
        const drafts = transaction.objectStore(VISIT_DRAFT_STORE).openCursor()
        drafts.onsuccess = () => {
          const cursor = drafts.result
          if (!cursor) return
          if (result.ids.has(cursor.value?.apartmentId)) cursor.delete()
          cursor.continue()
        }
      }
      store.put(true, migrationKey)
      await done
      return result.state
    } catch (error) {
      try { transaction.abort() } catch { /* Transaction may already have aborted. */ }
      await done.catch(() => undefined)
      throw new PersistError(PERSIST_READ_ERROR, error)
    }
  })
}

export function savePersistedAppState(state: QuestAppState): Promise<void> {
  return enqueue(async () => {
    const db = await openNestQuestDb()
    const transaction = db.transaction(USER_STATE_STORE, 'readwrite')
    transaction.objectStore(USER_STATE_STORE).put(toPersistedUserState(state), USER_STATE_KEY)
    await transactionDone(transaction, PERSIST_WRITE_ERROR)
  })
}

export function replacePersistedAppState(state: QuestAppState, photos: PhotoBlobWrite[] = []): Promise<void> {
  return enqueue(async () => {
    const db = await openNestQuestDb()
    const transaction = db.transaction([USER_STATE_STORE, PHOTO_BLOB_STORE, VISIT_DRAFT_STORE], 'readwrite')
    const done = transactionDone(transaction, PERSIST_WRITE_ERROR)
    try {
    transaction.objectStore(USER_STATE_STORE).put(toPersistedUserState(state), USER_STATE_KEY)
    transaction.objectStore(PHOTO_BLOB_STORE).clear()
    for (const photo of photos) transaction.objectStore(PHOTO_BLOB_STORE).put(photo.blob, photo.blobKey)
    transaction.objectStore(VISIT_DRAFT_STORE).clear()
    } catch (error) {
      transaction.abort()
      await done.catch(() => undefined)
      throw new PersistError(PERSIST_WRITE_ERROR, error)
    }
    await done
  })
}

export interface PhotoBlobWrite {
  blobKey: string
  blob: Blob
}

/** Commit the visit, its evaluation/stage, and all originals together. */
export function saveVisitWithPhotos(state: QuestAppState, photos: PhotoBlobWrite[], draftKey?: string, removedKeys: string[] = []): Promise<void> {
  return enqueue(async () => {
    const snapshot = toPersistedUserState(state)
    const db = await openNestQuestDb()
    const transaction = db.transaction([USER_STATE_STORE, PHOTO_BLOB_STORE, VISIT_DRAFT_STORE], 'readwrite')
    const done = transactionDone(transaction, PERSIST_WRITE_ERROR)
    try {
      for (const photo of photos) {
        transaction.objectStore(PHOTO_BLOB_STORE).put(photo.blob, photo.blobKey)
      }
      const retained = new Set(Object.values(state.visitsByApartmentId).flatMap((visits) => visits.flatMap((visit) => visit.photos.map((photo) => photo.blobKey))))
      for (const key of new Set(removedKeys)) {
        if (!retained.has(key)) transaction.objectStore(PHOTO_BLOB_STORE).delete(key)
      }
      transaction.objectStore(USER_STATE_STORE).put(snapshot, USER_STATE_KEY)
      if (draftKey) transaction.objectStore(VISIT_DRAFT_STORE).delete(draftKey)
    } catch (error) {
      // A synchronous put failure must also roll back earlier queued writes.
      transaction.abort()
      await done.catch(() => undefined)
      throw new PersistError(PERSIST_WRITE_ERROR, error)
    }
    await done
  })
}

export function getPhotoBlob(blobKey: string): Promise<Blob | undefined> {
  return enqueue(async () => {
    const db = await openNestQuestDb()
    const value = await requestToPromise(
      db.transaction(PHOTO_BLOB_STORE, 'readonly').objectStore(PHOTO_BLOB_STORE).get(blobKey),
      PERSIST_READ_ERROR,
    )
    return value instanceof Blob ? value : undefined
  })
}

export function visitPhotoBlobKey(photoId: string): string {
  return `visit-photo:${photoId}`
}

export function loadVisitDraft(questId: string, apartmentId: string): Promise<VisitDraft | null> {
  return enqueue(async () => {
    const db = await openNestQuestDb()
    const raw = await requestToPromise(db.transaction(VISIT_DRAFT_STORE, 'readonly')
      .objectStore(VISIT_DRAFT_STORE).get(visitDraftKey(questId, apartmentId)), DRAFT_READ_ERROR)
    return raw === undefined ? null : parseVisitDraft(raw, questId, apartmentId)
  })
}

export function saveVisitDraft(draft: VisitDraft): Promise<void> {
  return enqueue(async () => {
    const db = await openNestQuestDb()
    const transaction = db.transaction(VISIT_DRAFT_STORE, 'readwrite')
    transaction.objectStore(VISIT_DRAFT_STORE).put(draft, visitDraftKey(draft.questId, draft.apartmentId))
    await transactionDone(transaction, DRAFT_WRITE_ERROR)
  })
}

export function userMessageFromUnknown(error: unknown, fallback: string): string {
  if (error instanceof PersistError) {
    return error.userMessage
  }
  return fallback
}

/** Rechecks references inside the same transaction; drafts own their Blobs separately. */
export function inspectUnusedPhotos(remove = false): Promise<{ count: number; bytes: number }> {
  return enqueue(async () => {
    const db = await openNestQuestDb()
    const transaction = db.transaction([USER_STATE_STORE, PHOTO_BLOB_STORE], remove ? 'readwrite' : 'readonly')
    const done = transactionDone(transaction, PERSIST_WRITE_ERROR)
    let failure: unknown
    const result = { count: 0, bytes: 0 }
    const request = transaction.objectStore(USER_STATE_STORE).get(USER_STATE_KEY)
    request.onsuccess = () => {
      try {
        // No trustworthy state means no permission to reclaim originals.
        if (request.result === undefined) throw new Error('No saved state')
        const referenced = new Set(collectPhotoBlobKeys(parsePersistedUserState(request.result)))
        const cursor = transaction.objectStore(PHOTO_BLOB_STORE).openCursor()
        cursor.onsuccess = () => {
          try {
            const row = cursor.result
            if (!row) return
            if (typeof row.key === 'string' && !referenced.has(row.key)) {
              result.count += 1
              if (row.value instanceof Blob) result.bytes += row.value.size
              if (remove) row.delete()
            }
            row.continue()
          } catch (error) { failure = error; transaction.abort() }
        }
      } catch (error) { failure = error; transaction.abort() }
    }
    try { await done } catch (error) { throw new PersistError('사진 저장 공간을 확인하거나 정리하지 못했습니다. 저장된 기록을 다시 불러온 후 시도해 주세요.', failure ?? error) }
    return result
  })
}
