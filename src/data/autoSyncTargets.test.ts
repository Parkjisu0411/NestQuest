import { discoverApartments } from '../domain/discover.ts'
import { commuteQueryKey } from './commuteSession.ts'
import { expect, it } from 'vitest'
import { autoSyncTargets } from './autoSyncTargets.ts'
import { mapSeoulApartment } from './providers/publicData.ts'
import { detailKey } from './syncPlan.ts'
const now = new Date().toISOString()
const row = (id:string, code:string) => mapSeoulApartment({kaptCode:id,kaptName:id,bjdCode:code+'00000',kaptAddr:'서울특별시 시험 주소'},now)
function complete(r: ReturnType<typeof row>) {
  return {...r, apartment:{...r.apartment,housingType:'아파트',latitude:37.5,longitude:126.9},source:{provider:'국토교통부 공동주택 기본정보',fetchedAt:now}}
}
it('reserves unseen Yangcheon and Yeongdeungpo targets even with a full visible page elsewhere',()=>{
  const visible=Array.from({length:60},(_,i)=>complete(row('visible'+i,'11680')))
  const hidden=['11470','11560'].flatMap(code=>Array.from({length:40},(_,i)=>row(code+i,code)))
  const targets=autoSyncTargets([...visible,...hidden],{},new Set(['11680','11470','11560']),visible.slice(0,50).map(r=>r.apartment.id))
  expect(targets).toHaveLength(50)
  expect(targets.filter(r=>r.area.sigunguCode==='11470').length).toBeGreaterThan(0)
  expect(targets.filter(r=>r.area.sigunguCode==='11560').length).toBeGreaterThan(0)
  expect(targets.filter(r=>!r.apartment.housingType)).toHaveLength(25)
})
it('moves past completed and recently checked records instead of retrying the first twenty',()=>{
  const done=Array.from({length:20},(_,i)=>complete(row('done'+i,'11560')))
  const checked=row('checked','11560')
  checked.syncChecks={detail:{key:detailKey(checked),at:now}}
  const pending=Array.from({length:30},(_,i)=>row('pending'+i,'11560'))
  const targets=autoSyncTargets([...done,checked,...pending],{},new Set(['11560']))
  expect(targets).toHaveLength(25)
  expect(targets.every(r=>r.apartment.externalId?.startsWith('pending'))).toBe(true)
})
it('spreads a new Seoul catalog across all 25 districts and honors a restricted region',()=>{
  const codes=['11110','11140','11170','11200','11215','11230','11260','11290','11305','11320','11350','11380','11410','11440','11470','11500','11530','11545','11560','11590','11620','11650','11680','11710','11740']
  const records=codes.flatMap(code=>Array.from({length:30},(_,i)=>row(code+i,code)))
  expect(new Set(autoSyncTargets(records,{},new Set(codes)).map(r=>r.area.sigunguCode)).size).toBe(25)
  expect(autoSyncTargets(records,{},new Set(['11560'])).every(r=>r.area.sigunguCode==='11560')).toBe(true)
})

it('schedules commute-missing apartments hidden by the 120-minute filter',()=>{
  const destination={id:'station:yeouido',name:'여의도',latitude:37.52,longitude:126.92}
  const records=['11470','11560'].flatMap(code=>Array.from({length:40},(_,i)=>complete(row(code+i,code))))
  const targets=autoSyncTargets(records,{},new Set(['11470','11560']),[],undefined,false,destination)
  expect(targets).toHaveLength(25)
  expect(new Set(targets.map(r=>r.area.sigunguCode))).toEqual(new Set(['11470','11560']))
})

it('includes 120 minutes, excludes 121, and admits a hidden apartment after its route is saved',()=>{
  const destination={id:'station:yeouido',name:'여의도',latitude:37.52,longitude:126.92}
  const unknown=complete(row('unknown','11560'))
  const route=(r:ReturnType<typeof row>,minutes:number)=>({...r,commutes:[{apartmentId:r.apartment.id,destinationId:destination.id,totalMinutes:minutes,route:[],provider:'Kakao' as const,calculatedAt:now,queryKey:commuteQueryKey(r.apartment,destination)}]})
  const criteria={areas:[unknown.area],commuteDestination:destination,maxCommuteMinutes:120,includeUnknown:false}
  expect(discoverApartments([unknown],criteria)).toHaveLength(0)
  expect(discoverApartments([unknown],{...criteria,includeUnknown:true})).toHaveLength(1)
  expect(discoverApartments([route(unknown,120)],criteria)).toHaveLength(1)
  expect(discoverApartments([route(unknown,121)],criteria)).toHaveLength(0)
  const done=Array.from({length:50},(_,i)=>route(complete(row('done'+i,'11560')),40))
  const targets=autoSyncTargets([...done,unknown],{},new Set(['11560']),done.map(r=>r.apartment.id),undefined,false,destination)
  expect(targets[0].apartment.id).toBe(unknown.apartment.id)
})
