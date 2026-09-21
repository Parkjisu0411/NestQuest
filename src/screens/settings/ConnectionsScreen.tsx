import { ApiKeyStatus } from '../../ui/ApiKeyStatus.tsx'
import { ApiLoadingStatus } from '../../ui/ApiLoadingStatus.tsx'
import { nextDetailBatch, processDetailBatch, type DetailAttempt } from '../../data/providers/detailBatch.ts'
import { useEffect, useRef, useState } from 'react'
import { StationPicker } from '../../ui/StationPicker.tsx'
import { mapBundle } from '../../data/map/bundle.ts'
import { Link } from 'react-router'
import { getApiSettings } from '../../data/apiSettings.ts'
import { useApartmentCatalog } from '../../data/useApartmentCatalog.ts'
import { useQuestDispatch, useQuestState } from '../../app/useQuest.ts'
import { useQuestPersist } from '../../app/persistContext.ts'
import { fetchSeoulApartments } from '../../data/providers/publicData.ts'
import { attachDistrictTrades, fetchCommute, fetchDetail, fetchDistrictTrades } from '../../data/providers/enrich.ts'
import { geocode } from '../../data/providers/kakao.ts'
import { SEOUL_AREAS } from '../../data/seoulAreas.ts'
import { commuteQueryKey, setCommuteServiceIssue, useCommuteQueries } from '../../data/commuteSession.ts'
import { hydrateCommute } from '../../data/providers/hydrateCommute.ts'
import { savedCommute } from '../../data/commuteCache.ts'
import { ApiError, pauseProviderRequests } from '../../data/providers/http.ts'
import { userMessageFromUnknown } from '../../persistence/repository.ts'
import { PageChrome } from '../../ui/PageChrome.tsx'
import styles from './SettingsScreen.module.css'
import connections from './ConnectionsScreen.module.css'
import { listQuestHomeMatches } from '../../domain/discover.ts'
import { isGeneralApartment } from '../../data/housingType.ts'
import { markDistrictPrices } from '../../data/syncPlan.ts'

export function ConnectionsScreen() {
  const keys = getApiSettings()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [district, setDistrict] = useState('11560')
  const [refreshCommutes, setRefreshCommutes] = useState(false)
  const [refreshDetails, setRefreshDetails] = useState(false)
  const [refreshTrades, setRefreshTrades] = useState(false)
  const [detailAttempts, setDetailAttempts] = useState<ReadonlyMap<string, DetailAttempt>>(new Map())
  const [commuteScope, setCommuteScope] = useState<'filtered' | 'retained'>('filtered')
  const queries = useCommuteQueries()
  const catalog = useApartmentCatalog()
  const state = useQuestState()
  const dispatch = useQuestDispatch()
  const persist = useQuestPersist()
  const controller = useRef<AbortController | null>(null)
  const saving = useRef(false)
  useEffect(() => () => controller.current?.abort(), [])
  async function run(work: (signal: AbortSignal) => Promise<void>) {
    if (saving.current) return
    saving.current = true; setBusy(true); setError(''); setMessage('조회 중입니다…')
    const abort = new AbortController(); controller.current = abort
    try { await work(abort.signal) }
    catch (reason) { setMessage(''); setError(abort.signal.aborted ? '조회를 취소했습니다. 저장된 자료는 유지됩니다.' : userMessageFromUnknown(reason, '조회 또는 저장에 실패했습니다.')) }
    finally { saving.current = false; setBusy(false); controller.current = null }
  }
  const live = (state.catalogSnapshot?.records ?? catalog.list()).filter((record) => record.apartment.id.startsWith('kapt:'))
  const districtRecords = live.filter((record) => record.area.sigunguCode === district)
  return <main className={`${styles.page} ${connections.page}`}>
    <PageChrome backTo="/settings" backLabel="설정으로" />
    <h1>데이터 관리</h1>
    
    {busy ? <ApiLoadingStatus message={message} onCancel={() => controller.current?.abort()} /> : null}
    <fieldset style={{ border: 0, padding: 0, minWidth: 0 }}>
      <details className={connections.group}><summary>API 키</summary><ApiKeyStatus settings={keys} /></details>
      <details className={connections.group}><summary>서울 단지 목록</summary>
      <p>{live.length.toLocaleString()}개 저장됨</p>
      <button disabled={busy} onClick={() => void run(async (signal) => {
        const records = await fetchSeoulApartments(keys.publicDataKey, signal, setMessage)
        signal.throwIfAborted()
        await persist.saveCatalog(records)
        setMessage(`서울 단지 ${records.length.toLocaleString()}개를 저장했습니다.`)
      })}>서울 전체 단지 가져오기</button>{' '}
      <button onClick={() => { dispatch({ type: 'updateQuest', searchCriteria: { ...state.quest!.searchCriteria, areas: SEOUL_AREAS } }); setMessage('탐색 범위를 서울 25개 구로 설정했습니다.') }}>탐색 범위 서울 전체로</button>
      </details><details className={connections.group}><summary>상세정보와 지도 위치</summary>
      <label>조회할 구 <select value={district} onChange={(event) => setDistrict(event.target.value)}>{SEOUL_AREAS.map((area) => <option key={area.sigunguCode} value={area.sigunguCode}>{area.sigunguName}</option>)}</select></label>
      <p>{districtRecords.length}개 · 20개씩 조회</p>
      <label><input type="checkbox" checked={refreshDetails} onChange={(event) => setRefreshDetails(event.target.checked)} />이미 확인한 상세정보도 갱신</label>
      <button disabled={busy || !districtRecords.length} onClick={() => void run(async (signal) => {
        const pending = nextDetailBatch(districtRecords, detailAttempts, refreshDetails, !!keys.kakaoRestKey.trim())
        const completed = await processDetailBatch(pending, {
          signal, refresh: refreshDetails,
          detail: (record) => fetchDetail(record, keys.publicDataKey, signal),
          geocode: keys.kakaoRestKey.trim() ? (address) => geocode(address, keys.kakaoRestKey, signal, refreshDetails) : undefined,
          save: persist.saveCatalog,
          report: (id, result) => setDetailAttempts((current) => new Map(current).set(id,result)),
          progress: (index, record) => setMessage(`단지 상세·위치 ${index+1}/${pending.length} · ${record.apartment.name}`),
        })
        setMessage(`${completed}개 상세정보 저장. 위치 미확인 단지는 따로 표시합니다. 다음 조회는 이번 회차에 확인하지 않은 단지부터 진행합니다.`)
      })}>상세·위치 다음 20개 확인</button>
      <button onClick={() => { setDetailAttempts(new Map()); setMessage('조회 회차를 초기화했습니다. 미확인 위치도 다시 시도할 수 있습니다.') }}>상세·위치 조회 회차 초기화</button>
      <p>이번 회차 {detailAttempts.size}개 확인 · 위치 미확인/오류 {[...detailAttempts.values()].filter((item) => item.status !== 'saved').length}개</p>
      <ul>{districtRecords.filter((record) => detailAttempts.has(record.apartment.id) && detailAttempts.get(record.apartment.id)?.status !== 'saved').map((record) => <li key={record.apartment.id}>{record.apartment.name} · {detailAttempts.get(record.apartment.id)?.message ?? '위치 미확인'}</li>)}</ul>
      </details><details className={connections.group}><summary>실거래 가격</summary>
      <p>최근 12개월 · 동일 면적 실거래 중앙값</p>
      <label><input type="checkbox" checked={refreshTrades} onChange={event => setRefreshTrades(event.target.checked)} />저장된 실거래도 새로 조회</label>
      <button disabled={busy || !districtRecords.length} onClick={() => void run(async (signal) => {
        const rows = await fetchDistrictTrades(district, keys.publicDataKey, signal, setMessage, refreshTrades)
        const records = markDistrictPrices(attachDistrictTrades(districtRecords, rows, new Date().toISOString()))
        signal.throwIfAborted(); await persist.saveCatalog(records)
        setMessage(`${rows.length}건 조회, ${records.filter((record) => record.transactions?.length).length}개 단지 연결. 미연결·중복 연결 단지는 가격 미확인으로 유지합니다.`)
      })}>선택한 구 실거래 조회</button>
      </details><details className={connections.group}><summary>출근역</summary>
      <StationPicker value={state.quest?.searchCriteria.commuteDestination} onSelect={(destination) => {
        dispatch({ type: 'updateQuest', searchCriteria: { ...state.quest!.searchCriteria, commuteDestination: destination } })
        setMessage(destination ? '출근역을 변경했습니다. 새 출근역의 통근시간은 다시 조회해 주세요.' : '출근역 지정을 해제했습니다.')
      }} />
      </details><details className={connections.group}><summary>후보 통근시간</summary>
      <p>카카오 대중교통 · 10개씩 조회</p>
      <label>통근 조회 범위 <select value={commuteScope} onChange={(event) => setCommuteScope(event.target.value as 'filtered' | 'retained')}><option value="filtered">현재 탐색 조건의 단지</option><option value="retained">관심·방문·최종 후보만</option></select></label>
      <p>저장 결과 30일 재사용 · 출근역 변경 시 재조회</p>
      <label><input type="checkbox" checked={refreshCommutes} onChange={(event) => setRefreshCommutes(event.target.checked)} />이미 조회한 후보도 다시 조회</label>
      <button disabled={busy || !state.quest?.searchCriteria.commuteDestination} onClick={() => void run(async (signal) => {
        const destination = state.quest!.searchCriteria.commuteDestination!
        const station = mapBundle?.stations.find((item) => `station:${item.id}` === destination.id)
        if (!station || station.coordinate[0] !== destination.longitude || station.coordinate[1] !== destination.latitude) throw new ApiError('공식 역 자료에서 출근역을 먼저 선택해 주세요.', 'format')
        const eligible = new Set(listQuestHomeMatches(live, { ...state.quest!.searchCriteria, maxCommuteMinutes: undefined, includeUnknown: true }, state.apartmentQuestStates).map((match) => match.apartment.id))
        const candidates = live.filter((record) => isGeneralApartment(record.apartment) && (commuteScope === 'retained' ? ['CANDIDATE','VISITED','SHORTLIST'].includes(state.apartmentQuestStates[record.apartment.id]?.stage) : eligible.has(record.apartment.id) && state.apartmentQuestStates[record.apartment.id]?.stage !== 'PASSED')
          && record.apartment.latitude !== undefined && (refreshCommutes || (!savedCommute(record, destination) && !['no-route'].includes(queries.get(commuteQueryKey(record.apartment, destination))?.status ?? '')))).slice(0,10)
        setCommuteServiceIssue(undefined)
        let completed = 0
        for (let index=0; index<candidates.length; index++) {
          if (index) await pauseProviderRequests(signal)
          signal.throwIfAborted()
          setMessage(`후보 통근 ${index+1}/${candidates.length} · ${candidates[index].apartment.name}`)
          const estimate = await hydrateCommute(candidates[index], destination, signal, () => fetchCommute(candidates[index], destination, keys.kakaoRestKey, signal), { save: persist.saveCatalog, refresh: refreshCommutes })
          if (estimate) completed++
        }
        setMessage(`${completed}개 후보 통근 조회 완료. 나머지는 경로 미확인이며 0분으로 처리하지 않습니다.`)
      })}>후보 통근 다음 10개 조회</button>
      <ul>{live.flatMap((record) => {
        const destination = state.quest?.searchCriteria.commuteDestination
        const result = destination ? queries.get(commuteQueryKey(record.apartment, destination)) : undefined
        const saved = destination ? savedCommute(record, destination) : undefined
        if (saved) return <li key={record.apartment.id}>{record.apartment.name} · {Math.round(saved.totalMinutes)}분 · {saved.calculatedAt.slice(0,10)} 저장</li>
        return result ? <li key={record.apartment.id}>{record.apartment.name} · {result.status === 'success' ? (result.estimate ? `${Math.round(result.estimate.totalMinutes)}분` : '미확인') : result.status === 'loading' ? '조회 중' : result.message}</li> : []
      })}</ul>
      </details><p>대중교통 정보 제공: Kakao · 아파트 정보 제공: 국토교통부 / 공공데이터포털</p>
    </fieldset>
    {!busy && (message || error) ? <div className={connections.notice}>
      {message ? <p role="status">{message}</p> : null}{error ? <p role="alert">{error}</p> : null}
      <button onClick={() => { setMessage(''); setError('') }}>안내 닫기</button>
    </div> : null}
    <p><Link to="/">지도와 목록으로</Link></p>
  </main>
}
