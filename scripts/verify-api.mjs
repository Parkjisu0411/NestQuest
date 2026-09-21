// Live smoke check: consume local keys without logging values, URLs or response bodies.
// Never writes provider data or modifies the user's IndexedDB.
import { loadEnv } from 'vite'
import { keysFromEnvironment } from '../src/data/apiKeyConfig.ts'
import { ENDPOINTS, ApiError, requestApi } from '../src/data/providers/http.ts'
import { bodyItems, publicBody, decodeServiceKey, mapSeoulApartment, fetchSeoulApartments } from '../src/data/providers/publicData.ts'
import { fetchDetail, fetchCommute, fetchDistrictTrades, parseTradeRows, attachDistrictTrades } from '../src/data/providers/enrich.ts'
import { geocode } from '../src/data/providers/kakao.ts'
import { geocodeApartment } from '../src/data/providers/geocodeApartment.ts'
import { SEOUL_AREAS } from '../src/data/seoulAreas.ts'

const keys = keysFromEnvironment(loadEnv('development', process.cwd(), 'NESTQUEST_'))
const nativeFetch = globalThis.fetch
let calls = 0
globalThis.fetch = async (input, options) => {
  const local = new URL(String(input), 'http://localhost')
  const name = local.pathname.replace('/api/provider/', '')
  if (!Object.hasOwn(ENDPOINTS, name) || ++calls > 150) throw new Error('Request budget exceeded')
  return nativeFetch(ENDPOINTS[name] + local.search, { ...options, redirect: 'error' })
}
const signal = AbortSignal.timeout(300000)
const districtOption = process.argv.find(arg => arg === '--districts' || arg.startsWith('--districts='))
const districtCodes = districtOption?.includes('=') ? districtOption.split('=')[1].split(',') : null
let phase = ''
let failed = false
async function check(name, run) {
  phase = ''
  try { console.log(`${name}: OK ${await run() ?? ''}`) }
  catch (error) {
    failed = true
    // Only controlled error categories; external errors may contain a credential URL.
    console.log(`${name}: FAIL ${phase} ${error instanceof ApiError ? error.kind : 'internal-or-timeout'}`)
  }
}
let records = [], detailed
await check('공공 단지 목록', async () => {
  const body = publicBody(await requestApi('list', { serviceKey: decodeServiceKey(keys.publicDataKey), sidoCode:'11', pageNo:'1', numOfRows:'100' },signal))
  records = bodyItems(body).map(row => mapSeoulApartment(row, new Date().toISOString()))
  if (!records.length) throw new Error('Empty list')
  return `첫 페이지 ${records.length}건 / 전체 ${Number(body.totalCount)}건`
})
await check('공공 기본·상세정보', async () => {
  if (!records.length) throw new Error('List prerequisite')
  detailed = await fetchDetail(records[0],keys.publicDataKey,signal)
  return `주소 ${!!detailed.apartment.address}, 세대수 ${detailed.apartment.householdCount !== undefined}, 주차 ${detailed.apartment.parkingCount !== undefined}`
})
await check('카카오 주소 좌표', async () => {
  const point = await geocodeApartment(detailed?.apartment ?? {address:'서울특별시 영등포구 여의나루로 40'}, address=>geocode(address,keys.kakaoRestKey,signal))
  if (!point) throw new Error('No point')
  if (detailed) detailed = { ...detailed, apartment: { ...detailed.apartment, ...point } }
  return '단일 좌표 확인'
})
await check('공공 실거래', async () => {
  const date = new Date(); date.setDate(1); date.setMonth(date.getMonth()-1)
  const month = `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}`
  const district = detailed?.area.sigunguCode ?? '11560'
  const body = publicBody(await requestApi('trades',{serviceKey:decodeServiceKey(keys.publicDataKey),LAWD_CD:district,DEAL_YMD:month,pageNo:'1',numOfRows:'1000'},signal))
  const rows = parseTradeRows(body,district)
  if (detailed) attachDistrictTrades([detailed],rows,new Date().toISOString())
  return `${month} / ${rows.length}건 파싱`
})
await check('Kakao 통근', async () => {
  // Fixed public station coordinates for provider authentication, not a user destination change.
  const origin = detailed?.apartment.latitude ? detailed : { apartment:{id:'probe',latitude:37.555,longitude:126.9707} }
  const result = await fetchCommute(origin,{id:'probe-yeouido',name:'여의도역',latitude:37.521624,longitude:126.924191},keys.kakaoRestKey,signal)
  return `${result.totalMinutes}분 / ${result.route.length}개 구간 (세션 결과, 미저장)`
})
if (process.argv.includes('--full') || districtOption) {
  await check('서울 전체 페이지', async () => {
    records = await fetchSeoulApartments(keys.publicDataKey,signal,()=>{})
    return `${records.length}개 / ${new Set(records.map(r=>r.area.sigunguCode)).size}개 구 / ID 중복 없음`
  })
  if (process.argv.includes('--full')) await check('영등포구 표본 상세·실거래 연결', async () => {
    const sample=[]; let positions=0, detailFailures=0
    for (const record of records.filter(r=>r.area.sigunguCode==='11560').slice(0,20)) {
      try {
        const detail=await fetchDetail(record,keys.publicDataKey,signal)
        if(await geocodeApartment(detail.apartment,address=>geocode(address,keys.kakaoRestKey,signal))) positions++
        sample.push(detail)
      } catch(error) { if(!(error instanceof ApiError) || error.kind!=='format') throw error; detailFailures++ }
    }
    const rows=await fetchDistrictTrades('11560',keys.publicDataKey,signal,()=>{})
    const attached=attachDistrictTrades(sample,rows,new Date().toISOString())
    return `${sample.length}개 상세 / ${positions}개 좌표 / 형식 오류 ${detailFailures}개 / 12개월 ${rows.length}건 거래 / ${attached.filter(r=>r.unitTypes.some(u=>u.priceEstimate)).length}개 가격 연결`
  })
}
if (districtOption) {
  for (const area of SEOUL_AREAS.filter(area => !districtCodes || districtCodes.includes(area.sigunguCode))) await check(`${area.sigunguName} 교차 검증`, async () => {
    const record=records.find(r=>r.area.sigunguCode===area.sigunguCode)
    if (!record) throw new Error('District absent')
    phase='상세'
    const detail=await fetchDetail(record,keys.publicDataKey,signal)
    phase='좌표'
    const point=await geocodeApartment(detail.apartment,address=>geocode(address,keys.kakaoRestKey,signal))
    const date=new Date();date.setDate(1);date.setMonth(date.getMonth()-1)
    const month=`${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}`
    phase='실거래'
    const body=publicBody(await requestApi('trades',{serviceKey:decodeServiceKey(keys.publicDataKey),LAWD_CD:area.sigunguCode,DEAL_YMD:month,pageNo:'1',numOfRows:'1000'},signal))
    const rows=parseTradeRows(body,area.sigunguCode)
    const [attached]=attachDistrictTrades([detail],rows,new Date().toISOString())
    return `상세 1 / 좌표 ${point ? 1 : 0} / ${month} 첫 페이지 거래 ${rows.length} / 표본 가격 ${attached.unitTypes.some(u=>u.priceEstimate) ? 1 : 0}`
  })
}
globalThis.fetch = nativeFetch
console.log(`요청 ${calls}회. 원문·키·응답 파일 저장 없음.`)
process.exitCode = failed ? 1 : 0
