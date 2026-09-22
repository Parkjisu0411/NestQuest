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
    const projection = geoMercator().fitExtent([[22,18],[338,312]], {
      type: 'MultiPoint', coordinates: mapBundle.regions.flatMap(region => region.polygons.flatMap(polygon => polygon.flat())),
    })
    const regions = mapBundle.regions.map(region => {
      const point = projection(region.label)!
      return { ...region,
        path: region.polygons.flatMap(polygon => polygon.map(ring => ring.map((coordinate,index) => (index ? 'L' : 'M') + projection(coordinate)!.join(',')).join('') + 'Z')).join(''),
        point, x:point[0], y:point[1], width:region.name.length * 11 + 8,
        area: SEOUL_AREAS.find(area => area.sigunguCode === region.code)!,
      }
    })
    // Labels have their own collision layout; geographic boundaries remain unchanged.
    for (let pass = 0; pass < 100; pass++) {
      let moved = false
      for (let i = 0; i < regions.length; i++) for (let j = i+1; j < regions.length; j++) {
        const a = regions[i], b = regions[j]
        const overlapX = (a.width+b.width)/2 + 3 - Math.abs(a.x-b.x)
        const overlapY = 24 - Math.abs(a.y-b.y)
        if (overlapX <= 0 || overlapY <= 0) continue
        moved = true
        if (overlapX < overlapY) {
          const shift = (overlapX/2+.1) * (a.x <= b.x ? -1 : 1)
          a.x += shift; b.x -= shift
        } else {
          const shift = (overlapY/2+.1) * (a.y <= b.y ? -1 : 1)
          a.y += shift; b.y -= shift
        }
      }
      for (const region of regions) {
        region.x = Math.max(region.width/2+6,Math.min(354-region.width/2,region.x))
        region.y = Math.max(14,Math.min(316,region.y))
      }
      if (!moved) break
    }
    return regions
  }, [])
  if (!mapBundle) return <p role="status">{mapBundleMessage} 서울 전체 선택을 이용해 주세요.</p>
  return <div className={styles.wrap}>
    <svg className={styles.map} viewBox="0 0 360 330" role="group" aria-label="서울 25개 자치구 선택 지도">
      {shapes.map(region => <path key={region.code}
        className={selectedCodes.has(region.code) ? styles.region + ' ' + styles.selected : styles.region}
        d={region.path} fillRule="evenodd" role="button" tabIndex={0}
        aria-pressed={selectedCodes.has(region.code)} aria-label={region.name}
        onClick={() => onToggle(region.area)} onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onToggle(region.area) }
        }} />)}
      {shapes.filter(region => Math.hypot(region.x-region.point[0],region.y-region.point[1]) > 8).map(region =>
        <line key={region.code} className={styles.leader} x1={region.point[0]} y1={region.point[1]} x2={region.x} y2={region.y} />)}
      {shapes.map(region => <g key={region.code} className={selectedCodes.has(region.code) ? styles.labelButton + ' ' + styles.labelSelected : styles.labelButton}
        aria-hidden="true" onClick={() => onToggle(region.area)}>
        <rect x={region.x-region.width/2} y={region.y-12} width={region.width} height={24} rx={6} />
        <text className={styles.label} x={region.x} y={region.y} textAnchor="middle" dominantBaseline="central">{region.name}</text>
      </g>)}
    </svg>
  </div>
}
