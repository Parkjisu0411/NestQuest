import { expect, test } from 'vitest'
import { initialQuestState, type QuestAppState } from '../app/questStore.ts'
import { createPhotoBackup, readBackupFile } from './photoBackup.ts'
import { createBackup, serializeBackup } from './backup.ts'

const now = '2026-09-18T00:00:00.000Z'
const state: QuestAppState = { ...initialQuestState, setupCompleted: true,
  quest: { id: 'q', searchCriteria: { areas: [{ sidoCode: '11', sidoName: '서울특별시', sigunguCode: '11560', sigunguName: '영등포구' }] }, evaluationPriorities: { stationAccess: 1, commuteFeel: 1, commercial: 1, school: 1, nature: 1, neighborhood: 1 }, loanAssumption: { annualInterestRate: 0.04, termYears: 30 }, createdAt: now, updatedAt: now },
  visitsByApartmentId: { apartment: [{ id: 'v', questId: 'q', apartmentId: 'apartment', visitedAt: now, createdAt: now, updatedAt: now, pros: ['좋음'], cons: [], memo: '한글 메모',
    photos: [{ id: 'p', visitId: 'v', blobKey: 'photo:p', createdAt: now }],
    observations: { noise: { status: 'checked', note: '기록', photoIds: ['p'] } },
  }] },
}
const photo = new Blob([new Uint8Array([0, 255, 127, 23, 0, 91])], { type: 'image/jpeg' })

test('full backup preserves binary bytes, MIME, visit IDs and photo associations', async () => {
  const blob = await createPhotoBackup(state, async () => photo)
  const restored = await readBackupFile(blob)
  expect(restored.includesPhotos).toBe(true)
  expect(restored.state).toEqual(state)
  expect(restored.photos[0].blobKey).toBe('photo:p')
  expect(restored.photos[0].blob.type).toBe('image/jpeg')
  expect(await restored.photos[0].blob.arrayBuffer()).toEqual(await photo.arrayBuffer())
})
test('existing JSON backups restore as records-only', async () => {
  const restored = await readBackupFile(new Blob([serializeBackup(createBackup(state))]))
  expect(restored.includesPhotos).toBe(false)
  expect(restored.photos).toEqual([])
  expect(restored.state).toEqual(state)
})
test('missing originals fail rather than silently exporting an incomplete archive', async () => {
  await expect(createPhotoBackup(state, async () => undefined)).rejects.toThrow('원본이 없는')
})
test('record-only projects can still make full archives', async () => {
  const empty = { ...state, visitsByApartmentId: {} }
  expect((await readBackupFile(await createPhotoBackup(empty, async () => undefined))).photos).toEqual([])
})
test('changed image bytes, truncation and trailing payload are rejected', async () => {
  const archive = await createPhotoBackup(state, async () => photo)
  const bytes = new Uint8Array(await archive.arrayBuffer())
  bytes[bytes.length - 1] ^= 1
  await expect(readBackupFile(new Blob([bytes]))).rejects.toThrow('손상')
  await expect(readBackupFile(archive.slice(0, archive.size - 1))).rejects.toThrow('손상')
  await expect(readBackupFile(new Blob([archive, 'extra']))).rejects.toThrow('손상')
})
test.each(['wrong-key', 'negative-size', 'duplicate-entry', 'wrong-version'])('rejects malformed manifest %s', async (change) => {
  const archive = await createPhotoBackup(state, async () => photo)
  const bytes = new Uint8Array(await archive.arrayBuffer())
  const length = new DataView(bytes.buffer).getUint32(11)
  const manifest = JSON.parse(new TextDecoder().decode(bytes.slice(15, 15 + length)))
  if (change === 'wrong-key') manifest.photos[0].blobKey = 'other'
  if (change === 'negative-size') manifest.photos[0].size = -1
  if (change === 'duplicate-entry') manifest.photos.push(manifest.photos[0])
  if (change === 'wrong-version') manifest.backup.version = 99
  const json = new TextEncoder().encode(JSON.stringify(manifest))
  const header = bytes.slice(0, 15)
  new DataView(header.buffer).setUint32(11, json.length)
  await expect(readBackupFile(new Blob([header, json, photo]))).rejects.toThrow()
})

