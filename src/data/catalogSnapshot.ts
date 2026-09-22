import { z } from 'zod'
import type { DiscoverableApartment } from '../domain/discover.ts'
import { PersistError } from '../persistence/errors.ts'

const id = z.string().trim().min(1).max(300)
const text = z.string().trim().min(1).max(2000)
const amount = z.number().finite().nonnegative()
const date = z.iso.date()
const time = z.iso.datetime()
const area = z.object({ sidoCode: id, sidoName: text, sigunguCode: id, sigunguName: text })
const price = z.object({ apartmentId: id, unitTypeId: id, estimatedPrice: amount, lowPrice: amount, highPrice: amount,
  latestPrice: amount, transactionCount: z.number().int().nonnegative(), periodMonths: z.union([z.literal(6), z.literal(12)]),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']), calculatedAt: time })
const recordSchema = z.object({
  apartment: z.object({ id, externalId: id.optional(), housingType: text.optional(), name: text, address: text, roadAddress: text.optional(),
    latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional(),
    approvalDate: date.optional(), householdCount: amount.int().optional(), buildingCount: amount.int().optional(),
    parkingCount: amount.int().optional(), heatingType: text.optional(), createdAt: time, updatedAt: time,
    managementFee: z.object({ monthlyAverage: amount.optional(), perSquareMeterAverage: amount.optional(),
      periodMonths: amount.int().optional(), calculatedAt: time.optional() }).optional(),
  }), area,
  unitTypes: z.array(z.object({ id, apartmentId: id, areaGroup: amount, exclusiveAreas: z.array(z.number().positive()).min(1), priceEstimate: price.optional() })),
  commutes: z.array(z.object({ queryKey: z.string().max(1000).optional(), apartmentId: id, destinationId: id, totalMinutes: amount, transferCount: amount.int().optional(), walkingMinutes: amount.optional(),
    route: z.array(z.object({ type: z.enum(['WALK','SUBWAY','BUS','OTHER']), durationMinutes: amount, from: text.optional(), to: text.optional(), lineName: text.optional() })), provider: text, calculatedAt: time })),
  transactions: z.array(z.object({ id, apartmentId: id, unitTypeId: id.optional(), exclusiveArea: z.number().positive(), floor: z.number().int().optional(), price: amount, contractDate: date, canceled: z.boolean() })).optional(),
  research: z.array(z.object({ id, questId: id, apartmentId: id, category: z.enum(['COMMERCIAL','SCHOOL_DISTRICT']), summary: text,
    sources: z.array(z.object({ title: text.optional(), url: z.url().optional(), publisher: text.optional() })), researchedAt: time })).optional(),
  source: z.object({ provider: text, fetchedAt: time }).optional(),
  syncChecks: z.object({
    detail:z.object({key:z.string().max(10000),at:time}).optional(),
    price:z.object({key:z.string().max(10000),at:time}).optional(),
    noRoute:z.object({key:z.string().max(10000),at:time}).optional(),
  }).optional(),
})

export interface CatalogSnapshot {
  bootstrapVersion?: string
  mode: 'live'
  records: DiscoverableApartment[]
}

export function parseCatalogSnapshot(raw: unknown): CatalogSnapshot {
  const result = z.object({ bootstrapVersion: z.string().max(200).optional(), mode: z.literal('live'), records: z.array(recordSchema).max(100_000) }).safeParse(raw)
  if (!result.success) throw new PersistError('단지 자료 형식이 올바르지 않습니다. 기존 자료를 유지합니다.')
  const ids = new Set<string>()
  for (const record of result.data.records) {
    const key = record.apartment.id
    if (ids.has(key)) throw new PersistError('단지 ID가 중복됩니다.')
    ids.add(key)
    if ((record.apartment.latitude === undefined) !== (record.apartment.longitude === undefined)) throw new PersistError('단지 좌표가 불완전합니다.')
    const unitIds = new Set(record.unitTypes.map((unit) => unit.id))
    if (unitIds.size !== record.unitTypes.length) throw new PersistError('평형 ID가 중복됩니다.')
    for (const unit of record.unitTypes) {
      if (unit.apartmentId !== key || (unit.priceEstimate && (unit.priceEstimate.apartmentId !== key || unit.priceEstimate.unitTypeId !== unit.id || unit.priceEstimate.lowPrice > unit.priceEstimate.highPrice))) throw new PersistError('평형과 가격의 단지 연결이 올바르지 않습니다.')
    }
    if ([...record.commutes, ...(record.transactions ?? []), ...(record.research ?? [])].some((item) => item.apartmentId !== key)) throw new PersistError('단지 참고 자료의 연결이 올바르지 않습니다.')
  }
  return result.data
}

/** Merge successful fetches; missing results never delete saved candidates. */
export function mergeCatalog(previous: CatalogSnapshot | undefined, incoming: DiscoverableApartment[]): CatalogSnapshot {
  const valid = parseCatalogSnapshot({ mode: 'live', records: incoming })
  const records = new Map(previous?.records.map((record) => [record.apartment.id, record]))
  for (const record of valid.records) {
    // ODsay results remain session-only until storage rights are confirmed.
    record.commutes = record.commutes.filter((commute) => commute.provider !== 'ODsay')
    const old = records.get(record.apartment.id)
    const commutes = new Map((old?.commutes ?? []).filter(item => item.provider !== 'ODsay').map(item => [item.queryKey ?? item.destinationId, item]))
    for (const item of record.commutes) {
      const key = item.queryKey ?? item.destinationId
      const previous = commutes.get(key)
      if (!previous || previous.calculatedAt <= item.calculatedAt) commutes.set(key, item)
    }
    const merged = old && record.source?.provider === '국토교통부 공동주택 단지 목록'
      ? { ...old, ...record, apartment: { ...record.apartment, ...old.apartment }, source: old.source ?? record.source, unitTypes: old.unitTypes, commutes: old.commutes, transactions: old.transactions, syncChecks:old.syncChecks }
      : record
    records.set(record.apartment.id, { ...merged, commutes: [...commutes.values()] })
  }
  return { mode: 'live', records: [...records.values()], ...(previous?.bootstrapVersion ? {bootstrapVersion:previous.bootstrapVersion} : {}) }
}
