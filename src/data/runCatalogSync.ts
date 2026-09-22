import type { DiscoverableApartment } from '../domain/discover.ts'
import type { CommuteDestination } from '../domain/models.ts'
import { detailKey, markDistrictPrices, needsCommute, needsDetail, needsDistrictPrices } from './syncPlan.ts'

type Record = DiscoverableApartment
type Save = (records: Record[]) => Promise<void>
export async function runCatalogSync(records: Record[], targetIds: Set<string>, options: {
  signal: AbortSignal; destination?: CommuteDestination; priceDistricts?: ReadonlySet<string>;
  detail: (record: Record, save: Save) => Promise<Record | undefined>;
  prices: (records: Record[]) => Promise<Record[]>;
  commute: (record: Record, save: Save) => Promise<void>;
  save: Save;
  stage: (name: string, work: () => Promise<void>) => Promise<void>;
  progress: (text: string) => void;
}) {
  const { signal, stage, progress } = options
  const current = new Map(records.map(r => [r.apartment.id,r]))
  const targets = records.filter(r => targetIds.has(r.apartment.id))
  const districts = [...new Set(targets.map(r => r.area.sigunguCode))]
  const detailTotal = targets.filter(r => needsDetail(r)).length
  let detailDone = 0
  const commit: Save = async values => {
    signal.throwIfAborted()
    await options.save(values)
    for (const record of values) current.set(record.apartment.id,record)
    signal.throwIfAborted()
  }
  for (const district of districts) {
    signal.throwIfAborted()
    const scoped = () => [...current.values()].filter(r => r.area.sigunguCode === district && targetIds.has(r.apartment.id))
    for (const record of scoped().filter(r => needsDetail(r))) {
      await stage('상세·위치',async () => {
        progress(`미완료 상세·위치 ${++detailDone}/${detailTotal} · ${record.apartment.name}`)
        const value = await options.detail(record,commit)
        if (value) await commit([{...value,syncChecks:{...value.syncChecks,detail:{key:detailKey(value),at:new Date().toISOString()}}}])
      })
    }
    const districtRecords = [...current.values()].filter(r => r.area.sigunguCode === district)
    if ((!options.priceDistricts || options.priceDistricts.has(district)) && needsDistrictPrices(districtRecords)) {
      await stage('실거래',async () => {
        progress(`${districtRecords[0].area.sigunguName} · 실거래 갱신`)
        const enriched = await options.prices(districtRecords)
        await commit(markDistrictPrices(enriched))
      })
    }
    const commutes = scoped().filter(r => needsCommute(r,options.destination))
    for (const [index,record] of commutes.entries()) {
      await stage('통근',async () => {
        progress(`미완료 통근 ${index+1}/${commutes.length} · ${record.apartment.name}`)
        await options.commute(record,commit)
      })
    }
  }
}
