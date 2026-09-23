import { useEffect, useMemo, useRef, useState } from 'react'
import { geoMercator } from 'd3-geo'
import { select } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom'
import type { QuestArea } from '../../domain/models.ts'
import metroMap from '../../data/map/metro-regions.json'
import { METRO_AREAS, METRO_SIDOS } from '../../data/metroAreas.ts'
import styles from './AreaSelector.module.css'

interface AreaSelectorProps {
  selectedCodes: ReadonlySet<string>
  onToggle: (area: QuestArea) => void
}
const WIDTH=360, HEIGHT=400
export function AreaSelector({ selectedCodes, onToggle }: AreaSelectorProps) {
  const svgRef=useRef<SVGSVGElement>(null)
  const zoomRef=useRef<ZoomBehavior<SVGSVGElement,unknown> | null>(null)
  const [transform,setTransform]=useState<ZoomTransform>(zoomIdentity)
  const [groupId,setGroupId]=useState<string|null>(null)
  const group=metroMap.regions.find(r=>r.id===groupId)
  function toggleGroup(region:typeof metroMap.regions[number]) {
    setGroupId(region.id)
    const all=region.codes.every(code=>selectedCodes.has(code))
    for(const code of region.codes) if(all||!selectedCodes.has(code)) onToggle(METRO_AREAS.find(a=>a.sigunguCode===code)!)
  }
  const shapes=useMemo(()=>{
    const projection=geoMercator().fitExtent([[16,20],[WIDTH-16,HEIGHT-20]],{
      type:'MultiPoint',coordinates:metroMap.regions.flatMap(r=>r.polygons.flatMap(p=>p.flat())),
    })
    return metroMap.regions.map(region=>{
      const coordinates=region.polygons.flatMap(p=>p.flat()).map(p=>projection(p as [number,number])!)
      return {...region,point:projection(region.label as [number,number])!,
        bounds:[Math.min(...coordinates.map(p=>p[0])),Math.min(...coordinates.map(p=>p[1])),Math.max(...coordinates.map(p=>p[0])),Math.max(...coordinates.map(p=>p[1]))],
        path:region.polygons.flatMap(p=>p.map(r=>r.map((c,i)=>(i?'L':'M')+projection(c as [number,number])!.join(',')).join('')+'Z')).join(''),
      }
    })
  },[])
  useEffect(()=>{
    const svg=svgRef.current
    if(!svg) return
    const behavior=zoom<SVGSVGElement,unknown>()
      .extent([[0,0],[WIDTH,HEIGHT]]).scaleExtent([1,24])
      .translateExtent([[-WIDTH/2,-HEIGHT/2],[WIDTH*1.5,HEIGHT*1.5]])
      .clickDistance(6).on('zoom',event=>setTransform(event.transform))
    zoomRef.current=behavior
    select(svg).call(behavior).on('dblclick.zoom',null)
    return ()=>{select(svg).on('.zoom',null);zoomRef.current=null}
  },[])
  function changeZoom(factor:number) {
    if(svgRef.current&&zoomRef.current) select(svgRef.current).call(zoomRef.current.scaleBy,factor)
  }
  function focus(sido?:string) {
    if(!svgRef.current||!zoomRef.current) return
    if(!sido) {select(svgRef.current).call(zoomRef.current.transform,zoomIdentity);return}
    const regions=shapes.filter(r=>r.sido===sido)
    const x0=Math.min(...regions.map(r=>r.bounds[0])),y0=Math.min(...regions.map(r=>r.bounds[1]))
    const x1=Math.max(...regions.map(r=>r.bounds[2])),y1=Math.max(...regions.map(r=>r.bounds[3]))
    const k=Math.min(24,Math.max(1,.85*Math.min(WIDTH/(x1-x0),HEIGHT/(y1-y0))))
    select(svgRef.current).call(zoomRef.current.transform,zoomIdentity.translate(WIDTH/2-k*(x0+x1)/2,HEIGHT/2-k*(y0+y1)/2).scale(k))
  }
  // Keep labels at a readable screen size, revealing crowded names as the user zooms.
  const labels: {id:string;x:number;y:number;width:number;region:typeof shapes[number]}[]=[]
  const ordered=[...shapes].sort((a,b)=>Number(b.id===groupId)-Number(a.id===groupId)||Number(b.codes.some(c=>selectedCodes.has(c)))-Number(a.codes.some(c=>selectedCodes.has(c))))
  for(const region of ordered) {
    const [x,y]=transform.apply(region.point as [number,number]),width=region.name.length*10+10
    if(x<width/2||x>WIDTH-width/2||y<14||y>HEIGHT-14) continue
    if(labels.some(l=>Math.abs(x-l.x)<(width+l.width)/2+3&&Math.abs(y-l.y)<27)) continue
    labels.push({id:region.id,x,y,width,region})
  }
  return <div className={styles.wrap}>
    <div role="group" aria-label="지도 이동">
      <button type="button" onClick={()=>focus()}>수도권 전체</button>
      {METRO_SIDOS.map(s=><button key={s.code} type="button" onClick={()=>focus(s.code)}>{s.label} 확대</button>)}
    </div>
    <div className={styles.mapFrame}>
      <svg ref={svgRef} className={styles.map} viewBox={'0 0 '+WIDTH+' '+HEIGHT} role="group" aria-label="서울 경기 인천 통합 지역 선택 지도">
        <g transform={transform.toString()}>
          {shapes.map(region=><path key={region.id}
            className={region.codes.some(c=>selectedCodes.has(c)) ? styles.region+' '+styles.selected : styles.region}
            d={region.path} fillRule="evenodd" vectorEffect="non-scaling-stroke" role="button" tabIndex={0}
            aria-pressed={region.codes.some(c=>selectedCodes.has(c))} aria-label={METRO_SIDOS.find(s=>s.code===region.sido)!.label+' '+region.name}
            onClick={()=>toggleGroup(region)} onKeyDown={event=>{
              if(event.key==='Enter'||event.key===' ') {event.preventDefault();toggleGroup(region)}
            }}><title>{region.name}</title></path>)}
        </g>
        {labels.map(({id,x,y,width,region})=><g key={id} aria-hidden="true"
          className={region.codes.some(c=>selectedCodes.has(c)) ? styles.labelButton+' '+styles.labelSelected : styles.labelButton}
          onClick={()=>toggleGroup(region)}>
          <rect x={x-width/2} y={y-12} width={width} height={24} rx={6}/>
          <text className={styles.label} x={x} y={y} textAnchor="middle" dominantBaseline="central">{region.name}</text>
        </g>)}
      </svg>
      <div className={styles.zoomControls} role="group" aria-label="지도 배율">
        <button type="button" aria-label="지도 확대" disabled={transform.k>=24} onClick={()=>changeZoom(1.6)}>+</button>
        <button type="button" aria-label="지도 축소" disabled={transform.k<=1} onClick={()=>changeZoom(1/1.6)}>−</button>
      </div>
    </div>
    <small>확대해 지역 선택 · 두 손가락으로 확대·축소</small>
    {group ? <p className={styles.selection} aria-live="polite">{group.name} · {group.codes.filter(c=>selectedCodes.has(c)).length}/{group.codes.length} 선택</p> : null}
    {group && group.codes.length>1 ? <div role="group" aria-label={group.name+' 세부 지역'}>{group.codes.map(code=>{const area=METRO_AREAS.find(a=>a.sigunguCode===code)!;return <button key={code} type="button" aria-pressed={selectedCodes.has(code)} onClick={()=>onToggle(area)}>{area.sigunguName}</button>})}</div> : null}
  </div>
}