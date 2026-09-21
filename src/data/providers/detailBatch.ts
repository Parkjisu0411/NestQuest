import type { DiscoverableApartment } from '../../domain/discover.ts'
import { ApiError } from './http.ts'
import { geocodeApartment } from './geocodeApartment.ts'

export interface DetailAttempt { status: 'saved' | 'missing-position' | 'error'; message?: string }
export function nextDetailBatch(records: DiscoverableApartment[], attempted: ReadonlyMap<string, DetailAttempt>, refresh: boolean, hasGeocoder: boolean) {
  return records.filter((record) => !attempted.has(record.apartment.id) && (refresh || !record.apartment.housingType || record.source?.provider !== '국토교통부 공동주택 기본정보' || (hasGeocoder && record.apartment.latitude === undefined))).slice(0,20)
}
export async function processDetailBatch(records: DiscoverableApartment[], options: {
  signal: AbortSignal; refresh: boolean;
  detail: (record: DiscoverableApartment) => Promise<DiscoverableApartment>;
  geocode?: (address: string) => Promise<{ latitude: number; longitude: number } | null>;
  save: (records: DiscoverableApartment[]) => Promise<void>;
  report: (id: string, result: DetailAttempt) => void;
  progress: (index: number, record: DiscoverableApartment) => void;
}) {
  let completed = 0
  for (const [index, original] of records.entries()) {
    options.signal.throwIfAborted()
    options.progress(index, original)
    let record: DiscoverableApartment
    try {
      record = options.refresh || !original.apartment.housingType || original.source?.provider !== '국토교통부 공동주택 기본정보' ? await options.detail(original) : original
    } catch (error) {
      if (options.signal.aborted || (error instanceof ApiError && ['auth','limit','network'].includes(error.kind))) throw error
      options.report(original.apartment.id, { status:'error', message:'단지 상세정보를 확인하지 못했습니다.' }); continue
    }
    // Save valid basic facts before a missing/ambiguous geocode; storage failures stop the batch.
    options.signal.throwIfAborted()
    await options.save([record])
    let deferredError: unknown
    if (options.geocode && (options.refresh || record.apartment.latitude === undefined)) {
      try {
        const coordinate = await geocodeApartment(record.apartment, options.geocode)
        options.signal.throwIfAborted()
        if (coordinate) record = { ...record, apartment:{ ...record.apartment,...coordinate } }
      } catch (error) {
        if (options.signal.aborted) throw error
        deferredError=error
      }
      options.signal.throwIfAborted()
      if (!deferredError) await options.save([record])
    }
    if (deferredError instanceof ApiError && ['auth','limit','network'].includes(deferredError.kind)) throw deferredError
    options.report(record.apartment.id, { status: deferredError || record.apartment.latitude === undefined ? 'missing-position':'saved', ...(deferredError ? { message:'상세정보 저장 완료 · 위치 확인 실패' }: {}) })
    completed++
  }
  return completed
}
