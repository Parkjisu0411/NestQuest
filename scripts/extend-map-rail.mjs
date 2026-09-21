// Public, offline inputs only. No API keys; see docs/MAP_DATA_PLAN.md.
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const clean = name => name.replace(/\([^)]*\)/g, '').replace(/\s/g, '').replace(/^당고개$/, '불암산').replace(/^신내역$/, '신내').replace(/^김포공항역$/, '김포공항').replace(/^부천종합운동장역$/, '부천종합운동장').replace(/^이수$/, '총신대입구').replace(/^신길온천$/, '능길')
const colors = {'1호선':'#0052A4','3호선':'#EF7C1C','4호선':'#00A5DE','7호선':'#747F00','8호선':'#E6186C','9호선':'#BDB092','공항철도':'#0090D2','신분당선':'#D4003B','우이신설선':'#B7C452','수인분당선':'#F5A200','경춘선':'#0C8E72','경의중앙선':'#77C4A3','서해선':'#8FC31F','김포골드라인':'#AD8605','신림선':'#6789CA','GTX-A':'#9A6292'}

export async function extendRail(stations, routes, rawStations, directory) {
  const sourceIds = ['15041298','15041310','15041074','15081853','15081858','15041284','15041295','15041327','15041423','15041350','15041340','15041299']
  const tables = new Map()
  for (const id of sourceIds) {
    const text = new TextDecoder('euc-kr').decode(await readFile(path.join(directory,'rail',`${id}.csv`)))
    const rows = text.trim().split(/\r?\n/).slice(1).map(row => row.split(','))
    if (!rows.length || rows.some(row => row.length < 4 || !row[2])) throw new Error(`Invalid rail file ${id}`)
    tables.set(id, rows)
  }
  const names = id => tables.get(id).map(row => row[2])
  // Public master retains former names and infrastructure line designations.
  // Stable IDs stay unchanged; service membership is corrected from route evidence.
  const rename = {'seoul:1268':'한국항공대','seoul:1760':'능길','seoul:1723':'평택지제'}
  for (const station of stations) if (rename[station.id]) station.name = rename[station.id]
  const overrides = {'청량리':'1014','왕십리':'1013','이촌':'1008','옥수':'1011','상봉':'1202','대곡':'1953','지축':'0309','초지':'1758','서울역':'0150','부천종합운동장':'3754'}
  const byId = new Map(stations.map(s => [s.id,s]))
  const added = []
  function resolve(name,line) {
    const candidates = stations.filter(s => clean(s.name) === clean(name))
    const sameLine = candidates.filter(s => s.lines.includes(line))
    const operator = sameLine.filter(s => rawStations.some(r => `seoul:${r.bldn_id}` === s.id && r.route === '7호선(인천)'))
    const preferred = line === '1호선' && clean(name) === '청량리' ? '0158' : overrides[clean(name)]
    const found = operator.length === 1 ? operator[0] : sameLine.length === 1 ? sameLine[0] : candidates.length === 1 ? candidates[0] : byId.get(`seoul:${preferred}`)
    if (!found || clean(found.name)!==clean(name)) throw new Error(`Unresolved station: ${line} ${name}`)
    if (!found.lines.includes(line)) found.lines.push(line)
    return found.id
  }
  function add(line,suffix,stationNames) {
    if (stationNames.length < 2) throw new Error(`Empty route ${line}`)
    added.push({id:`rail:${line}:${suffix}`,name:line,color:colors[line],stationIds:stationNames.map(name => resolve(name,line))})
  }
  for (const [id,line] of [['15041298','9호선'],['15041310','공항철도'],['15041074','신분당선'],['15081853','우이신설선'],['15041284','수인분당선'],['15041423','3호선'],['15041350','4호선']]) add(line,'main',names(id))
  // 7/8 CSV rows are grouped by operator, not necessarily by travel order.
  const seven = names('15041340'), split = seven.indexOf('장암')
  if (split!==11) throw new Error('7호선 운영기관 경계 확인 필요')
  add('7호선','main',[...seven.slice(split),...seven.slice(0,split)])
  const eight = names('15041299'), amsa = eight.indexOf('암사')
  if (amsa!==6) throw new Error('8호선 별내선 순서 확인 필요')
  add('8호선','main',['별내','다산','동구릉','구리','장자호수공원','암사역사공원',...eight.slice(amsa)])
  // The Korail CSV omits the Seoul Metro section between Hoegi and Namyeong.
  const metroOne = routes.find(r => r.name==='1호선')
  const metroNames = [...metroOne.stationIds].reverse().map(id => byId.get(id).name)
  const korail = Map.groupBy(tables.get('15081858'),row=>row[1])
  for (const [line,rows] of korail) if (line.startsWith('1호선')) {
    const values = rows.map(row=>row[2]), gap=values.indexOf('남영')
    if (values[gap-1]!=='회기') throw new Error('1호선 운영기관 경계 확인 필요')
    add('1호선',line,[...values.slice(0,gap),...metroNames,...values.slice(gap)])
  }
  const central = names('15041327'), branch = central.indexOf('문산',central.indexOf('문산')+1)
  if (central[0]!=='도라산' || branch<0) throw new Error('경의중앙선 분기 확인 필요')
  // Dorasan is absent from the passenger station master; no invented coordinate.
  add('경의중앙선','main',central.slice(1,branch))
  add('경의중앙선','seoul',central.slice(branch))
  const chuncheon = names('15041295'), tail=chuncheon.lastIndexOf('상봉')
  if (tail<=chuncheon.indexOf('상봉')) throw new Error('경춘선 분기 확인 필요')
  add('경춘선','main',chuncheon.slice(0,tail));add('경춘선','gwangun',chuncheon.slice(tail))
  // Seoul map needs the northern Seohae approach through Gimpo Airport.
  add('서해선','north',korail.get('서해선').map(row=>row[2]))
  // Ordered station facts checked against the official city/operator pages below.
  add('신림선','main',['샛강','대방','서울지방병무청','보라매','보라매공원','보라매병원','당곡','신림','서원','서울대벤처타운','관악산'])
  add('김포골드라인','main',['양촌','구래','마산','장기','운양','걸포북변','사우','풍무','고촌','김포공항'])
  // Official GTX timetable still lists two separate operating sections. Never
  // connect Seoul-Suseo or expose Samsung just because the master has coordinates.
  for (const raw of rawStations.filter(s => s.route==='수도권 광역급행철도' && s.bldn_id!=='9006')) {
    const station={id:`seoul:${raw.bldn_id}`,name:raw.bldn_nm==='운정'?'운정중앙':raw.bldn_nm==='서울'?'서울역':raw.bldn_nm,lines:['GTX-A'],coordinate:[Number(raw.lot),Number(raw.lat)]}
    stations.push(station);byId.set(station.id,station)
  }
  add('GTX-A','north',['운정중앙','킨텍스','대곡','연신내','서울역']);add('GTX-A','south',['수서','성남','구성','동탄'])
  const replaced = new Set(['1호선','3호선','4호선','7호선','8호선'])
  const allRoutes=[...routes.filter(r=>!replaced.has(r.name)),...added]
  // Infrastructure names in the master mislabel the Yongsan-Wangsimni section
  // as Line 1. Use the verified passenger service memberships on covered stations.
  for (const station of stations) {
    const memberships=[...new Set(allRoutes.filter(r=>r.stationIds.includes(station.id)).map(r=>r.name))]
    if(memberships.length) station.lines=memberships
  }
  return {routes:allRoutes,files:sourceIds.map(id=>`rail/${id}.csv`),sources:[
    ...sourceIds.map(id=>({name:`국가철도공단 노선 자료 ${id}`,url:`https://www.data.go.kr/data/${id}/fileData.do`,license:'이용허락범위 제한 없음',attribution:'국가철도공단 · 2025년 역간거리 CSV · 2026-09-21 수집 · 운영기관 구간/분기 재구성'})),
    {name:'별내선 개통 안내',url:'https://mediahub.seoul.go.kr/archives/2011629',license:'역명·연결 순서 사실 참조',attribution:'서울특별시 · 별내선 6개 역 연결 순서 확인'},
    {name:'신림선 요금결정 자료',url:'https://ms.smc.seoul.kr/attach/record/SEOUL/appendix/a10/A0055967.pdf',license:'역명·연결 순서 사실 참조',attribution:'서울특별시의회 · 신림선 역 순서 확인 · 원문 이미지 미사용'},
    {name:'김포골드라인 안내',url:'https://mediahub.seoul.go.kr/archives/2012777',license:'역명·연결 순서 사실 참조',attribution:'서울특별시 · 김포골드라인 역 순서 확인'},
    {name:'GTX-A 운영 안내',url:'https://www.gtx-a.com/main.do',license:'운영구간 사실 참조',attribution:'GTX-A · 2026-09-21 운정중앙–서울역 / 수서–동탄 별도 운행 안내 확인 · 삼성역 제외'},
  ]}
}
