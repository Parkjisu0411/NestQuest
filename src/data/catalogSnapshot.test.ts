import { describe, expect, it } from 'vitest'
import { mergeCatalog, parseCatalogSnapshot } from './catalogSnapshot.ts'
import { initialQuestState } from '../app/questStore.ts'
import { createBackup, parseBackupJson, serializeBackup } from '../persistence/backup.ts'
import { persistedToAppState } from '../persistence/snapshot.ts'
import { catalogForState } from './apartments.ts'
import type { DiscoverableApartment } from '../domain/discover.ts'
import { SEOUL_AREAS } from './seoulAreas.ts'

export const sampleRecord: DiscoverableApartment = {
  apartment: { id: 'kapt:A001', externalId: 'A001', name: '테스트단지', address: '서울특별시 영등포구 여의도동 1', createdAt: '2026-09-18T00:00:00.000Z', updatedAt: '2026-09-18T00:00:00.000Z' },
  area: SEOUL_AREAS.find((area) => area.sigunguCode === '11560')!, unitTypes: [], commutes: [],
}
describe('persisted apartment catalog', () => {
  it('round-trips live apartment facts independently of the bundled example catalog', () => {
    const state = { ...initialQuestState, catalogSnapshot: parseCatalogSnapshot({ mode: 'live', records: [sampleRecord] }) }
    const restored = persistedToAppState(parseBackupJson(serializeBackup(createBackup(state))).data)
    expect(catalogForState(restored).find('kapt:A001')).toEqual(sampleRecord)
    expect(catalogForState(restored).list()).toHaveLength(1)
  })
  it('keeps old v1 backups readable and writes new v2 backups', () => {
    const backup = createBackup(initialQuestState)
    expect(backup.version).toBe(2)
    expect(parseBackupJson(JSON.stringify({ ...backup, version: 1, data: { ...backup.data, persistenceSchemaVersion: 1 } })).data.setupCompleted).toBe(false)
  })
  it('retains prior regions and enrichments during list refresh', () => {
    const old = { ...sampleRecord, apartment: { ...sampleRecord.apartment, householdCount: 100, address: '서울특별시 영등포구 여의도동 1' } }
    const first = mergeCatalog(undefined, [old])
    const refreshed = mergeCatalog(first, [{ ...sampleRecord, apartment: { ...sampleRecord.apartment, address: '서울특별시 영등포구 여의도동' }, source: { provider: '국토교통부 공동주택 단지 목록', fetchedAt: sampleRecord.apartment.updatedAt } }])
    expect(refreshed.records[0].apartment.householdCount).toBe(100)
    expect(refreshed.records[0].apartment.address).toBe(old.apartment.address)
    expect(mergeCatalog(first, []).records).toEqual(first.records)
  })
  it('rejects duplicate IDs and cross-apartment unit relationships', () => {
    expect(() => parseCatalogSnapshot({ mode: 'live', records: [sampleRecord, sampleRecord] })).toThrow()
    expect(() => parseCatalogSnapshot({ mode: 'live', records: [{ ...sampleRecord, unitTypes: [{ id: 'unit', apartmentId: 'other', areaGroup: 84, exclusiveAreas: [84] }] }] })).toThrow()
  })
  it('excludes session-only ODsay results from catalog persistence', () => {
    const snapshot = mergeCatalog(undefined, [{ ...sampleRecord, commutes: [{ apartmentId: sampleRecord.apartment.id, destinationId: 'work', provider: 'ODsay', calculatedAt: sampleRecord.apartment.updatedAt, totalMinutes: 25, route: [] }] }])
    expect(snapshot.records[0].commutes).toEqual([])
  })
  it('rejects partial coordinates and impossible dates without mutating previous data', () => {
    const previous = mergeCatalog(undefined, [sampleRecord])
    expect(() => mergeCatalog(previous, [{ ...sampleRecord, apartment: { ...sampleRecord.apartment, latitude: 37 } }])).toThrow()
    expect(() => mergeCatalog(previous, [{ ...sampleRecord, apartment: { ...sampleRecord.apartment, approvalDate: '2026-02-30' } }])).toThrow()
    expect(previous.records[0]).toEqual(sampleRecord)
  })
})
