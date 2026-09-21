import { useSyncExternalStore } from 'react'
import type { Apartment, CommuteDestination, CommuteEstimate } from '../domain/models.ts'

export interface CommuteQuery { status: 'loading' | 'success' | 'no-route' | 'limit' | 'error'; estimate?: CommuteEstimate; message?: string; queriedAt: string }
let queries: ReadonlyMap<string, CommuteQuery> = new Map()
let serviceIssue: { kind: 'auth' | 'limit' | 'network'; message: string } | undefined
export function getCommuteServiceIssue() { return serviceIssue }
export function setCommuteServiceIssue(value: typeof serviceIssue) {
  serviceIssue = value
  queries = new Map(queries)
  listeners.forEach(listener => listener())
}
const listeners = new Set<() => void>()
export function commuteQueryKey(apartment: Apartment, destination: CommuteDestination) {
  return JSON.stringify(['Kakao', apartment.id, apartment.longitude, apartment.latitude, destination.id, destination.longitude, destination.latitude, 'urban-transit'])
}
export function setCommuteQuery(key: string, value: CommuteQuery) { queries = new Map(queries).set(key, value); listeners.forEach((listener) => listener()) }
const snapshot = () => queries
export const getCommuteQueries = snapshot
function subscribe(callback: () => void) { listeners.add(callback); return () => { listeners.delete(callback) } }
export function useCommuteQueries() { return useSyncExternalStore(subscribe, snapshot, snapshot) }
