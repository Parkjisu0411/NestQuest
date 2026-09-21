import { afterEach, describe, expect, test, vi } from 'vitest'
import { PHOTO_BLOB_STORE, USER_STATE_STORE, VISIT_DRAFT_STORE, PROVIDER_CACHE_STORE } from './schema.ts'

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

function fakeOpen(existing: string[]) {
  const names = new Set(existing)
  const db = {
    objectStoreNames: { contains: (name: string) => names.has(name) },
    createObjectStore: vi.fn((name: string) => { names.add(name) }),
    close: vi.fn(), onversionchange: null as (() => void) | null,
  }
  const request = {
    result: db, transaction: {}, error: null,
    onupgradeneeded: null as ((event: { oldVersion: number }) => void) | null,
    onsuccess: null as (() => void) | null,
    onblocked: null as (() => void) | null,
  }
  const open = vi.fn(() => request)
  vi.stubGlobal('indexedDB', { open })
  return { db, request, open }
}

describe('draft store upgrade', () => {
  test('adds only the cache store to v2 and preserves user records, photos and drafts', async () => {
    const { db, request } = fakeOpen([USER_STATE_STORE, PHOTO_BLOB_STORE, VISIT_DRAFT_STORE])
    const { openNestQuestDb } = await import('./idb.ts')
    const pending = openNestQuestDb()
    request.onupgradeneeded?.({ oldVersion: 2 })
    request.onsuccess?.()
    await pending
    expect(db.createObjectStore).toHaveBeenCalledExactlyOnceWith(PROVIDER_CACHE_STORE)
  })
  test('adds draft and cache stores without replacing existing v1 stores', async () => {
    const { db, request, open } = fakeOpen([USER_STATE_STORE, PHOTO_BLOB_STORE])
    const { openNestQuestDb } = await import('./idb.ts')
    const pending = openNestQuestDb()
    request.onupgradeneeded?.({ oldVersion: 1 })
    request.onsuccess?.()
    await pending
    expect(open).toHaveBeenCalledWith('nestquest', 3)
    expect(db.createObjectStore.mock.calls.map(([name]) => name)).toEqual([VISIT_DRAFT_STORE, PROVIDER_CACHE_STORE])
    db.onversionchange?.()
    expect(db.close).toHaveBeenCalledOnce()
  })

  test('creates all stores on a fresh install', async () => {
    const { db, request } = fakeOpen([])
    const { openNestQuestDb } = await import('./idb.ts')
    const pending = openNestQuestDb()
    request.onupgradeneeded?.({ oldVersion: 0 })
    request.onsuccess?.()
    await pending
    expect(db.createObjectStore.mock.calls.map(([name]) => name))
      .toEqual([USER_STATE_STORE, PHOTO_BLOB_STORE, VISIT_DRAFT_STORE, PROVIDER_CACHE_STORE])
  })

  test('reports a blocked upgrade and closes a connection that opens after rejection', async () => {
    const { db, request } = fakeOpen([])
    const { openNestQuestDb } = await import('./idb.ts')
    const pending = openNestQuestDb()
    request.onblocked?.()
    await expect(pending).rejects.toThrow('다른 NestQuest 탭')
    request.onsuccess?.()
    expect(db.close).toHaveBeenCalledOnce()
  })
})
