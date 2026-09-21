import type { QuestAppState } from '../app/questStore.ts'
import {
  BACKUP_UNSUPPORTED_VERSION,
  BACKUP_UNREADABLE,
  BACKUP_WRONG_FORMAT,
  PersistError,
} from './errors.ts'
import { BACKUP_FORMAT, BACKUP_VERSION, type BackupVersion } from './schema.ts'
import {
  parsePersistedUserState,
  persistedToAppState,
  toPersistedUserState,
  type PersistedUserStateV1,
} from './snapshot.ts'

export interface NestQuestBackupV1 {
  format: typeof BACKUP_FORMAT
  version: BackupVersion
  exportedAt: string
  data: PersistedUserStateV1
}

export function createBackup(state: QuestAppState, exportedAt = new Date()): NestQuestBackupV1 {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: exportedAt.toISOString(),
    data: toPersistedUserState(state),
  }
}

export function serializeBackup(backup: NestQuestBackupV1): string {
  return `${JSON.stringify(backup, null, 2)}\n`
}

export function backupFilename(now = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `nestquest-backup-${year}-${month}-${day}.json`
}

export function parseBackupJson(raw: string): NestQuestBackupV1 {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new PersistError(BACKUP_UNREADABLE)
  }
  return parseBackup(parsed)
}

export function parseBackup(value: unknown): NestQuestBackupV1 {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new PersistError(BACKUP_WRONG_FORMAT)
  }

  const record = value as Record<string, unknown>
  if (record.format !== BACKUP_FORMAT) {
    throw new PersistError(BACKUP_WRONG_FORMAT)
  }
  if (typeof record.version !== 'number' || !Number.isInteger(record.version)) {
    throw new PersistError(BACKUP_UNSUPPORTED_VERSION)
  }
  if (record.version !== 1 && record.version !== BACKUP_VERSION) {
    throw new PersistError(BACKUP_UNSUPPORTED_VERSION)
  }
  if (typeof record.exportedAt !== 'string' || record.exportedAt.trim() === '') {
    throw new PersistError(BACKUP_UNREADABLE)
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: record.exportedAt,
    data: parsePersistedUserState(record.data),
  }
}

export async function restoreFromBackupText(
  raw: string,
  persist: { replace: (state: QuestAppState) => Promise<void> },
): Promise<QuestAppState> {
  const backup = parseBackupJson(raw)
  const next = persistedToAppState(backup.data)
  await persist.replace(next)
  return next
}
