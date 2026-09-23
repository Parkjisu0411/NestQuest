import {readFile,writeFile} from 'node:fs/promises'
import * as shapefile from 'shapefile'
import proj4 from 'proj4'
import {topology} from 'topojson-server'
import {presimplify,simplify} from 'topojson-simplify'
import {feature} from 'topojson-client'
import {METRO_AREAS} from '../src/data/metroAreas.ts'
const dir=process.argv[2]??'tmp-map'
const stem=dir+'/bnd_sigungu_00_2025_2Q'
const projection=await readFile(stem+'.prj','utf8')
const reader=await shapefile.open(stem+'.shp',stem+'.dbf',{encoding:'utf-8'})
const features=[]
while(true){
 const r=await reader.read();if(r.done)break
 const p=r.value.properties;const sido=({'11':'11','23':'28','31':'41'})[p.SIGUNGU_CD.slice(0,2)]
 if(!sido)continue
 let name=p.SIGUNGU_NM
 if(sido==='41')name=name.split(' ')[0]
 if(sido==='28'&&['중구','동구'].includes(name))name='제물포·영종'
 if(sido==='28'&&name==='서구')name='서해·검단'
 features.push({...r.value,properties:{sido,name}})
}
const simplified=feature(simplify(presimplify(topology({areas:{type:'FeatureCollection',features}})),2000),'areas')
const groups=new Map()
for(const f of simplified.features){
 const {sido,name}=f.properties,key=sido+':'+name
 const polygons=(f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates).map(p=>p.map(r=>r.map(v=>proj4(projection,'EPSG:4326',v).map(n=>Number(n.toFixed(6))))))
 const g=groups.get(key)??{id:key,sido,name,polygons:[],codes:METRO_AREAS.filter(a=>a.sidoCode===sido&&(a.sigunguName===name||a.sigunguName.startsWith(name+' ')||(name==='제물포·영종'&&['제물포구','영종구'].includes(a.sigunguName))||(name==='서해·검단'&&['서해구','검단구'].includes(a.sigunguName)))).map(a=>a.sigunguCode)}
 if(!g.codes.length)throw new Error('Unmapped region: '+key)
 g.polygons.push(...polygons);groups.set(key,g)
}
const regions=[...groups.values()].map(g=>{
 const points=g.polygons.flat(2),xs=points.map(p=>p[0]),ys=points.map(p=>p[1])
 return {...g,label:[(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2]}
})
if(METRO_AREAS.some(a=>!regions.some(g=>g.codes.includes(a.sigunguCode))))throw new Error('Missing region')
await writeFile('src/data/map/metro-regions.json',JSON.stringify({asOf:'2025-06-30',codeAsOf:'2026-09-23',regions}))
console.log('Metro region groups:',regions.length)
