import { describe, expect, it } from 'vitest'
import { parseMapBundle, type MapBundle } from './schema.ts'
import { clusterPoints, insideRegions } from './geometry.ts'
import { mapBundle, searchStations, stationDestination } from './bundle.ts'
import { SEOUL_AREAS } from '../seoulAreas.ts'

// Deliberately synthetic cells, never shipped as geography.
function fixture(): MapBundle {
  return { schemaVersion:1,status:'ready',version:'synthetic-test-only',asOf:'2026-09-18',sources:[{ name:'Synthetic fixture',url:'https://example.org',license:'Test only',attribution:'Not real geography' }],
    regions: SEOUL_AREAS.map((area,i) => ({ code:area.sigunguCode,name:area.sigunguName,label:[126.91+i*.002,37.51],polygons:[[[[126.90+i*.002,37.50],[126.902+i*.002,37.50],[126.902+i*.002,37.52],[126.90+i*.002,37.52],[126.90+i*.002,37.50]]]] })),
    stations:[{ id:'a',name:'시험역',lines:['테스트선'],coordinate:[126.91,37.51] },{id:'b',name:'다음역',lines:['테스트선'],coordinate:[126.93,37.51]}],
    routes:[{id:'route-a',name:'테스트선',color:'#123456',stationIds:['a','b']}],
  }
}
describe('offline region map', () => {
  it('validates a complete normalized bundle and preserves branch route order', () => {
    const input=fixture(); input.routes.push({ ...input.routes[0],id:'reverse',stationIds:['b','a'] })
    expect(parseMapBundle(input).routes[1].stationIds).toEqual(['b','a'])
  })
  it('rejects duplicate station identity and missing route endpoints', () => {
    const input=fixture();input.stations[1].id='a';expect(() => parseMapBundle(input)).toThrow()
    const broken=fixture();broken.routes[0].stationIds.push('missing');expect(() => parseMapBundle(broken)).toThrow()
  })
  it('rejects open boundary rings, wrong coordinate systems, invalid dates and unsafe colors', () => {
    const input=fixture();input.regions[0].polygons[0][0].pop();expect(() => parseMapBundle(input)).toThrow()
    const bad=fixture();bad.stations[0].coordinate=[950000,1900000];expect(() => parseMapBundle(bad)).toThrow()
    expect(() => parseMapBundle({...fixture(),asOf:'2026-02-31'})).toThrow()
    const color=fixture();color.routes[0].color='url(https://example.org)';expect(() => parseMapBundle(color)).toThrow()
  })
  it('keeps points outside the region outside instead of clamping them to its edge', () => {
    expect(insideRegions([126.901,37.51],fixture().regions)).toBe(true)
    expect(insideRegions([127.5,37.51],fixture().regions)).toBe(false)
    const regions=fixture().regions;regions[0].polygons[0].push([[126.9005,37.505],[126.9015,37.505],[126.9015,37.515],[126.9005,37.515],[126.9005,37.505]])
    expect(insideRegions([126.901,37.51],regions)).toBe(false)
  })
  it('bounds marker count at Seoul scale and keeps focused apartments selectable', () => {
    const points=Array.from({length:10000},(_,i)=>({item:{id:String(i)},x:(i%100)*3,y:Math.floor(i/100)*3}))
    const result=clusterPoints(points,360,380,'1')
    expect(result.length).toBeLessThan(100)
    expect(result.reduce((total,x)=>total+x.items.length,0)).toBe(10000)
    expect(result[0].items[0].id).toBe('1')
    for (const [i,a] of result.entries()) for (const b of result.slice(i+1)) expect(Math.hypot(a.x-b.x,a.y-b.y)).toBeGreaterThanOrEqual(44)
    expect(clusterPoints([{item:{id:'outside'},x:-5,y:10}],360,380,null)).toEqual([])
  })
  it('groups across cell boundaries and preserves every co-located apartment', () => {
    const points = [43,45,46,90].map((x,i) => ({item:{id:String(i)},x,y:30}))
    const groups = clusterPoints(points,360,380,'1')
    expect(groups.map(g => g.items.map(i => i.id))).toEqual([['1','0','2'],['3']])
    expect(groups[0].x).toBe(45)
  })
  it('searches offline and keeps same-name stations separate by stable identity', () => {
    const stations=fixture().stations;stations[1].name=stations[0].name
    expect(searchStations(stations,'시 험')).toHaveLength(2)
    expect(searchStations(stations,'테스트선')).toHaveLength(2)
    expect(stationDestination(stations[0])).toMatchObject({id:'station:a',longitude:126.91,latitude:37.51})
  })
  it('ships real Seoul boundaries and searchable Yeouido station', () => {
    expect(mapBundle?.regions).toHaveLength(25)
    expect(searchStations(mapBundle!.stations,'여의도').length).toBeGreaterThan(0)
    const route=(suffix:string)=>mapBundle!.routes.find(r=>r.id===`metro:2호선:${suffix}`)!
    expect(route('circle').stationIds[0]).toBe(route('circle').stationIds.at(-1))
    expect(route('seongsu').stationIds[0]).not.toBe(route('circle').stationIds.at(-1))
    const branch=mapBundle!.routes.find(r=>r.id==='metro:5호선:macheon')!
    expect(mapBundle!.stations.find(s=>s.id===branch.stationIds[0])!.name).toBe('강동')
    expect(mapBundle!.stations.find(s=>s.id===branch.stationIds[1])!.name).toBe('둔촌동')
  })
  it('connects verified operator boundaries and separates branches and unopened GTX sections', () => {
    const b=mapBundle!
    const route=(id:string)=>b.routes.find(r=>r.id===id)!.stationIds.map(id=>b.stations.find(s=>s.id===id)!.name.replace(/\([^)]*\)/g,''))
    expect(route('rail:9호선:main')).toHaveLength(38)
    expect(route('rail:신림선:main')).toHaveLength(11)
    expect(route('rail:8호선:main').slice(0,7)).toEqual(['별내','다산','동구릉','구리','장자호수공원','암사역사공원','암사'])
    const one=route('rail:1호선:1호선(경인선)')
    expect(one.slice(one.indexOf('회기'),one.indexOf('남영')+1)).toEqual(['회기','청량리','제기동','신설동','동묘앞','동대문','종로5가','종로3가','종각','시청','서울역','남영'])
    const seven=route('rail:7호선:main')
    expect(seven.slice(seven.indexOf('온수'),seven.indexOf('온수')+2)).toEqual(['온수','까치울'])
    expect(route('rail:경의중앙선:seoul').slice(-3)).toEqual(['가좌','신촌','서울역'])
    expect(route('rail:GTX-A:north')).toEqual(['운정중앙','킨텍스','대곡','연신내','서울역'])
    expect(route('rail:GTX-A:south')).toEqual(['수서','성남','구성','동탄'])
    expect(b.stations.some(s=>s.id==='seoul:9006')).toBe(false)
    expect(b.stations.find(s=>s.id==='seoul:1010')!.lines).toEqual(['경의중앙선'])
  })
})
