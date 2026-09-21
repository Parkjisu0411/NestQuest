import { useMemo } from 'react'
import { geoMercator } from 'd3-geo'
import type { QuestArea } from '../../domain/models.ts'
import { mapBundle, mapBundleMessage } from '../../data/map/bundle.ts'
import { SEOUL_AREAS } from '../../data/seoulAreas.ts'
import styles from './AreaSelector.module.css'

interface AreaSelectorProps {
  selectedCodes: ReadonlySet<string>
  onToggle: (area: QuestArea) => void
}

export function AreaSelector({ selectedCodes, onToggle }: AreaSelectorProps) {
  const shapes = useMemo(() => {
    if (!mapBundle) return []
    const projection = geoMercator().fitExtent([[12,12],[348,368]], {
      type: 'MultiPoint', coordinates: mapBundle.regions.flatMap(region => region.polygons.flatMap(polygon => polygon.flat())),
    })
    return mapBundle.regions.map(region => ({
      ...region,
      path: region.polygons.flatMap(polygon => polygon.map(ring => ring.map((coordinate,index) => (index ? 'L' : 'M') + projection(coordinate)!.join(',')).join('') + 'Z')).join(''),
      point: projection(region.label)!,
      area: SEOUL_AREAS.find(area => area.sigunguCode === region.code)!,
    }))
  }, [])
  if (!mapBundle) return <p role="status">{mapBundleMessage} 아래 지역 목록에서 선택해 주세요.</p>
  return <div className={styles.wrap}>
    <svg className={styles.map} viewBox="0 0 360 380" role="group" aria-label="서울 25개 자치구 선택 지도">
      {shapes.map(region => <g key={region.code}>
        <path className={selectedCodes.has(region.code) ? styles.region + ' ' + styles.selected : styles.region}
          d={region.path} fillRule="evenodd" role="button" tabIndex={0}
          aria-pressed={selectedCodes.has(region.code)} aria-label={'서울특별시 ' + region.name}
          onClick={() => onToggle(region.area)} onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onToggle(region.area) }
          }} />
        <text className={styles.label} x={region.point[0]} y={region.point[1]} textAnchor="middle">{region.name}</text>
      </g>)}
    </svg>
    <p className={styles.caption}>서울 행정구역 경계 · 작은 구역은 지역 목록에서도 선택할 수 있습니다.</p>
  </div>
}
