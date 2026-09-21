import { describe, expect, it } from 'vitest'
import { createApartmentIdentityIndex } from './apartmentIdentity.ts'

const link = { provider: 'kapt', externalId: '001', apartmentId: 'saved-apartment', evidence: 'verified source code' }

describe('external apartment identity', () => {
  it('preserves an existing internal ID across providers and reconstruction', () => {
    const index = createApartmentIdentityIndex(['saved-apartment'], [link])
      .withLink({ ...link, provider: 'transaction', externalId: 'other-code' })
    const restored = createApartmentIdentityIndex(['saved-apartment'], JSON.parse(JSON.stringify(index.links())))
    expect(restored.resolve(link)).toBe('saved-apartment')
    expect(restored.resolve({ provider: 'transaction', externalId: 'other-code' })).toBe('saved-apartment')
  })
  it('isolates providers, case, leading zeros and delimiter-like values', () => {
    const index = createApartmentIdentityIndex(['a', 'b'], [
      { ...link, provider: 'a:b', externalId: 'c', apartmentId: 'a' },
      { ...link, provider: 'a', externalId: 'b:c', apartmentId: 'b' },
      { ...link, apartmentId: 'a' },
    ])
    expect(index.resolve({ provider: 'a:b', externalId: 'c' })).toBe('a')
    expect(index.resolve({ provider: 'a', externalId: 'b:c' })).toBe('b')
    expect(index.resolve({ provider: 'kapt', externalId: '1' })).toBeUndefined()
    expect(index.resolve({ provider: 'KAPT', externalId: '001' })).toBeUndefined()
  })
  it('rejects conflicting mappings without altering the old index', () => {
    const index = createApartmentIdentityIndex(['saved-apartment', 'other'], [link])
    expect(() => index.withLink({ ...link, apartmentId: 'other' })).toThrow()
    expect(index.resolve(link)).toBe('saved-apartment')
    expect(index.withLink(link).links()).toHaveLength(1)
  })
  it('rejects unknown targets, missing evidence and duplicate internal IDs', () => {
    expect(() => createApartmentIdentityIndex([], [link])).toThrow()
    expect(() => createApartmentIdentityIndex(['saved-apartment'], [{ ...link, evidence: '' }])).toThrow()
    expect(() => createApartmentIdentityIndex(['a', 'a'])).toThrow()
    expect(() => createApartmentIdentityIndex([' a '])).toThrow()
  })
  it('does not link a new source automatically, and snapshots mutable inputs', () => {
    const ids = ['saved-apartment']
    const links = [{ ...link }]
    const index = createApartmentIdentityIndex(ids, links)
    ids.push('other')
    links[0].apartmentId = 'other'
    expect(index.resolve({ provider: 'new-source', externalId: '001' })).toBeUndefined()
    expect(index.resolve(link)).toBe('saved-apartment')
    expect(() => index.withLink({ ...link, externalId: '002', apartmentId: 'other' })).toThrow()
  })
})
