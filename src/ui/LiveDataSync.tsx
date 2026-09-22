import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useQuestState } from '../app/useQuest.ts'
import { useQuestPersist } from '../app/persistContext.ts'
import { getApiSettings } from '../data/apiSettings.ts'
import { fetchSeoulApartments } from '../data/providers/publicData.ts'
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

export function LiveDataSync({ apartmentId, mapApartmentIds, full = false }: { apartmentId?: string; mapApartmentIds?: string[]; full?: boolean }) {
  const state = useQuestState()
  const persist = useQuestPersist()
  const [attempt, setAttempt] = useState(0)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [issues, setIssues] = useState<Record<string, string>>({})
  const controller = useRef<AbortController | null>(null)
  const queue = useRef(Promise.resolve())
  // Scope depends on user choices, never on the result order changed by hydration.
  const scopeKey = JSON.stringify([full, Object.entries(state.apartmentQuestStates).filter(([,s])=>['SHORTLIST','CANDIDATE','VISITED'].includes(s.stage)).map(([id,s])=>[id,s.stage]), apartmentId, mapApartmentIds ? [...mapApartmentIds].sort() : null,
    state.quest?.searchCriteria.areas.map(area => area.sigunguCode).sort(), state.quest?.searchCriteria.commuteDestination])
  const work = useEffectEvent(async (abort: AbortController) => {
    const signal = abort.signal
    const keys = getApiSettings()
    setIssues({})
    setBusy(false); setFailed(false); setMessage('')
    const progress = (text: string) => { if (!signal.aborted) { setBusy(true); setMessage(text) } }
    const problems: Record<string, string> = {}
    const stage = independentProviderStages(signal, (service, message) => {
      problems[service] = message
      if (!signal.aborted) setIssues({ ...problems })
    })
    try {
      let records = state.catalogSnapshot?.records ?? []
      if (!records.some(record => record.apartment.externalId)) {
        records = await fetchSeoulApartments(keys.publicDataKey, signal, progress)
        signal.throwIfAborted(); await persist.saveCatalog(records)
      }
      const areas = new Set(state.quest?.searchCriteria.areas.map(area => area.sigunguCode))
      const targets = autoSyncTargets(records,state.apartmentQuestStates,areas,mapApartmentIds,apartmentId,full)
      const destination = state.quest?.searchCriteria.commuteDestination
      const station = mapBundle?.stations.find(item => `station:${item.id}` === destination?.id)
      const validDestination = destination && station && destination.longitude === station.coordinate[0] && destination.latitude === station.coordinate[1]
      let requested = false
      const throttle = async () => { if (requested) await pauseProviderRequests(signal); requested = true }
      const syncOptions: Parameters<typeof runCatalogSync>[2] = {
        signal, destination, stage, progress, save:persist.saveCatalog,
        priceDistricts: full ? undefined : new Set([...new Set(targets.map(r=>r.area.sigunguCode))].slice(0,3)),
        detail: async (original,save) => {
          await throttle()
          let updated = original
          let completed = false
          await processDetailBatch([original], {
            signal, refresh:false,
            detail: record => fetchDetail(record,keys.publicDataKey,signal),
            geocode: keys.kakaoRestKey.trim() ? address => geocode(address,keys.kakaoRestKey,signal) : undefined,
            save: async values => { await save(values); updated = values[values.length-1] ?? updated },
            report: (_id,result) => { completed = result.status !== 'error' },
            progress: () => {},
          })
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
      // Process the selected apartment end-to-end before background candidates.
      if (apartmentId) await runCatalogSync([...currentRecords.values()],new Set([apartmentId]),syncOptions)
      const remaining = targets.filter(r=>r.apartment.id !== apartmentId)
      const groups = full ? [remaining] : [
        remaining.filter(r=>state.apartmentQuestStates[r.apartment.id]?.stage === 'SHORTLIST'),
        remaining.filter(r=>state.apartmentQuestStates[r.apartment.id]?.stage === 'CANDIDATE'),
        remaining.filter(r=>state.apartmentQuestStates[r.apartment.id]?.stage === 'VISITED'),
        remaining.filter(r=>!['SHORTLIST','CANDIDATE','VISITED'].includes(state.apartmentQuestStates[r.apartment.id]?.stage)),
      ]
      for (const group of groups) if (group.length) await runCatalogSync([...currentRecords.values()],new Set(group.map(r=>r.apartment.id)),syncOptions)
      setFailed(Object.keys(problems).length > 0)
      if (!signal.aborted) setMessage('자료 확인 완료')
    } catch (error) {
      if (controller.current === abort) {
        setFailed(true)
        setMessage(signal.aborted ? '조회를 중단했습니다. 완료된 자료는 유지됩니다. 조회 계속을 누르면 이어서 확인합니다.'
          : userMessageFromUnknown(error, '실제 자료를 가져오지 못했습니다. 완료된 자료는 유지됩니다.'))
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
    {full && !busy && !failed && message ? <p role="status">{message}</p> : null}
    {!busy && failed ? <details><summary>일부 자료 미확인 · 재시도</summary>
      {Object.entries(issues).map(([service, reason]) => <p key={service} role="alert">{service}: {reason}</p>)}
      <p>{message}</p>
      <button onClick={() => setAttempt(value => value + 1)}>조회 계속</button>
      {getCommuteServiceIssue() ? <button onClick={() => { setCommuteServiceIssue(undefined); setAttempt(value => value + 1) }}>통근 재시도</button> : null}
      <Link to="/connections">데이터 관리</Link>
    </details> : null}
  </section>
}
