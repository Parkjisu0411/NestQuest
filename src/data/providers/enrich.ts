import type { DiscoverableApartment } from '../../domain/discover.ts'
import type { ApartmentUnitType, CommuteDestination, CommuteEstimate, Transaction } from '../../domain/models.ts'
import { normalizeApartmentFacts } from '../normalizeApartment.ts'
import { asObject, bodyItems, decodeServiceKey, publicBody } from './publicData.ts'
import { ApiError, requestApi } from './http.ts'
import { z } from 'zod'
import { comparableApartmentName, seoulLotAddress } from './address.ts'
import { DAY, readProviderCache, tradeMonthCacheDays, writeProviderCache } from '../providerCache.ts'

const text = (raw: unknown) => typeof raw === 'string' || typeof raw === 'number' ? String(raw).trim() : ''
export async function fetchDetail(record: DiscoverableApartment, key: string, signal: AbortSignal): Promise<DiscoverableApartment> {
  if (!record.apartment.id.startsWith('kapt:') || !record.apartment.externalId) return record
  if (!key.trim()) throw new ApiError('공공데이터 API 키를 먼저 입력해 주세요.', 'auth')
  const params = { ServiceKey: decodeServiceKey(key), kaptCode: record.apartment.externalId }
  const body = publicBody(await requestApi('basic', params, signal))
  const raw = body.item ? asObject(body.item) : bodyItems(body)[0]
  if (!raw) throw new ApiError('단지 상세정보가 없습니다.', 'format')
  if (text(raw.kaptCode) !== record.apartment.externalId) throw new ApiError('요청한 단지와 응답의 코드가 다릅니다.', 'format')
  if (!text(raw.kaptAddr)) throw new ApiError('정확한 단지 주소가 없어 위치를 확정하지 않았습니다.', 'format')
  const detailBody = publicBody(await requestApi('detail', params, signal))
  const detail = detailBody.item ? asObject(detailBody.item) : bodyItems(detailBody)[0]
  if (!detail || text(detail.kaptCode) !== record.apartment.externalId) throw new ApiError('상세 응답의 단지 코드를 확인할 수 없습니다.', 'format')
  const groundParking = text(detail.kaptdPcnt), undergroundParking = text(detail.kaptdPcntu)
  const parkingCount = /^\d+$/.test(groundParking) && /^\d+$/.test(undergroundParking) ? Number(groundParking) + Number(undergroundParking) : undefined
  const approval = text(raw.kaptUsedate)
  const now = new Date().toISOString()
  const result = normalizeApartmentFacts({ name: text(raw.kaptName) || record.apartment.name, address: text(raw.kaptAddr) || record.apartment.address,
    householdCount: raw.kaptdaCnt, buildingCount: raw.kaptDongCnt, heatingType: raw.codeHeatNm,
    parkingCount, approvalDate: /^\d{8}$/.test(approval) ? `${approval.slice(0,4)}-${approval.slice(4,6)}-${approval.slice(6)}` : undefined,
    source: { provider: 'kapt', externalId: record.apartment.externalId, fetchedAt: now } })
  if (!result.ok) throw new ApiError('단지 상세정보의 값이 올바르지 않습니다.', 'format')
  return { ...record, apartment: { ...record.apartment, ...result.value.facts, housingType: text(raw.codeAptNm) || '미확인', ...(text(raw.doroJuso) ? { roadAddress: text(raw.doroJuso) } : {}), updatedAt: now }, source: { provider: '국토교통부 공동주택 기본정보', fetchedAt: now } }
}

export interface TradeRow { aptSeq: string; name: string; districtCode: string; dong: string; lot: string; transaction: Omit<Transaction, 'apartmentId'> }
export function parseTradeRows(body: Record<string, unknown>, districtCode: string): TradeRow[] {
  return bodyItems(body).map((raw) => {
    const aptSeq = text(raw.aptSeq), dong = text(raw.umdNm), lot = text(raw.jibun), name = text(raw.aptNm)
    const contractDate = `${text(raw.dealYear)}-${text(raw.dealMonth).padStart(2, '0')}-${text(raw.dealDay).padStart(2, '0')}`
    const exclusiveArea = Number(raw.excluUseAr), price = Number(text(raw.dealAmount).replaceAll(',', '')) * 10000
    if (!aptSeq || !dong || !lot || !name || !z.iso.date().safeParse(contractDate).success || !Number.isFinite(exclusiveArea) || exclusiveArea <= 0 || !Number.isSafeInteger(price) || price <= 0) throw new ApiError('실거래 응답 형식이 올바르지 않습니다.', 'format')
    const floor = Number(raw.floor)
    if (!Number.isInteger(floor)) throw new ApiError('거래 층 정보가 올바르지 않습니다.', 'format')
    const canceled = text(raw.cdealType) === 'O' || text(raw.cdealDay) !== ''
    // Public rows may describe two identical sales; retain row multiplicity during fetch.
    return { aptSeq, dong, lot, name, districtCode, transaction: { id: `rtms:${aptSeq}:${contractDate}:${exclusiveArea}:${floor}:${price}`, exclusiveArea, floor, price, contractDate, canceled } }
  })
}
export function attachTrades(record: DiscoverableApartment, rows: TradeRow[], now: string): DiscoverableApartment {
  const lotAddress = seoulLotAddress(record.apartment.address)
  const matches = rows.filter((row) => lotAddress && row.districtCode === record.area.sigunguCode && comparableApartmentName(row.name) === comparableApartmentName(record.apartment.name)
    && lotAddress === seoulLotAddress(`${record.area.sidoName} ${record.area.sigunguName} ${row.dong} ${row.lot}`))
  if (new Set(matches.map((row) => row.aptSeq)).size > 1) throw new ApiError('같은 주소에 여러 실거래 단지가 있어 자동 연결하지 않았습니다.', 'format')
  if (!matches.length) return record.transactions ? { ...record, transactions: [], unitTypes: record.unitTypes.map((unit) => {
    const next = { ...unit }; delete next.priceEstimate; return next
  }) } : record
  const transactions = matches.map((row, index) => ({ ...row.transaction, id: `${row.transaction.id}:${index}`, apartmentId: record.apartment.id }))
  const canceledKeys = new Set(matches.filter((row) => row.transaction.canceled).map((row) => row.transaction.id))
  const groups = new Map<number, Transaction[]>()
  for (const [index, transaction] of transactions.entries()) {
    if (transaction.canceled || canceledKeys.has(matches[index].transaction.id)) continue
    const bucket = groups.get(transaction.exclusiveArea) ?? []; bucket.push(transaction); groups.set(transaction.exclusiveArea, bucket)
  }
  const unitTypes: ApartmentUnitType[] = [...groups].map(([area, sales]) => {
    const prices = sales.map((sale) => sale.price).sort((a,b) => a-b)
    const middle = Math.floor(prices.length/2)
    const estimatedPrice = prices.length % 2 ? prices[middle] : (prices[middle-1]+prices[middle])/2
    const id = `${record.apartment.id}:area:${area}`
    const latest = [...sales].sort((a,b) => b.contractDate.localeCompare(a.contractDate))[0]
    return { id, apartmentId: record.apartment.id, areaGroup: Math.round(area), exclusiveAreas: [area], priceEstimate: {
      apartmentId: record.apartment.id, unitTypeId: id, estimatedPrice, lowPrice: prices[0], highPrice: prices.at(-1)!, latestPrice: latest.price,
      transactionCount: prices.length, periodMonths: 12, confidence: prices.length >= 10 ? 'HIGH' : prices.length >= 3 ? 'MEDIUM' : 'LOW', calculatedAt: now,
    } }
  })
  return { ...record, unitTypes, transactions: transactions.map((transaction,index) => {
    const unit=unitTypes.find(unit=>unit.exclusiveAreas.includes(transaction.exclusiveArea))
    return { ...transaction, canceled: transaction.canceled || canceledKeys.has(matches[index].transaction.id), ...(unit ? {unitTypeId:unit.id} : {}) }
  }) }
}

/** One external trade complex must not silently attach to multiple catalog records. */
export function attachDistrictTrades(records: readonly DiscoverableApartment[], rows: TradeRow[], now: string): DiscoverableApartment[] {
  const candidates = records.map((record) => {
    try { return attachTrades(record, rows, now) }
    catch (error) {
      // An ambiguous identity belongs to this apartment, not to the entire district.
      // Clear its old estimate rather than leaving a previously matched price behind.
      if (!(error instanceof ApiError) || error.kind !== 'format') throw error
      return { ...record, transactions: [], unitTypes: record.unitTypes.map((unit) => {
        const next = { ...unit }; delete next.priceEstimate; return next
      }) }
    }
  })
  const owners = new Map<string, Set<string>>()
  for (const record of candidates) {
    for (const transaction of record.transactions ?? []) {
      const externalId = transaction.id.split(':')[1]
      const ids = owners.get(externalId) ?? new Set<string>(); ids.add(record.apartment.id); owners.set(externalId, ids)
    }
  }
  return candidates.map((record) => (record.transactions ?? []).some((transaction) => (owners.get(transaction.id.split(':')[1])?.size ?? 0) > 1)
    ? { ...record, transactions: [], unitTypes: record.unitTypes.map((unit) => { const next = { ...unit }; delete next.priceEstimate; return next }) }
    : record)
}
const cachedTradeRows = z.array(z.object({
  aptSeq:z.string().min(1), name:z.string().min(1), districtCode:z.string().regex(/^11\d{3}$/), dong:z.string().min(1), lot:z.string().min(1),
  transaction:z.object({ id:z.string().min(1), exclusiveArea:z.number().positive(), price:z.number().positive().int(), floor:z.number().int(), contractDate:z.iso.date(), canceled:z.boolean() }),
}))
export async function fetchDistrictTrades(districtCode: string, key: string, signal: AbortSignal, progress: (message: string) => void, refresh = false): Promise<TradeRow[]> {
  if (!key.trim()) throw new ApiError('공공데이터 API 키를 먼저 입력해 주세요.', 'auth')
  if (!/^11\d{3}$/.test(districtCode)) throw new ApiError('서울 자치구 코드가 필요합니다.', 'format')
  const today = new Date()
  const all: TradeRow[] = []
  for (let offset = 0; offset < 12; offset++) {
    const month = new Date(today.getFullYear(), today.getMonth()-offset, 1)
    const ymd = `${month.getFullYear()}${String(month.getMonth()+1).padStart(2,'0')}`
    signal.throwIfAborted()
    const cacheKey = `trades:v1:${districtCode}:${ymd}`
    const cached = refresh ? undefined : await readProviderCache(cacheKey, tradeMonthCacheDays(ymd, today) * DAY, raw => {
      const rows = cachedTradeRows.parse(raw)
      if (rows.some(row => row.districtCode !== districtCode || row.transaction.contractDate.slice(0,7).replace('-','') !== ymd)) throw new Error('캐시 범위 불일치')
      return rows
    })
    signal.throwIfAborted()
    if (cached !== undefined) { all.push(...cached); continue }
    const monthRows: TradeRow[] = []
    let received = 0
    for (let page = 1; page <= 100; page++) {
      signal.throwIfAborted()
      progress(`${districtCode} · ${ymd} 실거래 ${page}페이지 조회`)
      const body = publicBody(await requestApi('trades', { serviceKey: decodeServiceKey(key), LAWD_CD: districtCode, DEAL_YMD: ymd, pageNo: String(page), numOfRows: '1000' }, signal))
      const total = Number(body.totalCount), rows = parseTradeRows(body, districtCode)
      if (!Number.isSafeInteger(total) || total < 0 || total > 100000) throw new ApiError('실거래 전체 건수가 올바르지 않습니다.', 'format')
      monthRows.push(...rows)
      received += rows.length
      if (received >= total) break
      if (!rows.length || page === 100) throw new ApiError('실거래 응답이 중간에 끊겼습니다.', 'format')
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    signal.throwIfAborted()
    await writeProviderCache(cacheKey, monthRows)
    all.push(...monthRows)
  }
  return all
}


const routeSchema = z.object({ status: z.literal('OK'), routes: z.array(z.object({
  properties: z.object({ type: z.enum(['BUS','SUBWAY','BUS_AND_SUBWAY']), totalTime: z.number().nonnegative(), transfers: z.number().int().nonnegative() }),
  steps: z.array(z.object({ properties: z.object({ type: z.enum(['BUS','SUBWAY','WALKING']), time: z.number().nonnegative(),
    stops: z.array(z.object({ name: z.string() })).optional(), vehicles: z.array(z.object({ name: z.string() })).optional() }) }))
})) })
export async function fetchCommute(record: DiscoverableApartment, destination: CommuteDestination, key: string, signal: AbortSignal): Promise<CommuteEstimate> {
  if (!key.trim()) throw new ApiError('카카오 REST API 키를 등록해 주세요.', 'auth')
  if (record.apartment.latitude === undefined || record.apartment.longitude === undefined) throw new ApiError('단지 위치를 먼저 확인해 주세요.', 'format')
  const raw = asObject(await requestApi('commute', { start_x: String(record.apartment.longitude), start_y: String(record.apartment.latitude),
    end_x: String(destination.longitude), end_y: String(destination.latitude), input_coord: 'WGS84' }, signal, { Authorization: 'KakaoAK ' + key }))
  if (raw.code !== undefined) {
    const code = Number(raw.code)
    if (code === -10) throw new ApiError('카카오 대중교통 조회 한도에 도달했습니다. 한도 갱신 후 다시 조회해 주세요.', 'limit')
    if ([-401,-403,-5,-101].includes(code)) throw new ApiError('카카오 REST 키와 카카오맵 사용 설정을 확인해 주세요.', 'auth')
    if (code === -2) throw new ApiError('카카오 통근 요청 좌표를 확인해 주세요.', 'format')
    throw new ApiError('카카오 경로 서비스에 연결하지 못했습니다.', 'network')
  }
  if (['NO_RESULTS','STARTNODES_NULL','ENDNODES_NULL','EQUAL_POINTS'].includes(String(raw.status))) throw new ApiError('카카오에서 대중교통 경로를 찾지 못했습니다.', 'no-route')
  if (raw.status === 'INVALID_REQUEST') throw new ApiError('카카오 통근 요청 좌표를 확인해 주세요.', 'format')
  const parsed = routeSchema.safeParse(raw)
  if (!parsed.success) throw new ApiError('카카오 통근 경로 응답 형식이 올바르지 않습니다.', 'format')
  const route = [...parsed.data.routes].sort((a,b) => a.properties.totalTime-b.properties.totalTime)[0]
  if (!route) throw new ApiError('대중교통 경로가 없습니다.', 'no-route')
  const segments = route.steps.map(({ properties: part }) => ({ type: (part.type === 'WALKING' ? 'WALK' : part.type) as CommuteEstimate['route'][number]['type'],
    durationMinutes: part.time / 60, from: part.stops?.[0]?.name || undefined, to: part.stops?.at(-1)?.name || undefined,
    lineName: part.vehicles?.map(vehicle => vehicle.name).filter(Boolean).join(' / ') || undefined }))
  return { apartmentId: record.apartment.id, destinationId: destination.id, provider: 'Kakao', calculatedAt: new Date().toISOString(),
    totalMinutes: Math.round(route.properties.totalTime / 60), transferCount: route.properties.transfers,
    walkingMinutes: Math.round(segments.filter(part => part.type === 'WALK').reduce((sum,part) => sum+part.durationMinutes,0)), route: segments }
}
