export function toLocalVisitTime(value: string): string {
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

/** A minute-precision input must not truncate an unchanged saved timestamp. */
export function editedVisitTime(original: string, local: string): string {
  if (local === toLocalVisitTime(original)) return original
  const date = new Date(local)
  if (!local || Number.isNaN(date.getTime())) throw new Error('방문 시각을 확인해 주세요.')
  return date.toISOString()
}
