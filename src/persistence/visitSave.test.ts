import { beforeEach, describe, expect, test, vi } from 'vitest'
import { initialQuestState, questReducer } from '../app/questStore.ts'
import { openNestQuestDb } from './idb.ts'
import { saveVisitWithPhotos, replacePersistedAppState } from './repository.ts'
import { PHOTO_BLOB_STORE, USER_STATE_KEY, USER_STATE_STORE, VISIT_DRAFT_STORE } from './schema.ts'

vi.mock('./idb.ts', async (importOriginal) => ({
  ...await importOriginal<typeof import('./idb.ts')>(),
  openNestQuestDb: vi.fn(),
}))

function controlledTransaction(failStore?: string) {
  const writes: Array<{ store: string; value: unknown; key: IDBValidKey }> = []
  const transaction = {
    error: null as DOMException | null,
    oncomplete: null as (() => void) | null,
    onerror: null as (() => void) | null,
    onabort: null as (() => void) | null,
    objectStore: (store: string) => ({
      clear: () => {
        if (store === failStore) throw new DOMException('Clear failed', 'UnknownError')
        writes.push({ store, value: 'clear', key: 'all' })
      },
      put: (value: unknown, key: IDBValidKey) => {
        if (store === failStore) throw new DOMException('Cannot clone', 'DataCloneError')
        writes.push({ store, value, key })
      },
      delete: (key: IDBValidKey) => {
        if (store === failStore) throw new DOMException('Delete failed', 'UnknownError')
        writes.push({ store, value: undefined, key })
      },
    }),
    abort: vi.fn(() => queueMicrotask(() => transaction.onabort?.())),
  }
  const start = vi.fn(() => transaction)
  vi.mocked(openNestQuestDb).mockResolvedValue({ transaction: start } as unknown as IDBDatabase)
  return { transaction, writes, start }
}

beforeEach(() => vi.clearAllMocks())

describe('atomic visit persistence', () => {
  test('reclaims a removed original only in the state commit transaction', async () => {
    const { transaction, writes } = controlledTransaction()
    const saving = saveVisitWithPhotos(initialQuestState, [], undefined, ['removed', 'removed'])
    await vi.waitFor(() => expect(writes).toHaveLength(2))
    expect(writes[0]).toEqual({ store: PHOTO_BLOB_STORE, key: 'removed', value: undefined })
    expect(writes[1].store).toBe(USER_STATE_STORE)
    transaction.oncomplete?.()
    await saving
  })
  test('rolls back the edit when removing an original fails', async () => {
    const { transaction } = controlledTransaction(PHOTO_BLOB_STORE)
    await expect(saveVisitWithPhotos(initialQuestState, [], undefined, ['removed'])).rejects.toThrow()
    expect(transaction.abort).toHaveBeenCalledOnce()
  })
  test('does not remove an original referenced by a remaining visit', async () => {
    const { transaction, writes } = controlledTransaction()
    const state = { ...initialQuestState, visitsByApartmentId: { a: [{ id: 'v', apartmentId: 'a', questId: 'q', visitedAt: '2026-09-18T00:00:00Z', createdAt: '2026-09-18T00:00:00Z', updatedAt: '2026-09-18T00:00:00Z', pros: [], cons: [], photos: [{ id: 'p', visitId: 'v', blobKey: 'shared', createdAt: '2026-09-18T00:00:00Z' }] }] } }
    const saving = saveVisitWithPhotos(state, [], undefined, ['shared'])
    await vi.waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0].store).toBe(USER_STATE_STORE)
    transaction.oncomplete?.()
    await saving
  })
  test('removes the draft in the same transaction as the completed visit', async () => {
    const { transaction, writes } = controlledTransaction()
    const saving = saveVisitWithPhotos(initialQuestState, [], 'draft-key')
    await vi.waitFor(() => expect(writes).toHaveLength(2))
    expect(writes[1]).toEqual({ store: VISIT_DRAFT_STORE, key: 'draft-key', value: undefined })
    transaction.oncomplete?.()
    await saving
  })

  test('aborts completion if draft cleanup fails, leaving the draft eligible for retry', async () => {
    const { transaction } = controlledTransaction(VISIT_DRAFT_STORE)
    await expect(saveVisitWithPhotos(initialQuestState, [], 'draft-key')).rejects.toThrow('기록을 저장하지 못했습니다.')
    expect(transaction.abort).toHaveBeenCalledOnce()
  })
  test('queues all originals and state in one transaction and waits for completion', async () => {
    const { transaction, writes, start } = controlledTransaction()
    let resolved = false
    const blob = new Blob(['photo'], { type: 'image/jpeg' })
    const saving = saveVisitWithPhotos(initialQuestState, [{ blobKey: 'photo-one', blob }])
      .then(() => { resolved = true })
    await vi.waitFor(() => expect(writes).toHaveLength(2))
    expect(start).toHaveBeenCalledWith([USER_STATE_STORE, PHOTO_BLOB_STORE, VISIT_DRAFT_STORE], 'readwrite')
    expect(writes[0]).toEqual({ store: PHOTO_BLOB_STORE, key: 'photo-one', value: blob })
    expect(writes[1].key).toBe(USER_STATE_KEY)
    expect(resolved).toBe(false)
    transaction.oncomplete?.()
    await saving
    expect(resolved).toBe(true)
  })

  test.each([PHOTO_BLOB_STORE, USER_STATE_STORE])('aborts the entire transaction when %s put throws', async (store) => {
    const { transaction } = controlledTransaction(store)
    const saving = saveVisitWithPhotos(initialQuestState, [{ blobKey: 'photo-one', blob: new Blob(['photo']) }])
    await expect(saving).rejects.toThrow('기록을 저장하지 못했습니다.')
    expect(transaction.abort).toHaveBeenCalledOnce()
  })

  test('rejects an asynchronous storage failure and permits a later retry', async () => {
    const first = controlledTransaction()
    const saving = saveVisitWithPhotos(initialQuestState, [])
    const rejected = expect(saving).rejects.toThrow('저장 공간이 부족합니다.')
    await vi.waitFor(() => expect(first.writes).toHaveLength(1))
    first.transaction.error = new DOMException('Storage full', 'QuotaExceededError')
    first.transaction.onabort?.()
    await rejected

    const second = controlledTransaction()
    const retry = saveVisitWithPhotos(initialQuestState, [])
    await vi.waitFor(() => expect(second.writes).toHaveLength(1))
    second.transaction.oncomplete?.()
    await expect(retry).resolves.toBeUndefined()
  })
})

describe('visit completion retry guard', () => {
  const visit = {
    id: 'visit-one', questId: 'quest', apartmentId: 'apartment',
    visitedAt: '2026-09-17T00:00:00.000Z', pros: [], cons: [], photos: [],
    createdAt: '2026-09-17T00:00:00.000Z', updatedAt: '2026-09-17T00:00:00.000Z',
  }
  const state = {
    ...initialQuestState,
    setupCompleted: true,
    quest: {
      id: 'quest', searchCriteria: { areas: [] },
      evaluationPriorities: { stationAccess: 1, commuteFeel: 1, commercial: 1, school: 1, nature: 1, neighborhood: 1 } as const,
      loanAssumption: { annualInterestRate: 0.04, termYears: 30 },
      createdAt: visit.createdAt, updatedAt: visit.updatedAt,
    },
  }

  test('a repeated completion cannot append the same visit twice', () => {
    const action = { type: 'completeVisit' as const, visit }
    const saved = questReducer(state, action)
    expect(saved.visitsByApartmentId.apartment).toHaveLength(1)
    expect(questReducer(saved, action)).toBe(saved)
    expect(saved.apartmentQuestStates.apartment.stage).toBe('VISITED')
    expect(state.visitsByApartmentId).toEqual({})
  })

  test('does not apply a visit from another quest', () => {
    expect(questReducer(state, { type: 'completeVisit', visit: { ...visit, questId: 'other' } })).toBe(state)
  })
})

describe('atomic full backup restore', () => {
  test('replaces state and originals and clears drafts in one transaction, awaiting commit', async () => {
    const { transaction, writes, start } = controlledTransaction()
    let finished = false
    const blob = new Blob(['restored image'], { type: 'image/jpeg' })
    const restoring = replacePersistedAppState(initialQuestState, [{ blobKey: 'restored', blob }]).then(() => { finished = true })
    await vi.waitFor(() => expect(writes).toHaveLength(4))
    expect(start).toHaveBeenCalledWith([USER_STATE_STORE, PHOTO_BLOB_STORE, VISIT_DRAFT_STORE], 'readwrite')
    expect(writes[1]).toMatchObject({ store: PHOTO_BLOB_STORE, value: 'clear' })
    expect(writes[2]).toMatchObject({ store: PHOTO_BLOB_STORE, key: 'restored', value: blob })
    expect(writes[3]).toMatchObject({ store: VISIT_DRAFT_STORE, value: 'clear' })
    expect(finished).toBe(false)
    transaction.oncomplete?.()
    await restoring
    expect(finished).toBe(true)
  })
  test.each([USER_STATE_STORE, PHOTO_BLOB_STORE, VISIT_DRAFT_STORE])('a synchronous failure in %s aborts all replacement writes', async (store) => {
    const { transaction } = controlledTransaction(store)
    await expect(replacePersistedAppState(initialQuestState, [])).rejects.toThrow('기록을 저장하지 못했습니다.')
    expect(transaction.abort).toHaveBeenCalledOnce()
  })
})
