import { basicInfoExpired } from '../data/syncPlan.ts'
import { DAY, readProviderCache, writeProviderCache } from '../data/providerCache.ts'
import { isGeneralApartment } from '../data/housingType.ts'
import { preparationReport, preparationOutcome, type PreparationOutcome } from '../data/preparation.ts'
import { mergeCatalog } from '../data/catalogSnapshot.ts'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useQuestState } from '../app/useQuest.ts'
import { useQuestPersist } from '../app/persistContext.ts'
import { getApiSettings } from '../data/apiSettings.ts'
import { fetchSidoApartments } from '../data/providers/publicData.ts'
import { attachDistrictTrades, fetchCommute, fetchDetail, fetchDistrictTrades } from '../data/providers/enrich.ts'
import { geocode } from '../data/providers/kakao.ts'
import { mapBundle } from '../data/map/bundle.ts'
import { userMessageFromUnknown } from '../persistence/repository.ts'
import { processDetailBatch } from '../data/providers/detailBatch.ts'
import { ApiError, pauseProviderRequests } from '../data/providers/http.ts'
import { hydrateCommute } from '../data/providers/hydrateCommute.ts'
import { ApiLoadingStatus } from './ApiLoadingStatus.tsx'
import { getCommuteServiceIssue, setCommuteServiceIssue } from '../data/commuteSession.ts'
import { independentProviderStages } from '../data/providers/independentProviderStages.ts'
import { autoSyncTargets } from '../data/autoSyncTargets.ts'
import { runCatalogSync } from '../data/runCatalogSync.ts'

export function LiveDataSync({ apartmentId, mapApartmentIds, onFinished, full = false }: { apartmentId?: string; mapApartmentIds?: string[]; browseScope?: string; onFinished?: (outcome:PreparationOutcome) => void; full?: boolean }) {
  const state = useQuestState()
  const persist = useQuestPersist()
  const [attempt, setAttempt] = useState(0)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [issues, setIssues] = useState<Record<string, string>>({})
  const controller = useRef<AbortController | null>(null)
  const queue = useRef(Promise.resolve())
  // Paging, sorting and visible results never cancel collection of the selected regions.
  const scopeKey = JSON.stringify([full,
    state.quest?.searchCriteria.areas.map(area => area.sigunguCode).sort(), state.quest?.searchCriteria.commuteDestination])
  const work = useEffectEvent(async (abort: AbortController) => {
    const signal = abort.signal
    const keys = getApiSettings()
    if (full) setCommuteServiceIssue(undefined)
    setIssues({})
    setBusy(true); setFailed(false); setMessage('선택 지역의 단지 목록을 확인합니다…')
    const progress = (text: string) => { if (!signal.aborted) { setBusy(true); setMessage(text) } }
    const problems: Record<string, string> = {}
    const stage = independentProviderStages(signal, (service, message) => {
      problems[service] = message
      if (!signal.aborted) setIssues({ ...problems })
    })
    try {
      let records = state.catalogSnapshot?.records ?? []
      const sidoCodes = [...new Set(state.quest?.searchCriteria.areas.map(a=>a.sidoCode) ?? ['11'])]
      for (const sidoCode of sidoCodes) {
        const cacheKey='catalog-list-checked:v2:'+sidoCode
        const listChecked=await readProviderCache(cacheKey,30*DAY,raw=>raw===true?true:undefined)
        if (full || !listChecked || !records.some(r=>r.area.sidoCode===sidoCode)) {
          progress('단지 목록 '+sidoCode+' 확인 중…')
          await stage('단지 목록 '+sidoCode,async()=>{
            const fetched=await fetchSidoApartments(keys.publicDataKey,signal,progress,sidoCode,async page=>{
              signal.throwIfAborted()
              await persist.saveCatalog(page)
              records=mergeCatalog({mode:'live',records},page).records
            })
            records=mergeCatalog({mode:'live',records},fetched).records
            signal.throwIfAborted()
            await persist.saveCatalog(records)
            await writeProviderCache(cacheKey,true)
          })
        }
      }
      const areas = new Set(state.quest?.searchCriteria.areas.map(area => area.sigunguCode))
      const targets = autoSyncTargets(records,state.apartmentQuestStates,areas,mapApartmentIds,apartmentId,true,state.quest?.searchCriteria.commuteDestination)
      const destination = state.quest?.searchCriteria.commuteDestination
      const station = mapBundle?.stations.find(item => `station:${item.id}` === destination?.id)
      const validDestination = destination && station && destination.longitude === station.coordinate[0] && destination.latitude === station.coordinate[1]
      let requested = false
      const throttle = async () => { if (requested) await pauseProviderRequests(signal); requested = true }
      const syncOptions: Parameters<typeof runCatalogSync>[2] = {
        signal, destination, stage, progress, save:persist.saveCatalog,
        priceDistricts: undefined,
        detail: async (original,save) => {
          await throttle()
          let updated = original
          let completed = false
          await processDetailBatch([original], {
            signal, refresh:basicInfoExpired(original),
            detail: record => fetchDetail(record,keys.publicDataKey,signal,async basic=>{await save([basic]);updated=basic}),
            geocode: keys.kakaoRestKey.trim() ? async address => {
              let value: Awaited<ReturnType<typeof geocode>> = null
              let checked = false
              await stage('위치',async()=>{value=await geocode(address,keys.kakaoRestKey,signal);checked=true})
              // A geocoding limit must not stop basic information for other apartments.
              if (!checked) throw new ApiError('위치 조회가 보류되었습니다. 단지 기본정보 수집은 계속합니다.','format')
              return value
            } : undefined,
            save: async values => { await save(values); updated = values[values.length-1] ?? updated },
            report: (_id,result) => { completed = result.status !== 'error' && !result.message },
            progress: () => {},
          })
          if (isGeneralApartment(updated.apartment) && updated.apartment.latitude===undefined && !keys.kakaoRestKey.trim()) throw new ApiError('위치 조회용 Kakao 키가 필요합니다. 기본정보는 저장했습니다.','format')
          return completed ? updated : undefined
        },
        prices: async values => {
          const rows = await fetchDistrictTrades(values[0].area.sigunguCode,keys.publicDataKey,signal,progress)
          signal.throwIfAborted()
          return attachDistrictTrades(values,rows,new Date().toISOString())
        },
        commute: async (record,save) => {
          if (!validDestination || !destination) throw new ApiError('공식 역 자료에서 출근역을 다시 선택해 주세요.','auth')
          if (!keys.kakaoRestKey.trim()) throw new ApiError('통근 자동 조회에 필요한 Kakao 키를 등록해 주세요.','auth')
          await throttle()
          await hydrateCommute(record,destination,signal,() => fetchCommute(record,destination,keys.kakaoRestKey,signal),{save})
        },
      }
      const currentRecords = new Map(records.map(r=>[r.apartment.id,r]))
      const save = syncOptions.save
      syncOptions.save = async values => { await save(values); for (const r of values) currentRecords.set(r.apartment.id,r) }
      // All selected-region facts run first, independently of stage, visibility or commute quota.
      const factIds=new Set(targets.map(r=>r.apartment.id))
      if(apartmentId) factIds.add(apartmentId)
      await runCatalogSync([...currentRecords.values()],factIds,{...syncOptions,phase:'facts'})
      const commuteOptions={...syncOptions,phase:'commute' as const}
      // Spend commute requests on the selected apartment and retained candidates first.
      if (apartmentId) await runCatalogSync([...currentRecords.values()],new Set([apartmentId]),commuteOptions)
      const remaining = targets.filter(r=>r.apartment.id !== apartmentId)
      const groups = full ? [remaining] : [
        remaining.filter(r=>state.apartmentQuestStates[r.apartment.id]?.stage === 'SHORTLIST'),
        remaining.filter(r=>state.apartmentQuestStates[r.apartment.id]?.stage === 'CANDIDATE'),
        remaining.filter(r=>state.apartmentQuestStates[r.apartment.id]?.stage === 'VISITED'),
        remaining.filter(r=>!['SHORTLIST','CANDIDATE','VISITED'].includes(state.apartmentQuestStates[r.apartment.id]?.stage)),
      ]
      for (const group of groups) if (group.length) await runCatalogSync([...currentRecords.values()],new Set(group.map(r=>r.apartment.id)),commuteOptions)
      setFailed(Object.keys(problems).length > 0)
      if (!signal.aborted) {
        const report = preparationReport([...currentRecords.values()],{areas:[...areas],destination})
        const outcome=preparationOutcome(report,problems)
        onFinished?.(outcome)
        setMessage(!full && outcome.complete ? '' : outcome.message)
      }
    } catch (error) {
      if (controller.current === abort) {
        const message=signal.aborted ? '조회를 중단했습니다. 저장된 자료부터 다시 준비할 수 있습니다.'
          : userMessageFromUnknown(error, '실제 자료를 가져오지 못했습니다. 완료된 자료는 유지됩니다.')
        onFinished?.({complete:false,message,issues:{...problems}})
        setFailed(true)
        setMessage(message)
      }
    } finally { if (controller.current === abort) setBusy(false) }
  })
  useEffect(() => {
    const abort = new AbortController()
    controller.current = abort
    queue.current = queue.current.then(async () => { if (!abort.signal.aborted) await work(abort) })
    return () => { if (controller.current === abort) controller.current = null; abort.abort() }
  }, [scopeKey, attempt])
  return <section className="compact-sync" aria-label="실제 자료 조회">
    {busy ? <ApiLoadingStatus message={message} onCancel={() => controller.current?.abort()} /> : null}
    {!busy && !failed && message ? <p role="status">{message}</p> : null}
    {!busy && failed ? <details><summary>일부 자료 미확인 · 재시도</summary>
      {Object.entries(issues).map(([service, reason]) => <p key={service} role="alert">{service}: {reason}</p>)}
      <p>{message}</p>
      <button onClick={() => setAttempt(value => value + 1)}>조회 계속</button>
      {getCommuteServiceIssue() ? <button onClick={() => { setCommuteServiceIssue(undefined); setAttempt(value => value + 1) }}>통근 재시도</button> : null}
      <Link to="/connections">데이터 관리</Link>
    </details> : null}
  </section>
}
