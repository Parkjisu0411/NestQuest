import { VISIT_TYPE_LABELS, type VisitType } from './models.ts'

export function formatVisitWhen(
  visitedAt: string,
  visitType?: VisitType,
): string {
  const date = new Date(visitedAt)
  if (Number.isNaN(date.getTime())) {
    return visitedAt
  }

  const stamp = `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`
  return visitType ? `${stamp} · ${VISIT_TYPE_LABELS[visitType]}` : stamp
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatVisitClock(visitedAt: string): string {
  const date = new Date(visitedAt)
  return Number.isNaN(date.getTime()) ? '' : `${pad(date.getHours())}:${pad(date.getMinutes())}`
}
