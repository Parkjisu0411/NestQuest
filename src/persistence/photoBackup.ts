import { PersistError } from './errors.ts'
import type { QuestAppState } from '../app/questStore.ts'
import { createBackup, parseBackup, parseBackupJson } from './backup.ts'
import { collectPhotoBlobKeys, persistedToAppState } from './snapshot.ts'

const MAGIC = new TextEncoder().encode('NESTQUEST1\n')
const MAX_SIZE = 200 * 1024 * 1024
const MAX_MANIFEST = 32 * 1024 * 1024
interface PhotoEntry { blobKey: string; type: string; size: number; sha256: string }
export interface BackupContents { state: QuestAppState; photos: { blobKey: string; blob: Blob }[]; includesPhotos: boolean }
async function digest(blob: Blob) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Binary archive: signature, manifest length, validated JSON, then unchanged image bytes. */
export async function createPhotoBackup(state: QuestAppState, readPhoto: (key: string) => Promise<Blob | undefined>): Promise<Blob> {
  const backup = createBackup(state)
  const entries: PhotoEntry[] = []
  const blobs: Blob[] = []
  let total = 0
  for (const blobKey of collectPhotoBlobKeys(backup.data)) {
    const blob = await readPhoto(blobKey)
    if (!blob) throw new PersistError('원본이 없는 사진이 있어 전체 백업을 만들 수 없습니다. 기록만 JSON으로 백업할 수 있습니다.')
    total += blob.size
    if (total > MAX_SIZE) throw new PersistError('사진 포함 백업은 현재 200MB까지 지원합니다.')
    if (!blob.type.startsWith('image/')) throw new PersistError('사진 형식을 확인할 수 없습니다.')
    entries.push({ blobKey, type: blob.type, size: blob.size, sha256: await digest(blob) })
    blobs.push(blob)
  }
  const manifest = new TextEncoder().encode(JSON.stringify({ backup, photos: entries }))
  if (manifest.byteLength > MAX_MANIFEST) throw new PersistError('백업 기록 크기가 너무 큽니다.')
  const length = new Uint8Array(4)
  new DataView(length.buffer).setUint32(0, manifest.byteLength)
  const result = new Blob([MAGIC, length, manifest, ...blobs], { type: 'application/octet-stream' })
  if (result.size > MAX_SIZE) throw new PersistError('사진 포함 백업은 현재 200MB까지 지원합니다.')
  return result
}

export async function readBackupFile(file: Blob): Promise<BackupContents> {
  if (file.size > MAX_SIZE) throw new PersistError('200MB 이하의 백업 파일을 선택해 주세요.')
  const prefix = new Uint8Array(await file.slice(0, MAGIC.length).arrayBuffer())
  if (!MAGIC.every((byte, index) => prefix[index] === byte)) {
    const backup = parseBackupJson(await file.text())
    return { state: persistedToAppState(backup.data), photos: [], includesPhotos: false }
  }
  const invalid = () => new PersistError('백업이 손상되었거나 사진 정보가 일치하지 않습니다.')
  if (file.size < MAGIC.length + 4) throw invalid()
  const length = new DataView(await file.slice(MAGIC.length, MAGIC.length + 4).arrayBuffer()).getUint32(0)
  let offset = MAGIC.length + 4 + length
  if (length > MAX_MANIFEST || offset > file.size) throw invalid()
  let manifest
  try { manifest = JSON.parse(await file.slice(MAGIC.length + 4, offset).text()) } catch { throw invalid() }
  if (!manifest || !Array.isArray(manifest.photos)) throw invalid()
  const backup = parseBackup(manifest.backup)
  const keys = new Set(collectPhotoBlobKeys(backup.data))
  const photos: BackupContents['photos'] = []
  if (manifest.photos.length !== keys.size) throw invalid()
  for (const entry of manifest.photos) {
    if (!entry || typeof entry.blobKey !== 'string' || !keys.delete(entry.blobKey) ||
      typeof entry.type !== 'string' || !entry.type.startsWith('image/') ||
      !Number.isSafeInteger(entry.size) || entry.size < 0 || offset + entry.size > file.size ||
      typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw invalid()
    const blob = file.slice(offset, offset + entry.size, entry.type)
    if (await digest(blob) !== entry.sha256) throw invalid()
    photos.push({ blobKey: entry.blobKey, blob })
    offset += entry.size
  }
  if (offset !== file.size || keys.size) throw invalid()
  return { state: persistedToAppState(backup.data), photos, includesPhotos: true }
}
