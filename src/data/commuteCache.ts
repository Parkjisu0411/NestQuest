import type { DiscoverableApartment } from '../domain/discover.ts'
import type { CommuteDestination, CommuteEstimate } from '../domain/models.ts'
import { commuteQueryKey } from './commuteSession.ts'

export const COMMUTE_CACHE_DAYS = 30
export function commuteIsFresh(estimate: CommuteEstimate, now = Date.now()) {
  const age = now - Date.parse(estimate.calculatedAt)
  return Number.isFinite(age) && age >= 0 && age < COMMUTE_CACHE_DAYS * 86400000
}
export function storedCommute(record: DiscoverableApartment, destination: CommuteDestination) {
  const key = commuteQueryKey(record.apartment,destination)
  return record.commutes.filter(item => item.provider === 'Kakao' && item.queryKey === key && Date.parse(item.calculatedAt) <= Date.now()).sort((a,b)=>b.calculatedAt.localeCompare(a.calculatedAt))[0]
}
export function savedCommute(record: DiscoverableApartment, destination: CommuteDestination, now = Date.now()) {
  const key = commuteQueryKey(record.apartment, destination)
  return record.commutes.find(item => item.provider === 'Kakao' && item.queryKey === key && commuteIsFresh(item, now))
}
export function withSavedCommute(record: DiscoverableApartment, estimate: CommuteEstimate): DiscoverableApartment {
  return { ...record, commutes: [...record.commutes.filter(item => item.destinationId !== estimate.destinationId), estimate] }
}
