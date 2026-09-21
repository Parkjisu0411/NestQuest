import {
  NESTQUEST_DB_NAME,
  NESTQUEST_DB_VERSION,
  PHOTO_BLOB_STORE,
  USER_STATE_STORE,
  VISIT_DRAFT_STORE,
  PROVIDER_CACHE_STORE,
} from './schema.ts'
import { PersistError, PERSIST_READ_ERROR } from './errors.ts'

type UpgradeHandler = (db: IDBDatabase, transaction: IDBTransaction) => void

const UPGRADES: Record<number, UpgradeHandler> = {
  3: (db) => {
    if (!db.objectStoreNames.contains(PROVIDER_CACHE_STORE)) db.createObjectStore(PROVIDER_CACHE_STORE)
  },
  2: (db) => {
    if (!db.objectStoreNames.contains(VISIT_DRAFT_STORE)) db.createObjectStore(VISIT_DRAFT_STORE)
  },
  1: (db) => {
    if (!db.objectStoreNames.contains(USER_STATE_STORE)) {
      db.createObjectStore(USER_STATE_STORE)
    }
    if (!db.objectStoreNames.contains(PHOTO_BLOB_STORE)) {
      db.createObjectStore(PHOTO_BLOB_STORE)
    }
  },
}

let dbPromise: Promise<IDBDatabase> | null = null

export function openNestQuestDb(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise
  }

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new PersistError(PERSIST_READ_ERROR))
      return
    }

    const request = indexedDB.open(NESTQUEST_DB_NAME, NESTQUEST_DB_VERSION)
    let blocked = false
    request.onblocked = () => {
      blocked = true
      dbPromise = null
      reject(new PersistError('다른 NestQuest 탭을 닫고 다시 불러와 주세요.'))
    }

    request.onupgradeneeded = (event) => {
      const db = request.result
      const transaction = request.transaction
      if (!transaction) {
        return
      }
      for (let version = event.oldVersion + 1; version <= NESTQUEST_DB_VERSION; version += 1) {
        UPGRADES[version]?.(db, transaction)
      }
    }

    request.onsuccess = () => {
      if (blocked) { request.result.close(); return }
      request.result.onversionchange = () => {
        request.result.close()
        dbPromise = null
      }
      resolve(request.result)
    }
    request.onerror = () => {
      dbPromise = null
      reject(toPersistError(request.error, PERSIST_READ_ERROR))
    }
  })

  return dbPromise
}

export function requestToPromise<T>(request: IDBRequest<T>, userMessage: string): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(toPersistError(request.error, userMessage))
  })
}

export function transactionDone(transaction: IDBTransaction, userMessage: string): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(toPersistError(transaction.error, userMessage))
    transaction.onabort = () => reject(toPersistError(transaction.error, userMessage))
  })
}

export function toPersistError(cause: unknown, userMessage: string): PersistError {
  if (cause instanceof PersistError) {
    return cause
  }
  if (cause instanceof DOMException && cause.name === 'QuotaExceededError') {
    return new PersistError('저장 공간이 부족합니다. 입력 내용은 유지됩니다. 다른 파일의 공간을 확보하거나 첨부 사진을 줄인 뒤 다시 저장해 주세요.', cause)
  }
  return new PersistError(userMessage, cause)
}
