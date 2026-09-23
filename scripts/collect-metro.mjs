// Consume local credentials without printing keys, URLs, headers or external error text.
// Checkpoints contain only validated provider data; user records are never read or overwritten.
import { loadEnv } from 'vite'
import { readFile,writeFile,mkdir,rename } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { keysFromEnvironment } from '../src/data/apiKeyConfig.ts'
import { ENDPOINTS,ApiError } from '../src/data/providers/http.ts'
import { fetchSidoApartments,publicBody,bodyItems } from '../src/data/providers/publicData.ts'
import { fetchDetail,fetchDistrictTrades,attachDistrictTrades } from '../src/data/providers/enrich.ts'
import { geocode } from '../src/data/providers/kakao.ts'
import { geocodeApartment } from '../src/data/providers/geocodeApartment.ts'
import { createBootstrap,parseBootstrap,bootstrapSummary } from '../src/data/bootstrap.ts'
import { mergeCatalog } from '../src/data/catalogSnapshot.ts'
import { needsDetail,markDistrictPrices } from '../src/data/syncPlan.ts'
import { METRO_AREAS } from '../src/data/metroAreas.ts'
import { isGeneralApartment } from '../src/data/housingType.ts'
const keys=keysFromEnvironment(loadEnv('development',process.cwd(),'NESTQUEST_'))
const nativeFetch=globalThis.fetch
let calls=0,stop=false,networkFailures=0
const failures={}
const signal=AbortSignal.timeout(60*60*1000)
const sido=process.argv.find(x=>/^--sido=(11|41|28)$/.test(x))?.split('=')[1] ?? '41'
const path='local-data/collection/bootstrap-'+sido+'.json'
const statePath='local-data/collection/state-'+sido+'.json'
await mkdir('local-data/collection',{recursive:true})
let catalog={mode:'live',records:[]}
if(existsSync(path)) catalog=parseBootstrap(JSON.parse(await readFile(path,'utf8'))).catalog
let state=existsSync(statePath)?JSON.parse(await readFile(statePath,'utf8')):{}
const fresh=t=>typeof t==='string'&&Date.now()-Date.parse(t)<86400000
await mkdir('local-data/collection/list-pages',{recursive:true})
globalThis.fetch=async(input,options)=>{
 const local=new URL(String(input),'http://localhost')
 const name=local.pathname.replace('/api/provider/','')
 if(!Object.hasOwn(ENDPOINTS,name)||stop) throw new ApiError('Collection stopped','limit')
 const pagePath=name==='list'?'local-data/collection/list-pages/'+sido+'-'+local.searchParams.get('numOfRows')+'-'+local.searchParams.get('pageNo')+'.json':null
 if(pagePath&&existsSync(pagePath)){
  const cached=JSON.parse(await readFile(pagePath,'utf8'))
  if(fresh(cached.at))return new Response(JSON.stringify(cached.body),{status:200})
 }
 if(++calls>14000) {stop=true;throw new ApiError('Collection request budget','limit')}
 const response=await nativeFetch(ENDPOINTS[name]+local.search,{...options,headers:{...options?.headers,...(['list','basic','detail','trades'].includes(name)?{'Content-Type':'application/json; charset=UTF-8'}:{})},redirect:'error'})
 if(pagePath && response.ok){
  const text=await response.text()
  try{
   const {parseApiBody}=await import('../src/data/providers/http.ts')
   const body=publicBody(parseApiBody(text))
   const items=bodyItems(body).map(r=>Object.fromEntries(['kaptCode','kaptName','bjdCode','as1','as2','as3','as4','kaptAddr','kaptAddress','doroJuso'].filter(k=>r[k]!==undefined).map(k=>[k,r[k]])))
   await writeFile(pagePath,JSON.stringify({at:new Date().toISOString(),body:{response:{header:{resultCode:'00'},body:{items,totalCount:body.totalCount}}}}))
  }catch{/* Failed provider responses are never cached. */}
  return new Response(text,{status:response.status})
 }
 return response
}
function errorKind(e) {
 const kind=e instanceof ApiError?e.kind:'internal-or-timeout'
 failures[kind]=(failures[kind]??0)+1
 if(kind==='network' && ++networkFailures>=5)stop=true
 if(['limit','auth'].includes(kind)) stop=true
 return kind
}
async function checkpoint(){
 await writeFile(path+'.tmp',JSON.stringify(createBootstrap(catalog.records)))
 await rename(path+'.tmp',path)
 await writeFile(statePath,JSON.stringify(state))
}
try {
 try { if(!process.argv.includes('--prices-only')&&!process.argv.includes('--details-only')&&!fresh(state.listAt)){
  let pages=0
  await fetchSidoApartments(keys.publicDataKey,signal,()=>{},sido,async rows=>{
   catalog=mergeCatalog(catalog,rows);pages++
   await checkpoint()
   if(pages%10===0) console.log('list pages '+pages+' saved '+catalog.records.length)
  })
  state.listAt=new Date().toISOString()
  await checkpoint()
 }
 }catch(e){console.log('list incomplete '+errorKind(e));await checkpoint()}
 console.log('list saved '+catalog.records.length+' complete '+Boolean(state.listAt))
 const sampleLimit=Number(process.argv.find(x=>/^--sample=[0-9]+$/.test(x))?.split('=')[1] ?? '100000')
 const targets=process.argv.includes('--prices-only')?[]:catalog.records.filter(r=>!fresh(state.detailAt?.[r.apartment.id]) && needsDetail(r)).slice(0,sampleLimit)
 let index=0,finished=0
 const records=new Map(catalog.records.map(r=>[r.apartment.id,r]))
 const workers=Array.from({length:3},async()=>{
  while(index<targets.length&&!stop&&!signal.aborted){
   const original=targets[index++]
   try{
    const updated=await fetchDetail(original,keys.publicDataKey,signal,async basic=>{records.set(basic.apartment.id,basic)})
    networkFailures=0
    state.detailAt={...state.detailAt,[updated.apartment.id]:new Date().toISOString()}
    records.set(updated.apartment.id,updated)
   }catch(e){errorKind(e)}
   finished++
   if(finished%100===0) console.log('detail '+finished+'/'+targets.length+' requests '+calls+' errors '+JSON.stringify(failures))
   await new Promise(resolve=>setTimeout(resolve,150))
  }
 })
 // Serial snapshots while workers update the in-memory map; no concurrent file writers.
 let done=false
 const all=Promise.all(workers).finally(()=>{done=true})
 while(!done){
  await Promise.race([all,new Promise(resolve=>setTimeout(resolve,2000))])
  catalog={mode:'live',records:[...records.values()]}
  await checkpoint()
 }
 await all
 catalog={mode:'live',records:[...records.values()]}
 await checkpoint()
 stop=false;networkFailures=0
 if(!process.argv.includes('--details-only')&&!signal.aborted){
  let count=0
  for(const district of METRO_AREAS.filter(a=>a.sidoCode===sido).map(a=>a.sigunguCode)){
   const pricePath='local-data/collection/trades-'+district+'.json'
   try{
    const cached=fresh(state.prices?.[district])&&existsSync(pricePath)?JSON.parse(await readFile(pricePath,'utf8')):null
    const rows=cached?.rows ?? await fetchDistrictTrades(district,keys.publicDataKey,signal,()=>{})
    if(!cached)await writeFile(pricePath,JSON.stringify({fetchedAt:new Date().toISOString(),rows}))
    const subset=catalog.records.filter(r=>r.area.sigunguCode===district)
    catalog=mergeCatalog(catalog,markDistrictPrices(attachDistrictTrades(subset,rows,new Date().toISOString())))
    state.prices={...state.prices,[district]:new Date().toISOString()}
    await checkpoint()
    console.log('prices district '+district+' transactions '+rows.length)
   }catch(e){console.log('prices failed '+district+' '+errorKind(e))}
   if(stop)break
   if(++count%5===0)await checkpoint()
  }
 }
 if(!stop&&!process.argv.includes('--no-geocode')&&!process.argv.includes('--prices-only')&&keys.kakaoRestKey){
  for(const original of catalog.records.filter(r=>isGeneralApartment(r.apartment)&&r.apartment.latitude===undefined)){
   try{
    const point=await geocodeApartment(original.apartment,a=>geocode(a,keys.kakaoRestKey,signal))
    if(point)catalog=mergeCatalog(catalog,[{...original,apartment:{...original.apartment,...point}}])
   }catch(e){errorKind(e)}
   if(calls%50===0)await checkpoint()
   if(stop)break
   await new Promise(resolve=>setTimeout(resolve,150))
  }
 }
 await checkpoint()
}catch(e){console.log('collection stopped '+errorKind(e));await checkpoint()}
finally{globalThis.fetch=nativeFetch}
console.log(JSON.stringify({sido,summary:bootstrapSummary(createBootstrap(catalog.records)),typed:catalog.records.filter(r=>r.apartment.housingType).length,requests:calls,failures}))
process.exitCode=Object.keys(failures).length?1:0