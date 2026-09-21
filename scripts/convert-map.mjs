// Offline conversion of the official SGIS SHP and Seoul station/route downloads.
// No credentials. See docs/MAP_DATA_PLAN.md for source URLs and provenance.
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import * as shapefile from 'shapefile'
import proj4 from 'proj4'
import { topology } from 'topojson-server'
import { presimplify, simplify } from 'topojson-simplify'
import { feature } from 'topojson-client'
import { SEOUL_AREAS } from '../src/data/seoulAreas.ts'
import { parseMapBundle } from '../src/data/map/schema.ts'
import { extendRail } from './extend-map-rail.mjs'

const directory = process.argv[2]
if (!directory) throw new Error('Usage: node --experimental-strip-types scripts/convert-map.mjs <source-directory>')
const input = name => path.join(directory,name)
const stem = 'bnd_sigungu_00_2025_2Q'
const projection = await readFile(input(stem+'.prj'),'utf8')
const reader = await shapefile.open(input(stem+'.shp'),input(stem+'.dbf'),{encoding:'utf-8'})
const features = [], crosswalk=[]
while (true) {
  const row = await reader.read(); if(row.done) break
  if (!String(row.value.properties.SIGUNGU_CD).startsWith('11')) continue
  const area = SEOUL_AREAS.find(a=>a.sigunguName===row.value.properties.SIGUNGU_NM)
  if (!area) throw new Error('Unknown Seoul district')
  crosswalk.push({ sgis:row.value.properties.SIGUNGU_CD,legal:area.sigunguCode,name:area.sigunguName })
  features.push({...row.value,properties:{code:area.sigunguCode,name:area.sigunguName}})
}
if(features.length!==25) throw new Error('Expected all 25 Seoul districts')
// Simplify shared arcs once in metre coordinates (triangle area threshold: 100 m²).
const reduced=feature(simplify(presimplify(topology({districts:{type:'FeatureCollection',features}})),100),'districts')
const coordinate = p=>proj4(projection,'EPSG:4326',p).map(n=>Number(n.toFixed(6)))
const regions=reduced.features.map(f=>{
  const polygons=(f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates).map(p=>p.map(r=>r.map(coordinate)))
  // D3 spherical centroid depends on winding; a projected bbox centre gives a stable label.
  const points=polygons.flat(2), xs=points.map(p=>p[0]),ys=points.map(p=>p[1])
  return {...f.properties,polygons,label:[(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2]}
})
const rawStations=JSON.parse(await readFile(input('stations.json'),'utf8')).DATA
const canonicalLine=name=>({'일산선':'3호선','과천선':'4호선','안산선':'4호선','진접선':'4호선','경부선':'1호선','경인선':'1호선','경원선':'1호선','장항선':'1호선','9호선(연장)':'9호선','7호선(인천)':'7호선','별내선':'8호선','분당선':'수인분당선','수인선':'수인분당선','중앙선':'경의중앙선','공항철도1호선':'공항철도','신분당선(연장)':'신분당선','신분당선(연장2)':'신분당선'}[name]??name)
// GTX master includes unopened stations without an operation flag. Do not offer them.
const stations=rawStations.filter(s=>s.route!=='수도권 광역급행철도').map(s=>({id:`seoul:${s.bldn_id}`,name:s.bldn_nm,lines:[canonicalLine(s.route)],coordinate:[Number(s.lot),Number(s.lat)]}))
// The master has one physical Kkachisan record; the official distance CSV lists both lines.
const kkachisan=stations.find(s=>s.id==='seoul:2519')
if(kkachisan?.name!=='까치산')throw new Error('까치산 원본 ID 변경')
kkachisan.lines.push('2호선')
const jayang=stations.find(s=>s.id==='seoul:2730')
if(jayang?.name==='뚝섬유원지')jayang.name='자양(뚝섬한강공원)'
// Old CSV names mapped only where the current official master and Seoul guidance agree.
const normalizedName=name=>name.replace(/\([^)]*\)/g,'').replace(/\s/g,'').replace(/^신내역$/,'신내').replace(/^당고개$/,'불암산')
const csv = new TextDecoder('euc-kr').decode(await readFile(input('metro-distance.csv')))
const rows=csv.trim().split(/\r?\n/).slice(1).map(row=>row.split(','))
const routeRows=new Map()
for(const row of rows){const line=`${row[1]}호선`;const values=routeRows.get(line)??[];values.push(row[2]);routeRows.set(line,values)}
const colors=['#0052A4','#00A84D','#EF7C1C','#00A5DE','#996CAC','#CD7C2F','#747F00','#E6186C']
const routes=[]
function add(line,suffix,names){
  const stationIds=names.map(name=>{
    const candidates=stations.filter(s=>s.lines.includes(line)&&normalizedName(s.name)===normalizedName(name))
    const operatorMatches=candidates.filter(s=>rawStations.some(raw=>`seoul:${raw.bldn_id}`===s.id&&raw.route===line))
    const found=operatorMatches.length ? operatorMatches : candidates
    if(found.length!==1)throw new Error(`역 대응표 확인 필요: ${line} ${name} (${found.length})`)
    return found[0].id
  })
  routes.push({id:`metro:${line}:${suffix}`,name:line,color:colors[Number(line[0])-1],stationIds})
}
for(const [line,names] of routeRows){
  if(line==='2호선'){
    const branch=names.indexOf('용답'),second=names.indexOf('도림천')
    if(branch<0||second<branch||names[branch-1]!=='시청')throw new Error('2호선 원본 순서 변경')
    add(line,'circle',names.slice(0,branch))
    add(line,'seongsu',['성수',...names.slice(branch,second)])
    add(line,'sinjeong',['신도림',...names.slice(second)])
  }else if(line==='5호선'){
    const branch=names.indexOf('둔촌동');if(branch<0)throw new Error('5호선 원본 순서 변경')
    add(line,'main',names.slice(0,branch));add(line,'macheon',['강동',...names.slice(branch)])
  }else add(line,'main',names)
}
const extension = await extendRail(stations,routes,rawStations,directory)
const sources=[
  {name:'SGIS 2025년 2분기 시군구 경계',url:'https://www.data.go.kr/data/15129688/fileData.do',license:'이용허락범위 제한 없음',attribution:'국가데이터처 SGIS · 2025-06-30 경계 · 서울 추출/좌표 변환/공유 경계 단순화'},
  {name:'서울시 역사마스터 정보',url:'https://data.seoul.go.kr/dataList/OA-21232/S/1/datasetView.do',license:'공공누리 제1유형',attribution:'서울특별시 역사마스터 · 2026-09-18 수집 · 역명/운행 노선 보정, GTX 삼성역 제외'},
  {name:'서울교통공사 역간거리',url:'https://data.seoul.go.kr/dataList/OA-12034/F/1/datasetView.do',license:'공공누리 제1유형',attribution:'서울교통공사 · 2024-08-10 역간거리 자료 · 2호선/5호선 분기 분리'},
  ...extension.sources,
]
const bundle=parseMapBundle({schemaVersion:1,status:'ready',version:'seoul-20260921',asOf:'2026-09-21',sources,regions,stations,routes:extension.routes,coverageNote:'서울 경계: 2025년 6월. 서울을 통과하는 도시철도·광역철도 연결선을 표시합니다. GTX-A는 공식 안내의 북부/남부 별도 운행 구간만 반영하며 삼성역은 제외합니다. 서울 밖 연결선은 잘라 표시합니다. 역 사이 직선은 실제 선로·도보 경로가 아닙니다.'})
const files=[stem+'.shp',stem+'.dbf',stem+'.prj','stations.json','metro-distance.csv',...extension.files]
const manifest={collectedAt:'2026-09-21',converter:'scripts/convert-map.mjs',railConverter:'scripts/extend-map-rail.mjs',crosswalk,sources:await Promise.all(files.map(async file=>({file,sha256:createHash('sha256').update(await readFile(input(file))).digest('hex')})))}
await writeFile(input('normalized.json'),JSON.stringify(bundle)+'\n')
await writeFile('src/data/map/provenance.json',JSON.stringify(manifest,null,2)+'\n')
console.log(`Converted ${regions.length} districts, ${stations.length} station records, ${extension.routes.length} route paths.`)
