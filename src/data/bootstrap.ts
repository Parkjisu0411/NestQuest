import { z } from 'zod'
import { parseCatalogSnapshot, type CatalogSnapshot } from './catalogSnapshot.ts'
import type { DiscoverableApartment } from '../domain/discover.ts'

const header = z.object({ format:z.literal('nestquest-bootstrap'), version:z.string().min(1).max(200), exportedAt:z.iso.datetime(), catalog:z.unknown() })
export interface BootstrapData { format:'nestquest-bootstrap'; version:string; exportedAt:string; catalog:CatalogSnapshot }

/** Only public/provider fields are serialized; no quest, visits, photos, research or credentials. */
export function createBootstrap(records: DiscoverableApartment[], exportedAt = new Date().toISOString()): BootstrapData {
  const catalog = parseCatalogSnapshot({mode:'live',records:records.filter(r => r.apartment.id.startsWith('kapt:') && r.apartment.externalId).map(r => ({
    apartment:r.apartment,area:r.area,unitTypes:r.unitTypes,transactions:r.transactions,source:r.source,syncChecks:r.syncChecks,
    commutes:r.commutes.filter(c => c.provider === 'Kakao' && c.destinationId.startsWith('station:')),
  }))})
  return {format:'nestquest-bootstrap',version:exportedAt,exportedAt,catalog}
}
export function parseBootstrap(raw: unknown): BootstrapData {
  const value = header.parse(raw)
  const catalog = parseCatalogSnapshot(value.catalog)
  const clean = createBootstrap(catalog.records,value.exportedAt)
  return {...clean,version:value.version}
}
const stamp = (value?: string) => value ? Date.parse(value) || 0 : 0
const priceTime = (r: DiscoverableApartment) => Math.max(stamp(r.syncChecks?.price?.at),...r.unitTypes.map(u=>stamp(u.priceEstimate?.calculatedAt)),0)
export function mergeBootstrap(previous: CatalogSnapshot | undefined, seed: BootstrapData): CatalogSnapshot {
  if (previous?.bootstrapVersion === seed.version) return previous
  const records = new Map(previous?.records.map(r=>[r.apartment.id,r]))
  for (const incoming of seed.catalog.records) {
    const old = records.get(incoming.apartment.id)
    if (!old) { records.set(incoming.apartment.id,incoming); continue }
    const newerFacts = stamp(incoming.source?.fetchedAt) > stamp(old.source?.fetchedAt)
    // A list-only seed must never downgrade a detailed local record.
    const facts = newerFacts && (incoming.source?.provider !== '국토교통부 공동주택 단지 목록' || !old.apartment.housingType) ? incoming : old
    const prices = priceTime(incoming) > priceTime(old) ? incoming : old
    const commutes = new Map(old.commutes.map(c=>[c.queryKey ?? c.destinationId,c]))
    for (const c of incoming.commutes) {
      const key = c.queryKey ?? c.destinationId
      if (stamp(c.calculatedAt) > stamp(commutes.get(key)?.calculatedAt)) commutes.set(key,c)
    }
    records.set(old.apartment.id,{...old,apartment:facts.apartment,source:facts.source,unitTypes:prices.unitTypes,transactions:prices.transactions,commutes:[...commutes.values()],
      syncChecks:{...old.syncChecks,detail:facts.syncChecks?.detail,price:prices.syncChecks?.price}})
  }
  return {mode:'live',records:[...records.values()],bootstrapVersion:seed.version}
}
export function bootstrapSummary(seed: BootstrapData) {
  const records = seed.catalog.records
  return {total:records.length, located:records.filter(r=>r.apartment.latitude !== undefined).length,
    priced:records.filter(r=>r.unitTypes.some(u=>u.priceEstimate)).length,commutes:records.filter(r=>r.commutes.length).length,exportedAt:seed.exportedAt}
}
export async function loadBundledBootstrap(): Promise<BootstrapData | undefined> {
  try {
    const response = await fetch('/bootstrap.json',{signal:AbortSignal.timeout(3000)})
    if (!response.ok) return undefined
    const raw:unknown = await response.json()
    if (raw && typeof raw === 'object' && 'status' in raw && raw.status === 'empty') return undefined
    return parseBootstrap(raw)
  } catch { return undefined }
}
