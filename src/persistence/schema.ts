export const NESTQUEST_DB_NAME = 'nestquest'
export const NESTQUEST_DB_VERSION = 3
export const PROVIDER_CACHE_STORE = 'providerCache'

export const USER_STATE_STORE = 'userState'
export const PHOTO_BLOB_STORE = 'photoBlobs'
export const VISIT_DRAFT_STORE = 'visitDrafts'
export const USER_STATE_KEY = 'active'

export const PERSISTENCE_SCHEMA_VERSION = 2

export const BACKUP_FORMAT = 'nestquest-backup'
export const BACKUP_VERSION = 2

export type PersistenceSchemaVersion = typeof PERSISTENCE_SCHEMA_VERSION
export type BackupVersion = 1 | typeof BACKUP_VERSION
