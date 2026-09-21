import type { Apartment } from '../domain/models.ts'
import { normalizeExternalId, type ExternalApartmentId } from './apartmentIdentity.ts'

export interface ApartmentSource extends ExternalApartmentId {
  fetchedAt: string
  sourceUpdatedAt?: string
}

export interface NormalizedApartmentFacts {
  source: ApartmentSource
  facts: Pick<Apartment, 'name' | 'address' | 'latitude' | 'longitude' | 'approvalDate' | 'householdCount' | 'buildingCount' | 'parkingCount' | 'heatingType'>
}

export type ApartmentNormalizationResult =
  | { ok: true; value: NormalizedApartmentFacts }
  | { ok: false; issues: Array<{ field: string; message: string }> }

function missing(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function timestamp(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
    && validDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value))
    && Number(value.slice(11, 13)) < 24 && Number(value.slice(14, 16)) < 60 && Number(value.slice(17, 19)) < 60
}

/** Adapter-neutral input contract, NOT a parser for any vendor's raw response.
 * Adapters map dates to YYYY-MM-DD, timestamps to UTC ISO, and coordinates to WGS84.
 * Invalid records are quarantined as a whole; missing optional facts remain absent.
 */
export function normalizeApartmentFacts(input: unknown): ApartmentNormalizationResult {
  const issues: Array<{ field: string; message: string }> = []
  const issue = (field: string, message: string) => { issues.push({ field, message }) }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, issues: [{ field: 'record', message: '단지 객체가 필요합니다.' }] }
  }
  const raw = input as Record<string, unknown>
  const text = (field: string, optional = false): string | undefined => {
    const value = raw[field]
    if (optional && missing(value)) return undefined
    if (typeof value !== 'string' || !value.trim()) {
      issue(field, '비어 있지 않은 문자열이 필요합니다.'); return undefined
    }
    return value.trim().replace(/\s+/g, ' ')
  }
  const name = text('name')
  const address = text('address')
  const heatingType = text('heatingType', true)
  let source: ApartmentSource | undefined
  if (!raw.source || typeof raw.source !== 'object' || Array.isArray(raw.source)) {
    issue('source', '출처가 필요합니다.')
  } else {
    const src = raw.source as Record<string, unknown>
    try {
      const external = normalizeExternalId({ provider: src.provider as string, externalId: src.externalId as string })
      if (!timestamp(src.fetchedAt) || (!missing(src.sourceUpdatedAt) && !timestamp(src.sourceUpdatedAt))) {
        issue('source', '출처 시각은 유효한 UTC ISO 형식이어야 합니다.')
      } else {
        source = { ...external, fetchedAt: src.fetchedAt, ...(timestamp(src.sourceUpdatedAt) ? { sourceUpdatedAt: src.sourceUpdatedAt } : {}) }
      }
    } catch { issue('source', '제공자와 외부 단지 ID가 필요합니다.') }
  }
  const facts: NormalizedApartmentFacts['facts'] = { name: name ?? '', address: address ?? '' }
  if (heatingType !== undefined) facts.heatingType = heatingType
  for (const field of ['householdCount', 'buildingCount', 'parkingCount'] as const) {
    const value = raw[field]
    if (missing(value)) continue
    const numeric = typeof value === 'number' ? value
      : typeof value === 'string' && /^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(value.trim()) ? Number(value.trim().replaceAll(',', '')) : NaN
    if (!Number.isSafeInteger(numeric) || numeric < 0) issue(field, '0 이상의 정수가 필요합니다.')
    else facts[field] = numeric
  }
  if (!missing(raw.approvalDate)) {
    if (typeof raw.approvalDate !== 'string' || !validDate(raw.approvalDate.trim())) issue('approvalDate', '유효한 YYYY-MM-DD 날짜가 필요합니다.')
    else facts.approvalDate = raw.approvalDate.trim()
  }
  if (!missing(raw.latitude) || !missing(raw.longitude)) {
    for (const field of ['latitude', 'longitude'] as const) {
      const value = raw[field]
      const numeric = typeof value === 'number' ? value
        : typeof value === 'string' && /^[+-]?\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value.trim()) : NaN
      const limit = field === 'latitude' ? 90 : 180
      if (!Number.isFinite(numeric) || Math.abs(numeric) > limit) issue(field, 'WGS84 위도·경도를 모두 제공해야 합니다.')
      else facts[field] = numeric
    }
  }
  return issues.length || !source ? { ok: false, issues } : { ok: true, value: { source, facts } }
}
