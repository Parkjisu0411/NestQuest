import { Icon } from '../../ui/Icon.tsx'

import { lazy, Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useBrowse } from '../../app/browseContext.ts'
import { useQuestDispatch, useQuestState } from '../../app/useQuest.ts'
import { classifyFilterResult, listQuestHomeMatches } from '../../domain/discover.ts'
import { formatQuestContext, type SidoAvailability } from '../../domain/questContext.ts'
import { calculateMyScore } from '../../domain/scoring.ts'
import type { QuestStage } from '../../domain/models.ts'
import {
  isStageVisible,
  STAGE_FILTER_STAGES,
  type StageFilterId,
} from '../../domain/stages.ts'
import { sortBrowseItems, preserveBrowseOrder, type BrowseSort } from '../../domain/browseSort.ts'
import { listedShortlist } from '../../domain/shortlist.ts'
import { groupedSetupRegions } from '../../mock/areas.ts'
import { useApartmentCatalog } from '../../data/useApartmentCatalog.ts'
import { LiveDataSync } from '../../ui/LiveDataSync.tsx'
import { ApartmentCard } from './ApartmentCard.tsx'
import { type QuestMapApartment } from './mapTypes.ts'
import { StageFilter } from './StageFilter.tsx'
import styles from './QuestHomeScreen.module.css'

const KakaoApartmentMap = lazy(() => import('./KakaoApartmentMap.tsx'))

const SIDO_AVAILABILITY: SidoAvailability[] = groupedSetupRegions().map((group) => ({
  sidoCode: group.sidoCode,
  label: group.sidoName,
  total: group.regions.length,
}))

export function QuestHomeScreen() {
  const apartmentCatalog = useApartmentCatalog()
  const dispatch = useQuestDispatch()
  const { quest, apartmentQuestStates, visitsByApartmentId, userEvaluations } =
    useQuestState()
  const { state: browse, setState: setBrowse, scrollTop: scrollTopRef } = useBrowse()
  const { stageFilter, showPassed, selectedId, listOpen } = browse
  const listRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (listRef.current) listRef.current.scrollTop = scrollTopRef.current
  }, [listOpen, scrollTopRef])

  function resetList() {
    setBrowse((current) => ({ ...current, listPage: 0 }))
    scrollTopRef.current = 0
    if (listRef.current) listRef.current.scrollTop = 0
  }

  const matches = useMemo(
    () =>
      quest
        ? listQuestHomeMatches(
            apartmentCatalog.list(),
            quest.searchCriteria,
            apartmentQuestStates,
          )
        : [],
    [apartmentQuestStates, quest, apartmentCatalog],
  )

  const items = useMemo(
    () =>
      matches.map((match) => {
        const apartmentId = match.apartment.id
        const visits = visitsByApartmentId[apartmentId] ?? []
        return {
          match,
          stage: apartmentQuestStates[apartmentId]?.stage ?? 'DISCOVERED',
          hasVisit: visits.length > 0,
          myScore: quest
            ? calculateMyScore({
                hasVisit: visits.length > 0,
                evaluation: userEvaluations[apartmentId],
                priorities: quest.evaluationPriorities,
              })
            : undefined,
        }
      }),
    [apartmentQuestStates, matches, quest, userEvaluations, visitsByApartmentId],
  )

  const counts = useMemo(() => countStages(items), [items])

  const sortedItems = useMemo(() => {
    const active = items.filter((item) =>
      isStageVisible(item.stage, stageFilter, false, item.hasVisit),
    )
    const passed = showPassed
      ? items.filter((item) => item.stage === 'PASSED')
      : []
    const combined = [...active, ...passed]
    return sortBrowseItems(combined, stageFilter === 'shortlist' ? 'default' : browse.sort, stageFilter, apartmentQuestStates, visitsByApartmentId)
  }, [apartmentQuestStates, items, showPassed, stageFilter, browse.sort, visitsByApartmentId])

  const [sortRevision, setSortRevision] = useState(0)
  const orderKey = JSON.stringify([quest?.searchCriteria, stageFilter, browse.sort, showPassed, apartmentQuestStates, visitsByApartmentId, sortRevision])
  const [orderSnapshot, setOrderSnapshot] = useState<{key:string; ids:string[]}>({key:'',ids:[]})
  const visibleItems = orderSnapshot.key === orderKey ? preserveBrowseOrder(sortedItems,orderSnapshot.ids) : sortedItems
  const visibleIds = visibleItems.map(item => item.match.apartment.id)
  if (orderSnapshot.key !== orderKey || visibleIds.length !== orderSnapshot.ids.length || visibleIds.some((id,index) => id !== orderSnapshot.ids[index])) {
    setOrderSnapshot({key:orderKey,ids:visibleIds})
  }

  const passedCount = items.filter((item) => item.stage === 'PASSED').length
  const shortlistCount = listedShortlist(apartmentQuestStates).length
  const pageCount = Math.max(1, Math.ceil(visibleItems.length / 50))
  const page = Math.min(browse.listPage, pageCount - 1)
  const pageItems = visibleItems.slice(page * 50, (page + 1) * 50)
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list || !list.clientHeight) return
    list.scrollTop = scrollTopRef.current
    const row = Array.from(list.querySelectorAll<HTMLElement>('[data-apartment-id]')).find(node => node.dataset.apartmentId === selectedId)
    if (row) {
      const offset = row.getBoundingClientRect().top - list.getBoundingClientRect().top
      if (offset < 0 || offset + row.offsetHeight > list.clientHeight) list.scrollTop += offset
      scrollTopRef.current = list.scrollTop
    }
  }, [page, selectedId, listOpen, scrollTopRef])

  const mapApartments = useMemo(
    (): QuestMapApartment[] =>
      visibleItems.flatMap((item) => {
        const { latitude, longitude, id, name } = item.match.apartment
        if (latitude === undefined || longitude === undefined) {
          return []
        }
        return [{ id, name, latitude, longitude, stage: item.stage }]
      }),
    [visibleItems],
  )

  function selectApartment(id: string, fromMap = false) {
    const nextPage = Math.floor(Math.max(0, visibleItems.findIndex(item => item.match.apartment.id === id)) / 50)
    if (nextPage !== browse.listPage) scrollTopRef.current = 0
    setBrowse((current) => ({ ...current, selectedId: id, listPage: nextPage }))
    const list = listRef.current
    if (fromMap && list && list.clientHeight > 0) {
      const row = Array.from(list.querySelectorAll<HTMLElement>('[data-apartment-id]'))
        .find((element) => element.dataset.apartmentId === id)
      if (row) {
        const offset = row.getBoundingClientRect().top - list.getBoundingClientRect().top
        if (offset < 0 || offset + row.offsetHeight > list.clientHeight) list.scrollTop += offset
        scrollTopRef.current = list.scrollTop
      }
    }
  }


  if (!quest) {
    return null
  }

  const context = formatQuestContext(quest.searchCriteria, SIDO_AVAILABILITY)
  const commuteDestinationName = quest.searchCriteria.commuteDestination?.name
  const selected = visibleItems.find((item) => item.match.apartment.id === selectedId)
  const filterCounts = { confirmed:0, unknown:0, retained:0 }
  const regionCodes = new Set(quest.searchCriteria.areas.map(area => area.sigunguCode))
  const regionRecords = apartmentCatalog.list().filter(record => regionCodes.has(record.area.sigunguCode))
  const coverage = {
    basic: regionRecords.filter(record => record.source?.provider === '국토교통부 공동주택 기본정보').length,
    location: regionRecords.filter(record => record.apartment.latitude !== undefined && record.apartment.longitude !== undefined).length,
    price: regionRecords.filter(record => record.unitTypes.some(unit => unit.priceEstimate)).length,
    commute: regionRecords.filter(record => record.commutes.some(item => item.destinationId === quest.searchCriteria.commuteDestination?.id)).length,
  }
  for (const item of visibleItems) {
    const record = apartmentCatalog.find(item.match.apartment.id)
    if (record) filterCounts[classifyFilterResult(record,quest.searchCriteria)]++
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.top}>
          <div><p className={styles.brand}>NESTQUEST</p><h1 className={styles.title}>내 집 찾기</h1></div>
          <Link to="/filters" className={styles.filterButton}><Icon name="filter" />필터</Link>
        </div>
        <div className={styles.conditionRow}>
          <p className={styles.context}>{context}</p>
          <details className={styles.options}>
            <summary aria-label="목록 옵션"><Icon name="more" /></summary>
            <div className={styles.optionsPanel}>
              <label><input type="checkbox" checked={quest.searchCriteria.includeUnknown !== false} onChange={event => {
                resetList()
                dispatch({ type:'updateQuest', searchCriteria:{ ...quest.searchCriteria,includeUnknown:event.target.checked } })
              }} /> 미확인 포함</label>
              <p>충족 {filterCounts.confirmed} · 확인 대기 {filterCounts.unknown} · 보관 {filterCounts.retained}</p>
              <p>정보 {coverage.basic} · 위치 {coverage.location} · 가격 {coverage.price} · 통근 {coverage.commute}</p>
              <Link to="/connections">데이터 관리</Link>
            </div>
          </details>
        </div>
        <LiveDataSync apartmentId={selectedId ?? undefined} />
      </header>

      <StageFilter value={stageFilter} counts={counts} onChange={(value) => {
        resetList()
        setBrowse((current) => ({ ...current, stageFilter: value, sort: 'default', selectedId: null }))
      }} />

      <div className={`${styles.workspace} ${listOpen ? styles.listOpen : ''}`}>
      <section className={styles.mapPanel} aria-label="단지 지도">
      <div className={styles.mapCanvas}>
      <Suspense fallback={<p role="status">지도를 준비하고 있습니다.</p>}><KakaoApartmentMap selectedAreas={quest.searchCriteria.areas} commuteDestination={quest.searchCriteria.commuteDestination} apartments={mapApartments} focusedId={selected?.match.apartment.id ?? null} onSelect={(id) => selectApartment(id, true)} /></Suspense>
      </div>
      <div className={styles.mapSummary}>
        {selected ? <>
          <div aria-live="polite"><strong>{selected.match.apartment.name}</strong>
            <p>{selected.match.area.sigunguName} · {selected.match.displayUnit ? `${selected.match.displayUnit.areaGroup}㎡` : '면적 미확인'}</p>
            {!mapApartments.some((item) => item.id === selectedId) ? <p>위치 정보가 없는 단지입니다.</p> : null}
          </div>
          <Link to={`/apartments/${selected.match.apartment.id}`} className={styles.detailLink}>상세 보기</Link>
          <button type="button" className={styles.closeSelection} aria-label="단지 선택 해제" onClick={() => setBrowse((current) => ({ ...current, selectedId: null }))}>×</button>
        </> : <p aria-live="polite">{visibleItems.length ? `지도 ${mapApartments.length} · 전체 ${visibleItems.length}` : '검색 결과 0개'}</p>}
        {mapApartments.length < visibleItems.length ? <p>위치 미확인 {visibleItems.length - mapApartments.length}</p> : null}
      </div>
      </section>

      <section className={styles.listPanel} aria-label="단지 목록">
        <button type="button" className={styles.listToggle} aria-expanded={listOpen} aria-controls="apartment-list" onClick={() => setBrowse((current) => ({ ...current, listOpen: !current.listOpen }))}>
          {listOpen ? '목록 접기' : '목록 열기'} · {visibleItems.length}개
        </button>
        <h2 className={styles.listHeading}>단지 목록 · {visibleItems.length}개</h2>
        <div className={styles.listContent} id="apartment-list" ref={listRef} onScroll={(event) => { if (event.currentTarget.clientHeight > 0) scrollTopRef.current = event.currentTarget.scrollTop }}>

      {stageFilter === 'shortlist' ? (
        <div className={styles.picksBar}>
          
          {shortlistCount > 0 ? (
            <Link to="/compare" className={styles.compareLink}>
              비교하기
            </Link>
          ) : null}
        </div>
      ) : null}

      {passedCount > 0 ? (
        <button
          type="button"
          className={styles.passedToggle}
          aria-pressed={showPassed}
          onClick={() => {
            resetList()
            setBrowse((current) => ({ ...current, showPassed: !current.showPassed, selectedId: null }))
          }}
        >
          {showPassed ? '제외한 집 숨기기' : '제외한 집 보기'}
        </button>
      ) : null}

      <div className={styles.sortBar}>
        {stageFilter === 'shortlist' ? <span>내 순서</span> : <>
          <select aria-label="단지 정렬" value={browse.sort} onChange={event => {
            resetList()
            setBrowse(current => ({...current,sort:event.target.value as BrowseSort}))
          }}>
            <option value="default">{stageFilter === 'candidate' ? '최근 관심순' : stageFilter === 'visited' ? '최근 방문순' : '통근순 (기본)'}</option>
            <option value="commute">통근순</option><option value="price">가격 낮은 순</option><option value="name">이름순</option>
          </select>
          <button type="button" aria-label="최신 데이터로 다시 정렬" title="최신 데이터로 다시 정렬" onClick={() => { resetList(); setSortRevision(value => value+1) }}><Icon name="reset" size={16} /></button>
        </>}
      </div>
      <section className={styles.list} aria-label="탐색 결과와 보관 단지">
        {visibleItems.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}><Icon name="map" size={24} /></span>
            <p role="status">{stageFilter === 'all'
              ? '조건에 맞는 아파트가 없어요'
              : '아직 담긴 아파트가 없어요'}</p>
            {stageFilter === 'all' ? <Link to="/filters" className={styles.emptyAction}><Icon name="filter" size={18} />필터 변경</Link>
              : <button type="button" className={styles.emptyAction} onClick={() => {
                resetList()
                setBrowse(current => ({ ...current, stageFilter:'all', showPassed:false, selectedId:null }))
              }}>전체 보기</button>}
          </div>
        ) : (
          pageItems.map((item) => (
            <ApartmentCard
              key={item.match.apartment.id}
              selected={selected?.match.apartment.id === item.match.apartment.id}
              onSelect={() => selectApartment(item.match.apartment.id)}
              match={item.match}
              stage={item.stage}
              myScore={item.myScore}
              commuteDestinationName={commuteDestinationName}
              shortlistRank={
                stageFilter === 'shortlist'
                  ? apartmentQuestStates[item.match.apartment.id]?.shortlistRank
                  : undefined
              }
              shortlistMemo={
                stageFilter === 'shortlist'
                  ? apartmentQuestStates[item.match.apartment.id]?.shortlistMemo
                  : undefined
              }
              onAddCandidate={() =>
                dispatch({
                  type: 'markCandidate',
                  apartmentId: item.match.apartment.id,
                })
              }
              onMoveUp={
                stageFilter === 'shortlist' &&
                (apartmentQuestStates[item.match.apartment.id]?.shortlistRank ?? 1) > 1
                  ? () =>
                      dispatch({
                        type: 'moveShortlist',
                        apartmentId: item.match.apartment.id,
                        direction: 'up',
                      })
                  : undefined
              }
              onMoveDown={
                stageFilter === 'shortlist' &&
                (apartmentQuestStates[item.match.apartment.id]?.shortlistRank ?? 0) <
                  shortlistCount
                  ? () =>
                      dispatch({
                        type: 'moveShortlist',
                        apartmentId: item.match.apartment.id,
                        direction: 'down',
                      })
                  : undefined
              }
            />
          ))
        )}
      </section>
        </div>
        {pageCount > 1 ? <nav className={styles.pagination} aria-label="단지 목록 페이지">
          <button disabled={page === 0} onClick={() => { scrollTopRef.current = 0; setBrowse(current => ({ ...current, listPage: page - 1, selectedId: null })) }}>이전</button>
          <span aria-live="polite">{page + 1} / {pageCount} · 50개씩</span>
          <button disabled={page === pageCount - 1} onClick={() => { scrollTopRef.current = 0; setBrowse(current => ({ ...current, listPage: page + 1, selectedId: null })) }}>다음</button>
        </nav> : null}
      </section>
      </div>
    </main>
  )
}

function countStages(
  stages: Array<{ stage: QuestStage; hasVisit: boolean }>,
): Record<StageFilterId, number> {
  const counts: Record<StageFilterId, number> = {
    all: 0,
    candidate: 0,
    visited: 0,
    shortlist: 0,
  }

  for (const { stage, hasVisit } of stages) {
    if (STAGE_FILTER_STAGES.all.includes(stage)) {
      counts.all += 1
    }
    if (STAGE_FILTER_STAGES.candidate.includes(stage)) {
      counts.candidate += 1
    }
    if (isStageVisible(stage, 'visited', false, hasVisit)) {
      counts.visited += 1
    }
    if (STAGE_FILTER_STAGES.shortlist.includes(stage)) {
      counts.shortlist += 1
    }
  }

  return counts
}

