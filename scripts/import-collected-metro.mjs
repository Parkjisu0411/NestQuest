// Merge validated public collection into the personal bootstrap, preserving the prior seed.
import { readFile,writeFile,copyFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import proj4 from 'proj4'
import { mapApartment } from '../src/data/providers/publicData.ts'
import { attachDistrictTrades } from '../src/data/providers/enrich.ts'
import { markDistrictPrices } from '../src/data/syncPlan.ts'
import { METRO_AREAS } from '../src/data/metroAreas.ts'
import { createBootstrap,parseBootstrap,mergeBootstrap,bootstrapSummary } from '../src/data/bootstrap.ts'
const now=new Date().toISOString()
try{
 const web=JSON.parse(await readFile('local-data/collection/kapt-web-gyeonggi.json','utf8'))
 const api=parseBootstrap(JSON.parse(await readFile('local-data/collection/bootstrap-41.json','utf8')))
 const byId=new Map(api.catalog.records.map(r=>[r.apartment.id,r]))
 const canonicalIds=new Set(byId.keys())
 const projection='+proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43'
 for(const raw of web.rows){
  if(typeof raw.kaptName!=='string'||raw.kaptName.includes('?'))throw new Error('Invalid public label')
  const r=mapApartment({kaptCode:raw.kaptCode,kaptName:raw.kaptName,kaptAddr:raw.addr,bjdCode:raw.bjdCode},web.fetchedAt)
  if(r.area.sidoCode!=='41')throw new Error('Wrong province')
  if(!canonicalIds.has(r.apartment.id))continue
  const old=byId.get(r.apartment.id)
  const value=old?.apartment.housingType ? old : {...r,unitTypes:old?.unitTypes??[],commutes:old?.commutes??[],source:{provider:'K-apt 공개 단지 목록',fetchedAt:web.fetchedAt}}
  if(value.apartment.latitude===undefined && Number.isFinite(raw.x)&&Number.isFinite(raw.y)){
   const [longitude,latitude]=proj4(projection,'EPSG:4326',[raw.x,raw.y])
   if(longitude>124&&longitude<132&&latitude>34&&latitude<39) value.apartment={...value.apartment,longitude,latitude}
  }
  byId.set(r.apartment.id,value)
 }
 let records=[...byId.values()]
 for(const area of METRO_AREAS.filter(a=>a.sidoCode==='41')){
  const path='local-data/collection/trades-'+area.sigunguCode+'.json'
  if(!existsSync(path))continue
  const price=JSON.parse(await readFile(path,'utf8'))
  const subset=records.filter(r=>r.area.sigunguCode===area.sigunguCode)
  const attached=markDistrictPrices(attachDistrictTrades(subset,price.rows,price.fetchedAt),price.fetchedAt)
  const changed=new Map(attached.map(r=>[r.apartment.id,r]))
  records=records.map(r=>changed.get(r.apartment.id)??r)
 }
 const previous=parseBootstrap(JSON.parse(await readFile('local-data/bootstrap.json','utf8')))
 if(!existsSync('local-data/collection/bootstrap-before-metro.json'))await copyFile('local-data/bootstrap.json','local-data/collection/bootstrap-before-metro.json')
 const prior={...previous.catalog,records:previous.catalog.records.filter(r=>r.area.sidoCode!=='41'||canonicalIds.has(r.apartment.id)||!!r.apartment.housingType)}
 const merged=mergeBootstrap(prior,createBootstrap(records,now))
 const seed=createBootstrap(merged.records,now)
 await writeFile('local-data/bootstrap.json',JSON.stringify(seed))
 await writeFile('public/bootstrap.json',JSON.stringify(seed))
 console.log(JSON.stringify({gyeonggi:bootstrapSummary(createBootstrap(records,now)),combined:bootstrapSummary(seed),typedGyeonggi:records.filter(r=>r.apartment.housingType).length}))
}catch{console.error('Collected-data import validation failed; inspect provider schemas without exposing credentials.');process.exitCode=1}