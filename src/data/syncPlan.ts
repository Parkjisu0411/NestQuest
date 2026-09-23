import type { DiscoverableApartment } from '../domain/discover.ts'
import type { CommuteDestination } from '../domain/models.ts'
import { savedCommute } from './commuteCache.ts'
import { commuteQueryKey } from './commuteSession.ts'
import { isGeneralApartment } from './housingType.ts'
import { cacheIsFresh, DAY } from './providerCache.ts'

export function detailKey(record: DiscoverableApartment) {
  const a = record.apartment
  return JSON.stringify([a.externalId,a.name,a.address,a.roadAddress,a.housingType,record.source?.fetchedAt])
}
export function basicInfoExpired(record: DiscoverableApartment, now = Date.now()) {
  return record.source?.provider === '국토교통부 공동주택 기본정보' && !cacheIsFresh(Date.parse(record.source.fetchedAt),90*DAY,now)
}
export function needsDetail(record: DiscoverableApartment, now = Date.now()) {
  if (record.syncErrors?.detail || basicInfoExpired(record,now)) return true
  const a = record.apartment
  const basic = !!a.housingType && record.source?.provider === '국토교통부 공동주택 기본정보'
  if (basic && a.housingType !== '미확인' && (!isGeneralApartment(a) || (a.latitude !== undefined && a.longitude !== undefined))) return false
  const checked = record.syncChecks?.detail
  return !checked || checked.key !== detailKey(record) || !cacheIsFresh(Date.parse(checked.at), DAY, now)
}
export function noRouteIsFresh(record: DiscoverableApartment, destination: CommuteDestination, now = Date.now()) {
  const checked = record.syncChecks?.noRoute
  return !!checked && checked.key === commuteQueryKey(record.apartment,destination) && cacheIsFresh(Date.parse(checked.at),DAY,now)
}
export function needsCommute(record: DiscoverableApartment, destination?: CommuteDestination, now = Date.now()) {
  return !!destination && isGeneralApartment(record.apartment) && record.apartment.latitude !== undefined && record.apartment.longitude !== undefined
    && (!!record.syncErrors?.commute || (!savedCommute(record,destination,now) && !noRouteIsFresh(record,destination,now)))
}
/** Fingerprint public identities, so new/changed neighbors invalidate ambiguity checks too. */
export function districtPriceKey(records: readonly DiscoverableApartment[], now = new Date()) {
  const source = JSON.stringify(records.map(r => [r.apartment.id,r.apartment.name,r.apartment.address,r.apartment.housingType]).sort((a,b) => String(a[0]).localeCompare(String(b[0]))))
  let hash = 14695981039346656037n
  for (let i=0; i<source.length; i++) hash = BigInt.asUintN(64,(hash ^ BigInt(source.charCodeAt(i))) * 1099511628211n)
  return `price-v1:${now.getFullYear()}-${now.getMonth()+1}:${hash.toString(16)}`
}
export function needsDistrictPrices(records: readonly DiscoverableApartment[], now = Date.now()) {
  const key = districtPriceKey(records,new Date(now))
  return records.some(record => isGeneralApartment(record.apartment) && (!!record.syncErrors?.price || !record.syncChecks?.price || record.syncChecks.price.key !== key || !cacheIsFresh(Date.parse(record.syncChecks.price.at),DAY,now)))
}
export function markDistrictPrices(records: DiscoverableApartment[], now = new Date().toISOString()) {
  const key = districtPriceKey(records,new Date(now))
  return records.map(record => ({...record,syncChecks:{...record.syncChecks,price:{key,at:now}}}))
}
