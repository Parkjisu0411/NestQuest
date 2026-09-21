import type { DiscoverableApartment } from '../../domain/discover.ts'
import type { CommuteDestination, CommuteEstimate } from '../../domain/models.ts'
import { commuteQueryKey, getCommuteQueries, setCommuteQuery, getCommuteServiceIssue, setCommuteServiceIssue } from '../commuteSession.ts'
import { ApiError } from './http.ts'
import { commuteIsFresh, savedCommute, withSavedCommute } from '../commuteCache.ts'
import { noRouteIsFresh } from '../syncPlan.ts'
import { cacheIsFresh, DAY } from '../providerCache.ts'

/** Reuse persisted routes for 30 days and confirmed no-route results for one day. */
export async function hydrateCommute(record: DiscoverableApartment, destination: CommuteDestination, signal: AbortSignal,
  fetch: () => Promise<CommuteEstimate>, options?: { save: (records: DiscoverableApartment[]) => Promise<void>; refresh?: boolean }) {
  signal.throwIfAborted()
  if (record.apartment.latitude === undefined || record.apartment.longitude === undefined) return
  const key = commuteQueryKey(record.apartment, destination)
  const saved = savedCommute(record, destination)
  if (!options?.refresh && saved) return saved
  if (!options?.refresh && noRouteIsFresh(record,destination)) return
  const cached = getCommuteQueries().get(key)
  if (!options?.refresh && cached?.status === 'success' && cached.estimate && commuteIsFresh(cached.estimate)) {
    if (options) await options.save([withSavedCommute(record, cached.estimate)])
    return cached.estimate
  }
  if (!options?.refresh && cached?.status === 'no-route' && cacheIsFresh(Date.parse(cached.queriedAt),DAY)) return
  const issue = getCommuteServiceIssue()
  if (issue) throw new ApiError(issue.message, issue.kind)
  setCommuteQuery(key, { status: 'loading', queriedAt: new Date().toISOString() })
  try {
    const estimate = { ...await fetch(), queryKey: key }
    signal.throwIfAborted()
    if (options) await options.save([withSavedCommute(record, estimate)])
    signal.throwIfAborted()
    setCommuteQuery(key, { status: 'success', estimate, queriedAt: estimate.calculatedAt })
    return estimate
  } catch (error) {
    const noRoute = error instanceof ApiError && error.kind === 'no-route'
    if (noRoute && !signal.aborted && options) {
      await options.save([{...record,syncChecks:{...record.syncChecks,noRoute:{key,at:new Date().toISOString()}}}])
    }
    if (!signal.aborted && error instanceof ApiError && (error.kind === 'limit' || error.kind === 'auth')) {
      setCommuteServiceIssue({ kind: error.kind, message: error.userMessage })
    }
    setCommuteQuery(key, { status: noRoute ? 'no-route' : error instanceof ApiError && error.kind === 'limit' ? 'limit' : 'error',
      message: signal.aborted ? '조회 중단' : noRoute ? '대중교통 경로 미확인' : error instanceof ApiError ? error.userMessage : '통근 조회를 완료하지 못했습니다.', queriedAt: new Date().toISOString() })
    if (!noRoute || signal.aborted) throw error
  }
}
