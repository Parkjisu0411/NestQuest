import { createContext, useContext } from 'react'
import type { QuestAction } from './questStore.ts'
import type { PhotoBlobWrite } from '../persistence/repository.ts'
import type { UserEvaluation, Visit } from '../domain/models.ts'
import type { DiscoverableApartment } from '../domain/discover.ts'

export interface QuestPersist {
  saveCatalog: (records: DiscoverableApartment[]) => Promise<void>
  writeError: string | null
  exportBackupFile: () => Promise<void>
  exportPhotoBackup: () => Promise<void>
  restoreBackupFile: (file: Blob) => Promise<void>
  restoreBackupText: (raw: string) => Promise<void>
  completeVisit: (action: Extract<QuestAction, { type: 'completeVisit' }>, photos: PhotoBlobWrite[]) => Promise<void>
  saveEvaluation: (evaluation: UserEvaluation) => Promise<void>
  saveVisitEdit: (visit: Visit, photos: PhotoBlobWrite[]) => Promise<void>
}

export const QuestPersistContext = createContext<QuestPersist | null>(null)

export function useQuestPersist(): QuestPersist {
  const value = useContext(QuestPersistContext)
  if (value === null) {
    throw new Error('useQuestPersist must be used within QuestProvider')
  }
  return value
}
