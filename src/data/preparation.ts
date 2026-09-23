import type { DiscoverableApartment } from '../domain/discover.ts'
import type { CommuteDestination } from '../domain/models.ts'
import { isGeneralApartment } from './housingType.ts'
import { detailKey, districtPriceKey, needsDetail, noRouteIsFresh } from './syncPlan.ts'
import { savedCommute } from './commuteCache.ts'
import { cacheIsFresh, DAY } from './providerCache.ts'

export type PreparationStatus = 'ready' | 'empty' | 'pending' | 'error'
export interface PreparationScope { areas: string[]; destination?: CommuteDestination }
export function preparationReport(records: DiscoverableApartment[], scope: PreparationScope, now = Date.now()) {
  const selected = records.filter(r=>scope.areas.includes(r.area.sigunguCode))
  const priceKeys = new Map([...new Set(selected.map(r=>r.area.sigunguCode))].map(code=>[code,districtPriceKey(records.filter(r=>r.area.sigunguCode===code),new Date(now))]))
  const rows = selected.map(r=>{
    const basic = r.source?.provider === '국토교통부 공동주택 기본정보' && !!r.apartment.housingType
    const general = isGeneralApartment(r.apartment)
    const located = r.apartment.latitude !== undefined && r.apartment.longitude !== undefined
    const checkedDetail = r.syncChecks?.detail
    const detailChecked = checkedDetail?.key===detailKey(r) && cacheIsFresh(Date.parse(checkedDetail.at),DAY,now)
    const detail: PreparationStatus = r.syncErrors?.detail ? 'error' : needsDetail(r,now) ? 'pending'
      : !basic || r.apartment.housingType==='미확인' || (general && !located) ? detailChecked ? 'empty' : 'pending' : 'ready'
    const pc=r.syncChecks?.price
    const price: PreparationStatus = !basic ? 'pending' : !general ? 'ready' : r.syncErrors?.price ? 'error'
      : pc && pc.key===priceKeys.get(r.area.sigunguCode) && cacheIsFresh(Date.parse(pc.at),DAY,now)
        ? r.unitTypes.some(u=>u.priceEstimate) ? 'ready' : 'empty' : 'pending'
    const commute: PreparationStatus = !basic ? 'pending' : !general || !scope.destination ? 'ready' : r.syncErrors?.commute ? 'error'
      : !located ? detail==='empty' ? 'empty' : 'pending'
      : savedCommute(r,scope.destination,now) ? 'ready' : noRouteIsFresh(r,scope.destination,now) ? 'empty' : 'pending'
    const values=[detail,price,commute]
    const status: PreparationStatus=values.includes('error')?'error':values.includes('pending')?'pending':values.includes('empty')?'empty':'ready'
    return {id:r.apartment.id,name:r.apartment.name,general,detail,price,commute,status}
  })
  const count=(status:PreparationStatus)=>rows.filter(r=>r.status===status).length
  return {stored:records.length,general:rows.filter(r=>r.general).length,emptyByStage:{detail:rows.filter(r=>r.detail==='empty').length,price:rows.filter(r=>r.price==='empty').length,commute:rows.filter(r=>r.commute==='empty').length},total:rows.length,ready:count('ready'),empty:count('empty'),pending:count('pending'),errors:count('error'),
    complete:rows.length>0 && count('pending')===0 && count('error')===0,rows}
}

export interface PreparationOutcome {
  complete: boolean
  message: string
  issues: Record<string,string>
}
export function preparationOutcome(report: ReturnType<typeof preparationReport>, issues: Record<string,string>): PreparationOutcome {
  const complete=report.complete && Object.keys(issues).length===0
  const message=Object.keys(issues).length ? '일부 조회에 실패했습니다. 아래 원인을 확인한 뒤 다시 준비해 주세요.'
    : !report.total ? '선택한 지역에 수집된 단지가 없습니다. 지역 선택과 단지 목록을 확인해 주세요.'
    : !report.complete ? '조회 종료 · 미조회 또는 오류가 남아 있습니다.'
    : report.empty ? '조회 완료 · 결과 없는 항목은 미확인 상태로 내보냅니다.' : '자료 준비 완료'
  return {complete,message,issues:{...issues}}
}