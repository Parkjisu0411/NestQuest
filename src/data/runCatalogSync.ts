import { ApiError } from './providers/http.ts'
import type { DiscoverableApartment } from '../domain/discover.ts'
import type { CommuteDestination } from '../domain/models.ts'
import { detailKey, markDistrictPrices, needsCommute, needsDetail, needsDistrictPrices } from './syncPlan.ts'

type Record = DiscoverableApartment
type Save = (records: Record[]) => Promise<void>
export async function runCatalogSync(records: Record[], targetIds: Set<string>, options: {
  phase?: 'facts' | 'commute';
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
  const typeCoverage=new Map<string,{total:number;known:number}>()
  for(const r of targets) {
    const count=typeCoverage.get(r.area.sigunguCode) ?? {total:0,known:0}
    count.total++
    if(r.apartment.housingType && r.apartment.housingType!=='미확인') count.known++
    typeCoverage.set(r.area.sigunguCode,count)
  }
  // Newly selected districts must not wait behind a fully populated Seoul catalog.
  const districts = [...typeCoverage.keys()].sort((a,b)=>{
    const left=typeCoverage.get(a)!,right=typeCoverage.get(b)!
    return left.known/left.total-right.known/right.total
  })
  const detailTotal = targets.filter(r => needsDetail(r)).length
  let detailDone = 0
  const commit: Save = async values => {
    signal.throwIfAborted()
    await options.save(values)
    for (const record of values) current.set(record.apartment.id,record)
    signal.throwIfAborted()
  }
  const checked = async (kind: 'detail' | 'price' | 'commute', values: Record[], work: () => Promise<void>) => {
    try {
      await work()
      if (!values.some(r=>current.get(r.apartment.id)?.syncErrors?.[kind])) return
      await commit(values.map(r => {
        const latest = current.get(r.apartment.id)!
        const errors = {...latest.syncErrors}
        delete errors[kind]
        return {...latest, syncErrors:errors}
      }))
    } catch (error) {
      if (!signal.aborted && error instanceof ApiError) {
        await commit(values.map(r => {
          const latest=current.get(r.apartment.id)!
          return {...latest,syncErrors:{...latest.syncErrors,[kind]:{at:new Date().toISOString()}}}
        }))
      }
      throw error
    }
  }
  if (options.phase !== 'commute') for (const district of districts) {
    signal.throwIfAborted()
    const scoped = () => [...current.values()].filter(r => r.area.sigunguCode === district && targetIds.has(r.apartment.id))
    for (const record of scoped().filter(r => needsDetail(r))) {
      await stage('상세·위치',() => checked('detail',[record],async () => {
        progress(`미완료 상세·위치 ${++detailDone}/${detailTotal} · ${record.apartment.name}`)
        const value = await options.detail(record,commit)
        if (!value) throw new ApiError('단지 상세·위치 확인에 실패했습니다.', 'format')
        if (value) await commit([{...value,syncChecks:{...value.syncChecks,detail:{key:detailKey(value),at:new Date().toISOString()}}}])
      }))
    }
    const districtRecords = [...current.values()].filter(r => r.area.sigunguCode === district)
    if ((!options.priceDistricts || options.priceDistricts.has(district)) && needsDistrictPrices(districtRecords)) {
      await stage('실거래',() => checked('price',districtRecords,async () => {
        progress(`${districtRecords[0].area.sigunguName} · 실거래 갱신`)
        const enriched = await options.prices(districtRecords)
        await commit(markDistrictPrices(enriched))
      }))
    }
  }
  // Finish facts for every selected district before consuming any commute requests.
  if (options.phase !== 'facts') for (const district of districts) {
    signal.throwIfAborted()
    const commutes = [...current.values()].filter(r => r.area.sigunguCode === district && targetIds.has(r.apartment.id) && needsCommute(r,options.destination))
    for (const [index,record] of commutes.entries()) {
      await stage('통근',() => checked('commute',[record],async () => {
        progress(`미완료 통근 ${index+1}/${commutes.length} · ${record.apartment.name}`)
        await options.commute(record,commit)
      }))
    }
  }
}
