export interface ExternalApartmentId {
  provider: string
  externalId: string
}

export interface ApartmentIdentityLink extends ExternalApartmentId {
  apartmentId: string
  /** Evidence recorded by the adapter or a reviewed mapping, never a name match. */
  evidence: string
}

export interface ApartmentIdentityIndex {
  resolve(external: ExternalApartmentId): string | undefined
  links(): readonly Readonly<ApartmentIdentityLink>[]
  withLink(link: ApartmentIdentityLink): ApartmentIdentityIndex
}

function required(value: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('단지 식별 값이 비어 있습니다.')
  return value.trim()
}

export function normalizeExternalId(value: ExternalApartmentId): ExternalApartmentId {
  return { provider: required(value.provider), externalId: required(value.externalId) }
}

function key(value: ExternalApartmentId): string {
  const normalized = normalizeExternalId(value)
  return JSON.stringify([normalized.provider, normalized.externalId])
}

/** Rebuild from saved links; no random IDs or implicit merging during lookup. */
export function createApartmentIdentityIndex(
  apartmentIds: readonly string[],
  links: readonly ApartmentIdentityLink[] = [],
): ApartmentIdentityIndex {
  const ids = [...apartmentIds]
  const known = new Set(ids)
  if (known.size !== apartmentIds.length || apartmentIds.some((id) => required(id) !== id)) {
    throw new Error('내부 단지 ID가 중복되거나 정규화되지 않았습니다.')
  }
  const index = new Map<string, ApartmentIdentityLink>()
  for (const link of links) {
    const normalized = { ...normalizeExternalId(link), apartmentId: required(link.apartmentId), evidence: required(link.evidence) }
    if (!known.has(normalized.apartmentId)) throw new Error('연결 대상 단지가 없습니다.')
    const sourceKey = key(normalized)
    const previous = index.get(sourceKey)
    if (previous && previous.apartmentId !== normalized.apartmentId) {
      throw new Error('외부 단지 ID가 서로 다른 내부 단지에 연결되어 있습니다.')
    }
    if (!previous) index.set(sourceKey, Object.freeze(normalized))
  }
  const snapshot = Object.freeze([...index.values()])
  return {
    resolve: (external: ExternalApartmentId): string | undefined => index.get(key(external))?.apartmentId,
    links: (): readonly Readonly<ApartmentIdentityLink>[] => snapshot,
    /** Returns a new validated index; the previous index remains usable on failure. */
    withLink: (link: ApartmentIdentityLink) => createApartmentIdentityIndex(ids, [...snapshot, link]),
  }
}
