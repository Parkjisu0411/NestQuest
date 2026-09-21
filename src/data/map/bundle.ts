import raw from './map-bundle.json'
import { readyMapSchema, type MapBundle, type MapStation } from './schema.ts'
import type { CommuteDestination } from '../../domain/models.ts'

const result = readyMapSchema.safeParse(raw)
export const mapBundle: MapBundle | null = result.success ? result.data : null
export const mapBundleMessage = raw.status === 'pending' ? '지역 지도와 지하철 자료를 준비 중입니다. 단지는 목록에서 확인할 수 있습니다.' : '지도 자료를 읽지 못했습니다. 단지는 목록에서 확인할 수 있습니다.'
export function stationDestination(station: MapStation): CommuteDestination {
  return { id: `station:${station.id}`, name: station.name, address: station.address, longitude: station.coordinate[0], latitude: station.coordinate[1] }
}
export function searchStations(stations: readonly MapStation[], query: string) {
  const normalized = query.normalize('NFKC').replace(/\s/g, '').toLocaleLowerCase('ko')
  return stations.filter((station) => `${station.name}${station.lines.join(' ')}`.normalize('NFKC').replace(/\s/g, '').toLocaleLowerCase('ko').includes(normalized))
    .sort((a,b) => a.name.localeCompare(b.name, 'ko') || a.id.localeCompare(b.id))
}
