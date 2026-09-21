import { describe, expect, it } from 'vitest'
import { createApartmentCatalog } from './apartmentCatalog.ts'
import { MOCK_APARTMENTS } from '../mock/apartments.ts'

describe('apartment catalog boundary', () => {
  it('rejects duplicate IDs rather than mapping saved visits to an arbitrary record', () => {
    expect(() => createApartmentCatalog([MOCK_APARTMENTS[0], MOCK_APARTMENTS[0]], 'live')).toThrow()
  })
  it('rejects empty IDs', () => {
    const record = MOCK_APARTMENTS[0]
    expect(() => createApartmentCatalog([{ ...record, apartment: { ...record.apartment, id: ' ' } }], 'live')).toThrow()
  })
  it('uses one stable list snapshot and does not absorb later source-array additions', () => {
    const records = [MOCK_APARTMENTS[0]]
    const catalog = createApartmentCatalog(records, 'example')
    records.push(MOCK_APARTMENTS[1])
    expect(catalog.list()).toHaveLength(1)
    expect(catalog.list()).toBe(catalog.list())
    expect(catalog.find(records[0].apartment.id)).toBe(catalog.list()[0])
    expect(catalog.find(records[1].apartment.id)).toBeUndefined()
  })
})
