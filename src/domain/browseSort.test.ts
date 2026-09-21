import { describe, expect, it } from 'vitest'
import { preserveBrowseOrder, sortBrowseItems, type SortableApartment } from './browseSort.ts'
import type { QuestState, Visit } from './models.ts'

function item(id: string, minutes?: number): SortableApartment {
  return { stage:'DISCOVERED', match:{ apartment:{id,name:id,address:'시험 주소',createdAt:'2026-01-01',updatedAt:'2026-01-01'}, area:{sidoCode:'11',sidoName:'서울',sigunguCode:'test',sigunguName:'시험'}, eligibleUnitTypes:[],unknownFields:[],nearBudget:false,
    ...(minutes === undefined ? {} : {commute:{apartmentId:id,destinationId:'station',provider:'test',calculatedAt:'2026-01-01',totalMinutes:minutes,route:[]}}) } }
}
const ids = (rows: SortableApartment[]) => rows.map(row => row.match.apartment.id)
describe('browse sorting', () => {
  it('uses displayed whole minutes, then names; unknown commutes and passed records come last', () => {
    expect(ids(sortBrowseItems([item('나',10.1),item('가',10.4),item('미확인'),{...item('제외',1),stage:'PASSED'}],'commute','all',{},{}))).toEqual(['가','나','미확인','제외'])
  })
  it('keeps existing order during hydration and appends arrivals before excluded records', () => {
    const rows=sortBrowseItems([item('나',1),item('가',20),item('신규',2),{...item('제외'),stage:'PASSED'}],'commute','all',{}, {})
    expect(ids(preserveBrowseOrder(rows,['가','나','제외']))).toEqual(['가','나','신규','제외'])
    expect(ids(rows)).toEqual(['나','신규','가','제외'])
  })
  it('uses original interest date rather than later edits, and falls back for legacy records', () => {
    const state=(id:string,candidateAt?:string): QuestState => ({questId:'q',apartmentId:id,stage:'CANDIDATE',targetUnitTypeIds:[],candidateAt,updatedAt:'2026-09-21'})
    expect(ids(sortBrowseItems([item('가'),item('나')],'default','candidate',{가:state('가','2026-09-01'),나:state('나')},{}))).toEqual(['나','가'])
  })
  it('sorts visits by actual latest visit and shortlist by manual rank', () => {
    const visits={나:[{visitedAt:'2026-09-20'},{visitedAt:'2026-09-01'}] as Visit[],가:[{visitedAt:'2026-09-19'}] as Visit[]}
    expect(ids(sortBrowseItems([item('가'),item('나')],'default','visited',{},visits))).toEqual(['나','가'])
    const state=(rank:number):QuestState=>({questId:'q',apartmentId:String(rank),stage:'SHORTLIST',shortlistRank:rank,targetUnitTypeIds:[],updatedAt:'2026-09-21'})
    expect(ids(sortBrowseItems([item('가'),item('나')],'default','shortlist',{가:state(2),나:state(1)},{}))).toEqual(['나','가'])
  })
})
