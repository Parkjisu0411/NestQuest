import { listQuestHomeMatches } from '../domain/discover.ts'
import {afterEach,expect,it,vi} from 'vitest'
import {METRO_AREAS,currentDistrictCode,tradeDistrictCodes} from './metroAreas.ts'
import {fetchMetroApartments,mapApartment} from './providers/publicData.ts'
import {metroLotAddress} from './providers/address.ts'
import {attachDistrictTrades,fetchDistrictTrades,parseTradeRows} from './providers/enrich.ts'
import {requestApi} from './providers/http.ts'
import metroMap from './map/metro-regions.json'
vi.mock('./providers/http.ts',async importOriginal=>({...await importOriginal<typeof import('./providers/http.ts')>(),requestApi:vi.fn()}))
vi.mock('./providerCache.ts',async importOriginal=>({...await importOriginal<typeof import('./providerCache.ts')>(),readProviderCache:vi.fn(async()=>undefined),writeProviderCache:vi.fn(async()=>{})}))
afterEach(()=>vi.clearAllMocks())
const now='2026-09-23T00:00:00.000Z'
it('has only selectable leaf districts and complete geographic group coverage',()=>{
 expect(METRO_AREAS.filter(a=>a.sidoCode==='11')).toHaveLength(25)
 expect(METRO_AREAS.filter(a=>a.sidoCode==='28')).toHaveLength(11)
 expect(METRO_AREAS.find(a=>a.sigunguCode==='41110')).toBeUndefined()
 for(const a of METRO_AREAS) expect(metroMap.regions.some(r=>r.codes.includes(a.sigunguCode))).toBe(true)
 expect(METRO_AREAS.find(a=>a.sigunguCode==='41597')?.sigunguName).toBe('화성시 동탄구')
})
it('normalizes city districts and eup/myeon/ri lots without treating roads as lots',()=>{
 expect(metroLotAddress('경기 고양시 일산동구 백석동 0123-02 아파트')).toBe('경기도 고양시 일산동구 백석동 123-2')
 expect(metroLotAddress('경기도 김포시 양촌읍 양곡리 산 12-3')).toBe('경기도 김포시 양촌읍 양곡리 산12-3')
 expect(metroLotAddress('인천 연수구 송도동 1')).toBe('인천광역시 연수구 송도동 1')
 expect(metroLotAddress('경기도 김포시 김포한강1로 1')).toBeNull()
})
it('maps provincial records and historical reform codes without changing apartment identity',()=>{
 const a=mapApartment({kaptCode:'A',kaptName:'A',as1:'경기도',as2:'고양시',as3:'일산동구',as4:'백석동',bjdCode:'4128510600'},now)
 expect(a.area.sigunguCode).toBe('41285')
 const b=mapApartment({kaptCode:'B',kaptName:'B',kaptAddr:'인천광역시 중구 운서동 1',bjdCode:'2811014700'},now)
 expect(b.apartment.id).toBe('kapt:B')
 expect(b.area.sigunguCode).toBe(currentDistrictCode('2811014700'))
 expect(b.area.sigunguCode).toBe('28155')
 expect(tradeDistrictCodes('28155')).toContain('28110')
})
it('fetches each selected province once with independent totals',async()=>{
 vi.mocked(requestApi).mockImplementation(async(_endpoint,params)=>({response:{header:{resultCode:'00'},body:{totalCount:1,items:{item:{kaptCode:params.sidoCode,kaptName:'시험',kaptAddr:params.sidoCode==='41'?'경기도 광명시 철산동 1':'인천광역시 연수구 송도동 1',bjdCode:params.sidoCode==='41'?'4121010200':'2818510600'}}}}}))
 const records=await fetchMetroApartments('synthetic',new AbortController().signal,()=>{},['41','28','41'])
 expect(records).toHaveLength(2)
 expect(vi.mocked(requestApi).mock.calls.map(c=>c[1].sidoCode)).toEqual(['41','28'])
})
it('matches a metropolitan sale by complete address and refuses a neighboring district',()=>{
 const a=mapApartment({kaptCode:'A',kaptName:'시험',kaptAddr:'경기도 고양시 일산동구 백석동 1',bjdCode:'4128510600'},now)
 const rows=parseTradeRows({items:{item:{aptSeq:'S',aptNm:'시험',umdNm:'백석동',jibun:'1',dealYear:'2026',dealMonth:'8',dealDay:'1',excluUseAr:'84',dealAmount:'60000',floor:'5'}}},'41285')
 expect(attachDistrictTrades([a],rows,now)[0].unitTypes[0].priceEstimate?.estimatedPrice).toBe(600000000)
 expect(attachDistrictTrades([a],rows.map(r=>({...r,districtCode:'41287'})),now)[0].unitTypes).toHaveLength(0)
})
it('accepts Incheon and Gyeonggi transaction requests without a Seoul-only guard',async()=>{
 vi.mocked(requestApi).mockResolvedValue({response:{header:{resultCode:'00'},body:{totalCount:0,items:''}}})
 await fetchDistrictTrades('28185','synthetic',new AbortController().signal,()=>{})
 await fetchDistrictTrades('41285','synthetic',new AbortController().signal,()=>{})
 expect(vi.mocked(requestApi).mock.calls.some(c=>c[1].LAWD_CD==='28185')).toBe(true)
 expect(vi.mocked(requestApi).mock.calls.some(c=>c[1].LAWD_CD==='41285')).toBe(true)
})

it('shows prepared provincial apartments for selected metro areas without a Seoul-only browse restriction',()=>{
 const records=[
  mapApartment({kaptCode:'GG',kaptName:'경기 시험',kaptAddr:'경기도 광명시 철산동 1',bjdCode:'4121010200'},now),
  mapApartment({kaptCode:'IC',kaptName:'인천 시험',kaptAddr:'인천광역시 연수구 송도동 1',bjdCode:'2818510600'},now),
 ].map(r=>({...r,apartment:{...r.apartment,housingType:'아파트'}}))
 const criteria={areas:records.map(r=>r.area),includeUnknown:true}
 expect(listQuestHomeMatches(records,criteria,{}).map(m=>m.apartment.id)).toEqual(['kapt:GG','kapt:IC'])
 expect(listQuestHomeMatches(records,{...criteria,areas:[records[1].area]},{}).map(m=>m.apartment.id)).toEqual(['kapt:IC'])
})