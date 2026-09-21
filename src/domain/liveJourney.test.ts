import { expect, it } from 'vitest'
import { initialQuestState, questReducer } from '../app/questStore.ts'
import { mapSeoulApartment } from '../data/providers/publicData.ts'
import { attachDistrictTrades, parseTradeRows } from '../data/providers/enrich.ts'
import { mergeCatalog } from '../data/catalogSnapshot.ts'
import { createPhotoBackup, readBackupFile } from '../persistence/photoBackup.ts'
import { createBackup, serializeBackup } from '../persistence/backup.ts'
import { listQuestHomeMatches } from './discover.ts'
import { calculateMyScore } from './scoring.ts'
import { transactionsForUnit } from './unitTransactions.ts'
import type { Quest, Visit } from './models.ts'

it('round-trips a live-format candidate, filtered prices, visit edit, evaluation and linked photo through a full backup',async()=>{
  const now='2026-09-21T01:00:00.000Z'
  const record=mapSeoulApartment({kaptCode:'SYNTHETIC',kaptName:'합성단지',kaptAddr:'서울특별시 마포구 공덕동 1 합성단지',bjdCode:'1144010200'},now)
  const rows=parseTradeRows({items:{item:[{aptSeq:'11440-test',aptNm:'합성단지',umdNm:'공덕동',jibun:'1',dealYear:'2026',dealMonth:'9',dealDay:'1',excluUseAr:'84.9',floor:'5',dealAmount:'90,000'}]}},'11440')
  const [enriched]=attachDistrictTrades([record],rows,now)
  const quest:Quest={id:'q',searchCriteria:{areas:[record.area],availableCash:1000000000,expectedLoanLimit:0,minExclusiveArea:80},evaluationPriorities:{stationAccess:2,commuteFeel:1,commercial:0,school:0,nature:0,neighborhood:0},loanAssumption:{annualInterestRate:.04,termYears:30},createdAt:now,updatedAt:now}
  let state=questReducer(initialQuestState,{type:'completeSetup',quest})
  state={...state,catalogSnapshot:mergeCatalog(undefined,[enriched])}
  const id=record.apartment.id
  expect(listQuestHomeMatches([enriched],quest.searchCriteria,{})).toHaveLength(1)
  state=questReducer(state,{type:'addToShortlist',apartmentId:id})
  expect(state.apartmentQuestStates[id].stage).toBe('SHORTLIST')
  expect(state.visitsByApartmentId[id]).toBeUndefined()
  const visit:Visit={id:'v',apartmentId:id,questId:'q',visitedAt:now,createdAt:now,updatedAt:now,pros:['동선'],cons:[],memo:'원본',photos:[{id:'p',visitId:'v',blobKey:'photo:p',createdAt:now}],observations:{stationWalk:{status:'checked',note:'직접 확인',photoIds:['p']}}}
  state=questReducer(state,{type:'completeVisit',visit,evaluation:{apartmentId:id,questId:'q',ratings:{stationAccess:5,commuteFeel:2,commercial:null,school:null,nature:null,neighborhood:null},adjustments:[],updatedAt:now}})
  state=questReducer(state,{type:'updateVisit',visit:{...visit,memo:'수정 후'}})
  // Narrowing criteria does not erase retained candidates or their records.
  state=questReducer(state,{type:'updateQuest',searchCriteria:{...quest.searchCriteria,availableCash:100000000}})
  expect(listQuestHomeMatches([enriched],state.quest!.searchCriteria,state.apartmentQuestStates)).toHaveLength(1)
  const photo=new Blob(['synthetic image bytes'],{type:'image/png'})
  const archive=await createPhotoBackup(state,async key=>key==='photo:p'?photo:undefined)
  const restored=await readBackupFile(archive)
  expect(restored.state).toEqual(state)
  expect(await restored.photos[0].blob.text()).toBe(await photo.text())
  expect(restored.state.visitsByApartmentId[id][0].observations?.stationWalk?.photoIds).toEqual(['p'])
  expect(calculateMyScore({hasVisit:true,evaluation:restored.state.userEvaluations[id],priorities:quest.evaluationPriorities})).toBe(4)
  expect(transactionsForUnit(restored.state.catalogSnapshot!.records[0].transactions!,enriched.unitTypes[0])).toHaveLength(1)
  const recordsOnly=await readBackupFile(new Blob([serializeBackup(createBackup(state))]))
  expect(recordsOnly.includesPhotos).toBe(false)
  expect(recordsOnly.state).toEqual(state)
})
