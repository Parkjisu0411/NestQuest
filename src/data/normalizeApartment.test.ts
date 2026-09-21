import { describe, expect, it } from 'vitest'
import { normalizeApartmentFacts } from './normalizeApartment.ts'

const input = {
  name: ' 테스트  아파트 ', address: ' 서울시  동작구 ',
  source: { provider: 'kapt', externalId: '001', fetchedAt: '2026-09-18T00:00:00Z' },
}

describe('adapter-neutral apartment normalization', () => {
  it('normalizes whitespace and counts while preserving IDs and provenance', () => {
    const result = normalizeApartmentFacts({ ...input, householdCount: '1,200', parkingCount: 0, latitude: '37.5', longitude: '126.9', approvalDate: '2024-02-29' })
    expect(result).toEqual({ ok: true, value: { source: input.source, facts: {
      name: '테스트 아파트', address: '서울시 동작구', householdCount: 1200, parkingCount: 0,
      latitude: 37.5, longitude: 126.9, approvalDate: '2024-02-29',
    } } })
  })
  it('keeps optional unknown data absent instead of substituting zero', () => {
    const result = normalizeApartmentFacts({ ...input, householdCount: '', latitude: null, longitude: ' ', approvalDate: null })
    expect(result).toEqual({ ok: true, value: { source: input.source, facts: { name: '테스트 아파트', address: '서울시 동작구' } } })
  })
  it.each([
    { latitude: 37.5 }, { latitude: 127, longitude: 37 }, { latitude: true, longitude: 127 },
    { latitude: Infinity, longitude: 127 }, { latitude: '', longitude: 127 },
  ])('quarantines invalid or partial coordinates: %j', (coordinates) => {
    expect(normalizeApartmentFacts({ ...input, ...coordinates }).ok).toBe(false)
  })
  it.each(['1,20', '-1', '1.5', '1e3', '0x10', true, NaN, Number.MAX_SAFE_INTEGER + 1])('rejects invalid counts: %s', (householdCount) => {
    expect(normalizeApartmentFacts({ ...input, householdCount }).ok).toBe(false)
  })
  it.each(['2023-02-29', '2024-04-31', '20240901'])('rejects invalid dates: %s', (approvalDate) => {
    expect(normalizeApartmentFacts({ ...input, approvalDate }).ok).toBe(false)
  })
  it.each(['2026-02-30T00:00:00Z', '2026-09-18T24:00:00Z', '2026-09-18', 'yesterday'])('rejects invalid collection timestamps: %s', (fetchedAt) => {
    expect(normalizeApartmentFacts({ ...input, source: { ...input.source, fetchedAt } }).ok).toBe(false)
  })
  it('reports fields without fabricating required data or exposing the raw record', () => {
    const result = normalizeApartmentFacts({ name: '', address: null, source: { externalId: 1 } })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.map((item) => item.field)).toEqual(['name', 'address', 'source'])
    expect(normalizeApartmentFacts(null).ok).toBe(false)
    expect(normalizeApartmentFacts([]).ok).toBe(false)
  })
  it('does not invent a source update time or an internal ID', () => {
    const result = normalizeApartmentFacts(input)
    if (!result.ok) throw new Error('expected valid fixture')
    expect(result.value.source.sourceUpdatedAt).toBeUndefined()
    expect(result.value.facts).not.toHaveProperty('id')
  })
})
