import { describe, expect, it, vi } from 'vitest'
import { initialQuestState, type QuestAppState } from '../app/questStore.ts'
import { MOCK_APARTMENTS } from '../mock/apartments.ts'
import { openNestQuestDb } from './idb.ts'
import { inspectUnusedPhotos } from './repository.ts'
import { toPersistedUserState } from './snapshot.ts'
import { PHOTO_BLOB_STORE, USER_STATE_STORE } from './schema.ts'

vi.mock('./idb.ts', async (original) => ({ ...await original<typeof import('./idb.ts')>(), openNestQuestDb: vi.fn() }))
const now = '2026-09-18T00:00:00Z'
const state: QuestAppState = {
  ...initialQuestState, setupCompleted: true,
  quest: { id: 'q', searchCriteria: { areas: [MOCK_APARTMENTS[0].area] }, evaluationPriorities: { stationAccess: 1, commuteFeel: 1, commercial: 1, school: 1, nature: 1, neighborhood: 1 }, loanAssumption: { annualInterestRate: .04, termYears: 30 }, createdAt: now, updatedAt: now },
  visitsByApartmentId: { a: [{ id: 'v', apartmentId: 'a', questId: 'q', visitedAt: now, createdAt: now, updatedAt: now, pros: [], cons: [], photos: [{ id: 'p', visitId: 'v', blobKey: 'keep', createdAt: now }] }] },
}

function database(raw: unknown, failDelete = false) {
  const deleted: string[] = []
  let aborted = false
  const rows = [{ key: 'keep', value: new Blob(['keep']) }, { key: 'orphan', value: new Blob(['orphan']) }]
  const transaction = {
    oncomplete: undefined as (() => void) | undefined,
    onabort: undefined as (() => void) | undefined,
    abort() { aborted = true; deleted.length = 0; queueMicrotask(() => this.onabort?.()) },
    objectStore(name: string) {
      if (name === USER_STATE_STORE) return { get() {
        const request = { result: raw, onsuccess: undefined as (() => void) | undefined }
        queueMicrotask(() => request.onsuccess?.())
        return request
      } }
      if (name !== PHOTO_BLOB_STORE) throw new Error('Unexpected store')
      return { openCursor() {
        let index = 0
        const request = { result: null as unknown, onsuccess: undefined as (() => void) | undefined }
        const advance = () => {
          const row = rows[index++]
          request.result = row ? { ...row, delete() { if (failDelete) throw new Error('failed'); deleted.push(row.key) }, continue() { queueMicrotask(advance) } } : null
          request.onsuccess?.()
          if (!row && !aborted) queueMicrotask(() => transaction.oncomplete?.())
        }
        queueMicrotask(advance)
        return request
      } }
    },
  }
  const start = vi.fn(() => transaction)
  vi.mocked(openNestQuestDb).mockResolvedValue({ transaction: start } as unknown as IDBDatabase)
  return { deleted, start }
}

describe('unused photo reclamation', () => {
  it('previews only unused bytes without deleting', async () => {
    const db = database(toPersistedUserState(state))
    expect(await inspectUnusedPhotos()).toEqual({ count: 1, bytes: 6 })
    expect(db.deleted).toEqual([])
    expect(db.start).toHaveBeenCalledWith([USER_STATE_STORE, PHOTO_BLOB_STORE], 'readonly')
  })
  it('rechecks saved references in the write transaction and preserves linked originals', async () => {
    const db = database(toPersistedUserState(state))
    expect(await inspectUnusedPhotos(true)).toEqual({ count: 1, bytes: 6 })
    expect(db.deleted).toEqual(['orphan'])
    expect(db.start).toHaveBeenCalledWith([USER_STATE_STORE, PHOTO_BLOB_STORE], 'readwrite')
  })
  it.each([undefined, { invalid: true }])('does not delete on unavailable or malformed saved state: %j', async (raw) => {
    const db = database(raw)
    await expect(inspectUnusedPhotos(true)).rejects.toThrow()
    expect(db.deleted).toEqual([])
  })
  it('aborts when deletion fails', async () => {
    const db = database(toPersistedUserState(state), true)
    await expect(inspectUnusedPhotos(true)).rejects.toThrow()
    expect(db.deleted).toEqual([])
  })
})
