export class PersistError extends Error {
  readonly userMessage: string

  constructor(userMessage: string, cause?: unknown) {
    super(userMessage, cause === undefined ? undefined : { cause })
    this.name = 'PersistError'
    this.userMessage = userMessage
  }
}

export const PERSIST_WRITE_ERROR = '기록을 저장하지 못했습니다. 이 화면의 내용은 유지됩니다.'
export const PERSIST_READ_ERROR = '저장된 기록을 읽지 못했습니다.'

export const BACKUP_UNREADABLE = '백업 파일을 읽을 수 없습니다.'
export const BACKUP_WRONG_FORMAT = 'NestQuest 백업 파일이 아닙니다.'
export const BACKUP_UNSUPPORTED_VERSION = '지원하지 않는 백업 버전입니다.'
