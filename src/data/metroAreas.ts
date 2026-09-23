import type { QuestArea } from '../domain/models.ts'
import { districtData, legalAliases } from './metroCodeData.ts'
export const METRO_SIDOS = [{code:'11',name:'서울특별시',label:'서울'},{code:'41',name:'경기도',label:'경기'},{code:'28',name:'인천광역시',label:'인천'}]
const all=districtData.map(([code,name,active])=>({sidoCode:code.slice(0,2),sidoName:name.split(' ')[0],sigunguCode:code,sigunguName:name.split(' ').slice(1).join(' '),active}))
export const METRO_AREAS: QuestArea[] = all.filter(a=>a.active&&!all.some(b=>b.active&&b.sidoCode===a.sidoCode&&b.sigunguName.startsWith(a.sigunguName+' '))).map(({active,...area})=>{void active;return area})
export const ALL_METRO_AREAS: QuestArea[] = all.map(({active,...area})=>{void active;return area})
const changedCodes=new Map(legalAliases.map(([oldCode,,newCode])=>[oldCode,newCode] as [string,string]))
export function currentDistrictCode(legalCode:string) { return (changedCodes.get(legalCode)??legalCode).slice(0,5) }
export const addressAliases=new Map<string,string>(legalAliases.map(([,oldName,,newName])=>[oldName,newName]))
// Only recent reforms overlap the app's rolling 12-month transaction window.
// Older boundary changes stay in legal-address normalization, not extra API calls.
const recentPredecessors:Record<string,string[]>={
 '28125':['28110','28140'],'28155':['28110'],'28275':['28260'],'28290':['28260'],
 '41591':['41590'],'41593':['41590'],'41595':['41590'],'41597':['41590'],
}
export function tradeDistrictCodes(code:string) { return [code,...(recentPredecessors[code]??[])] }
export function metroArea(code:string):QuestArea|undefined { return ALL_METRO_AREAS.find(a=>a.sigunguCode===code) }
