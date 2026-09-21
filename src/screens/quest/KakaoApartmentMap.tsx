import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { getApiSettings } from '../../data/apiSettings.ts'
import { loadKakaoMaps, type KakaoMapInstance, type KakaoMaps, type KakaoOverlay } from '../../data/map/kakaoSdk.ts'
import { clusterPoints } from '../../data/map/geometry.ts'
import { mapBundle } from '../../data/map/bundle.ts'
import type { CommuteDestination, QuestArea, QuestStage } from '../../domain/models.ts'
import { MAP_STAGE_ORDER } from '../../domain/browseSort.ts'
import { QUEST_STAGE_LABELS } from '../../domain/stages.ts'
import type { QuestMapApartment } from './mapTypes.ts'
import styles from './KakaoApartmentMap.module.css'
import { Icon } from '../../ui/Icon.tsx'

interface Props { apartments: QuestMapApartment[]; selectedAreas: QuestArea[]; commuteDestination?: CommuteDestination; focusedId: string | null; onSelect: (id: string) => void }
type Ready = { maps: KakaoMaps; map: KakaoMapInstance }
const SEOUL_OVERVIEW_LEVEL = 9

const markerStages: Record<QuestStage, { path: string; filled: boolean; className: string; label: string }> = {
  DISCOVERED: { path:'M5 21V3h10v18M15 9h4v12M3 21h18M8 7h4M8 11h4M8 15h4M9 21v-3h2v3', filled:false, className:styles.discovered, label:'일반' },
  CANDIDATE: { path:'M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z', filled:true, className:styles.candidate, label:'관심' },
  VISITED: { path:'m5 12 4 4L19 6', filled:false, className:styles.visited, label:'다녀온 집' },
  SHORTLIST: { path:'m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z', filled:true, className:styles.shortlist, label:'최종 후보' },
  PASSED: { path:'M6 6l12 12M18 6 6 18', filled:false, className:styles.passed, label:'제외한 집' },
}

function markerIcon(stage: QuestStage) {
  const appearance = markerStages[stage]
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg')
  svg.setAttribute('viewBox','0 0 24 24')
  svg.setAttribute('width','16')
  svg.setAttribute('height','16')
  svg.setAttribute('aria-hidden','true')
  svg.setAttribute('fill',appearance.filled ? 'currentColor' : 'none')
  svg.setAttribute('stroke','currentColor')
  svg.setAttribute('stroke-width','1.8')
  svg.setAttribute('stroke-linecap','round')
  svg.setAttribute('stroke-linejoin','round')
  const path = document.createElementNS('http://www.w3.org/2000/svg','path')
  path.setAttribute('d',appearance.path)
  svg.append(path)
  return svg
}

function fitRegions({ maps,map }: Ready, codes?: Set<string>) {
  const selected = mapBundle?.regions.filter(region => !codes || codes.has(region.code)) ?? []
  const regions = selected.length ? selected : mapBundle?.regions ?? []
  const coordinates = regions.flatMap(region => region.polygons.flatMap(polygon => polygon.flat()))
  const bounds = new maps.LatLngBounds()
  for (const [longitude,latitude] of coordinates.length ? coordinates : [[126.76,37.42],[127.19,37.71]]) bounds.extend(new maps.LatLng(latitude,longitude))
  map.setBounds(bounds,30,30,30,30)
}

export default function KakaoApartmentMap({ apartments, selectedAreas, commuteDestination, focusedId, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const groupPanel = useRef<HTMLElement>(null)
  const [ready, setReady] = useState<Ready | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [groupIds, setGroupIds] = useState<string[]>([])
  useEffect(() => {
    if (!groupIds.length) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !groupPanel.current?.contains(event.target)) setGroupIds([])
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      const focusInside = groupPanel.current?.contains(document.activeElement)
      setGroupIds([])
      if (focusInside) container.current?.focus({preventScroll:true})
    }
    document.addEventListener('pointerdown',outside,true)
    document.addEventListener('keydown',escape)
    return () => {
      document.removeEventListener('pointerdown',outside,true)
      document.removeEventListener('keydown',escape)
    }
  }, [groupIds.length])
  const selectApartment = useEffectEvent((id: string) => { onSelect(id); setGroupIds([]) })
  const showGroup = useEffectEvent((ids: string[]) => setGroupIds(ids))
  const areaKey = selectedAreas.map(area => area.sigunguCode).sort().join(',')
  const destinationLatitude = commuteDestination?.latitude
  const destinationLongitude = commuteDestination?.longitude
  const hasDestination = Number.isFinite(destinationLatitude) && Number.isFinite(destinationLongitude)
  // Read the latest destination even if it changes while the SDK is loading.
  const createMap = useEffectEvent((maps: KakaoMaps, element: HTMLElement) => new maps.Map(element, {
    center: new maps.LatLng(hasDestination ? destinationLatitude! : 37.5665, hasDestination ? destinationLongitude! : 126.978),
    level: SEOUL_OVERVIEW_LEVEL,
  }))

  useEffect(() => {
    let active = true
    const element = container.current!
    void loadKakaoMaps(getApiSettings().kakaoJavaScriptKey).then(maps => {
      if (!active) return
      const map = createMap(maps, element)
      setReady({ maps, map }); setError('')
    }).catch(() => {
      if (active) setError('지도 연결 실패 · 네트워크 또는 지도 설정 확인')
    })
    return () => { active = false; element.replaceChildren() }
  }, [attempt])

  useEffect(() => {
    if (!ready) return
    if (!hasDestination) fitRegions(ready,new Set(areaKey.split(',')))
  }, [ready,areaKey,hasDestination])

  useEffect(() => {
    if (!ready || !hasDestination) return
    ready.map.setLevel(SEOUL_OVERVIEW_LEVEL)
    ready.map.setCenter(new ready.maps.LatLng(destinationLatitude!,destinationLongitude!))
  }, [ready,hasDestination,destinationLatitude,destinationLongitude])

  useEffect(() => {
    if (!ready || !container.current) return
    const element = container.current, { maps,map } = ready
    let overlays: KakaoOverlay[] = []
    let frame = 0
    function clear() { overlays.forEach(overlay => overlay.setMap(null)); overlays = [] }
    function draw() {
      clear()
      const width = element.clientWidth, height = element.clientHeight
      if (!width || !height) return
      const projection = map.getProjection()
      const points = apartments.filter(item => Number.isFinite(item.latitude) && Number.isFinite(item.longitude)).map(item => ({ item, ...projection.containerPointFromCoords(new maps.LatLng(item.latitude,item.longitude)) }))
      const groups = clusterPoints(points,width,height,focusedId,42)
      for (const { items } of groups) {
        const item = items[0], selected = items.some(value => value.id === focusedId)
        const button = document.createElement('button')
        button.type = 'button'
        button.className = `${styles.marker} ${items.length > 1 ? styles.cluster : markerStages[item.stage].className} ${selected ? styles.selected : ''}`
        const stageLabels: string[] = []
        if (items.length > 1) {
          for (const stage of ['DISCOVERED','CANDIDATE','VISITED','SHORTLIST','PASSED'] as const) {
            const count = items.filter(value => value.stage === stage).length
            if (!count) continue
            const appearance = markerStages[stage]
            const cell = document.createElement('span')
            cell.className = `${styles.clusterStage} ${appearance.className}`
            cell.append(markerIcon(stage),document.createTextNode(String(count)))
            button.append(cell)
            stageLabels.push(`${appearance.label} ${count}개`)
          }
          if (stageLabels.length > 2) button.classList.add(styles.clusterGrid)
        } else button.append(markerIcon(item.stage))
        const groupLabel = `아파트 ${items.length}개 묶음 · ${stageLabels.join(', ')}`
        button.title = items.length > 1 ? groupLabel : item.name
        button.setAttribute('aria-label', items.length > 1 ? groupLabel : `${item.name} · ${QUEST_STAGE_LABELS[item.stage] || '탐색'} 지도에서 선택`)
        button.setAttribute('aria-pressed',String(selected))
        button.onclick = event => { event.stopPropagation(); if (items.length === 1) selectApartment(item.id); else showGroup(items.map(value => value.id)) }
        overlays.push(new maps.CustomOverlay({ map,position:new maps.LatLng(item.latitude,item.longitude),content:button,clickable:true,xAnchor:.5,yAnchor:.5,zIndex:selected ? 10 : 1 }))
      }
    }
    function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(draw) }
    const observer = new ResizeObserver(() => { const center = map.getCenter(); map.relayout(); map.setCenter(center); schedule() })
    observer.observe(element)
    maps.event.addListener(map,'idle',schedule)
    schedule()
    return () => { cancelAnimationFrame(frame); observer.disconnect(); maps.event.removeListener(map,'idle',schedule); clear() }
  }, [ready,apartments,focusedId])

  const focused = apartments.find(item => item.id === focusedId)
  const latitude = focused?.latitude, longitude = focused?.longitude
  useEffect(() => {
    if (!ready || latitude === undefined || longitude === undefined) return
    if (ready.map.getLevel() > 6) ready.map.setLevel(5)
    ready.map.panTo(new ready.maps.LatLng(latitude,longitude))
  }, [ready,focusedId,latitude,longitude])

  const group = apartments.filter(item => groupIds.includes(item.id)).sort((a,b) => MAP_STAGE_ORDER[a.stage] - MAP_STAGE_ORDER[b.stage])
  function resetView() {
    if (!ready) return
    if (hasDestination) {
      ready.map.setLevel(SEOUL_OVERVIEW_LEVEL)
      ready.map.setCenter(new ready.maps.LatLng(destinationLatitude!,destinationLongitude!))
    } else {
      fitRegions(ready,new Set(areaKey.split(',')))
    }
    setGroupIds([])
  }
  return <div className={styles.wrap}>
    <div className={styles.controls} role="group" aria-label="지도 조작">
      <button type="button" disabled={!ready} aria-label="지도 확대" title="지도 확대" onClick={() => ready!.map.setLevel(Math.max(1,ready!.map.getLevel()-1))}><Icon name="plus" size={18} /></button>
      <button type="button" disabled={!ready} aria-label="지도 축소" title="지도 축소" onClick={() => ready!.map.setLevel(Math.min(14,ready!.map.getLevel()+1))}><Icon name="minus" size={18} /></button>
      <button type="button" disabled={!ready} aria-label="지도 초기 위치로" title="초기 위치로" onClick={resetView}><Icon name="reset" size={18} /></button>
    </div>
    <div ref={container} className={styles.map} role="region" aria-label="카카오 아파트 지도" tabIndex={-1} />
    {!ready && !error ? <p className={styles.notice} role="status">카카오 지도를 불러오고 있습니다…</p> : null}
    {error ? <div className={styles.notice} role="alert"><p>{error}</p><button onClick={() => { setError(''); setReady(null); setAttempt(value => value+1) }}>지도 재시도</button></div> : null}
    {group.length ? <section ref={groupPanel} className={styles.group} aria-label="겹친 아파트 목록">
      <header className={styles.groupHeader}><strong>아파트 {group.length}개</strong><button type="button" className={styles.groupClose} aria-label="아파트 목록 닫기" onClick={() => { setGroupIds([]); container.current?.focus({preventScroll:true}) }}><Icon name="close" size={18} /></button></header>
      <div className={styles.groupItems}>{group.map(item => {
        const appearance = markerStages[item.stage]
        return <button type="button" key={item.id} aria-label={`${item.name} · ${appearance.label}`} onClick={() => { onSelect(item.id); setGroupIds([]) }}>
          <span className={`${styles.stageIcon} ${appearance.className}`} title={appearance.label}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill={appearance.filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={appearance.path} /></svg>
          </span>
          <span className={styles.groupName}>{item.name}</span><Icon name="chevron" size={16} />
        </button>
      })}</div>
    </section> : null}
    <p className={styles.caption}>필터에 맞는 아파트 중 위치가 확인된 {apartments.length.toLocaleString()}개 표시 · 지도는 인터넷 연결 필요</p>
  </div>
}
