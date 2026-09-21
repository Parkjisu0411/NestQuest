import type { DiscoverableApartment } from '../domain/discover.ts'

/** A loaded, normalized snapshot. Network loading belongs outside render/reducers. */
export interface ApartmentCatalog {
  readonly mode: 'example' | 'live'
  list(): readonly DiscoverableApartment[]
  find(apartmentId: string): DiscoverableApartment | undefined
}

export function createApartmentCatalog(
  records: readonly DiscoverableApartment[],
  mode: ApartmentCatalog['mode'],
): ApartmentCatalog {
  const snapshot = Object.freeze([...records])
  const byId = new Map<string, DiscoverableApartment>()
  for (const record of snapshot) {
    const id = record.apartment.id
    if (!id.trim() || byId.has(id)) throw new Error('단지 ID가 비어 있거나 중복됩니다.')
    byId.set(id, record)
  }
  return { mode, list: () => snapshot, find: (id) => byId.get(id) }
}
