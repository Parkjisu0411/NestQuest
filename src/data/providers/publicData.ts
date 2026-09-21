import { z } from 'zod'
import { SEOUL_AREAS } from '../seoulAreas.ts'
import type { DiscoverableApartment } from '../../domain/discover.ts'
import { ApiError, requestApi } from './http.ts'

const object = z.record(z.string(), z.unknown())
export function asObject(raw: unknown): Record<string, unknown> { const value = object.safeParse(raw); if (!value.success) throw new ApiError('응답 데이터 구조가 올바르지 않습니다.', 'format'); return value.data }
function string(raw: unknown): string { return typeof raw === 'string' || typeof raw === 'number' ? String(raw).trim() : '' }
export function publicBody(raw: unknown): Record<string, unknown> {
  const root = asObject(raw)
  if (root.OpenAPI_ServiceResponse) throw new ApiError('공공데이터 인증 또는 활용 승인을 확인해 주세요.', 'auth')
  const response = asObject(root.response ?? root)
  const header = asObject(response.header)
  const code = string(header.resultCode)
  if (code !== '00' && code !== '000' && code !== '0') {
    if (['22','23'].includes(code)) throw new ApiError('공공데이터 호출 한도를 초과했습니다.', 'limit')
    if (['20','30','31'].includes(code)) throw new ApiError('공공데이터 키와 활용 승인을 확인해 주세요.', 'auth')
    throw new ApiError(`공공데이터 조회 실패 (코드 ${/^\d+$/.test(code) ? code : '미확인'})`)
  }
  return asObject(response.body)
}
export function bodyItems(body: Record<string, unknown>): Record<string, unknown>[] {
  if (body.items === '' || body.items === undefined || body.items === null) return []
  const container = body.items
  const items = Array.isArray(container) ? container : asObject(container).item ?? []
  return (Array.isArray(items) ? items : [items]).map(asObject)
}
export function decodeServiceKey(value: string) {
  try { return value.includes('%') ? decodeURIComponent(value.trim()) : value.trim() }
  catch { throw new ApiError('공공데이터 일반 인증키(Decoding)를 입력해 주세요.', 'auth') }
}
export function mapSeoulApartment(raw: Record<string, unknown>, fetchedAt: string): DiscoverableApartment {
  const code = string(raw.kaptCode)
  const name = string(raw.kaptName)
  const address = string(raw.kaptAddr || raw.kaptAddress || raw.doroJuso || raw.as3)
  const legalCode = string(raw.bjdCode)
  const district = string(raw.as2)
  const area = SEOUL_AREAS.find((area) => area.sigunguCode === legalCode.slice(0, 5)) ?? SEOUL_AREAS.find((area) => area.sigunguName === district || address.includes(` ${area.sigunguName} `))
  if (!code || !name || !area) throw new ApiError('단지 코드·이름·서울 자치구를 확인할 수 없는 응답입니다.', 'format')
  const fallbackAddress = [string(raw.as1), district, string(raw.as3), string(raw.as4)].filter(Boolean).join(' ')
  const apartmentAddress = string(raw.kaptAddr || raw.kaptAddress || raw.doroJuso) || fallbackAddress
  if (!apartmentAddress) throw new ApiError('단지 주소를 확인할 수 없습니다.', 'format')
  return { apartment: { id: `kapt:${code}`, externalId: code, name, address: apartmentAddress, createdAt: fetchedAt, updatedAt: fetchedAt },
    area, unitTypes: [], commutes: [], source: { provider: '국토교통부 공동주택 단지 목록', fetchedAt } }
}

export async function fetchSeoulApartments(key: string, signal: AbortSignal, progress: (message: string) => void): Promise<DiscoverableApartment[]> {
  if (!key.trim()) throw new ApiError('공공데이터 API 키를 먼저 입력해 주세요.', 'auth')
  const rows = new Map<string, DiscoverableApartment>()
  const fetchedAt = new Date().toISOString()
  let received = 0
  for (let page = 1; page <= 500; page++) {
    const body = publicBody(await requestApi('list', { serviceKey: decodeServiceKey(key), sidoCode: '11', pageNo: String(page), numOfRows: '100' }, signal))
    const total = Number(body.totalCount)
    if (!Number.isSafeInteger(total) || total < 0 || total > 50000) throw new ApiError('단지 목록의 전체 건수를 확인할 수 없습니다.', 'format')
    const items = bodyItems(body)
    for (const item of items) { const record = mapSeoulApartment(item, fetchedAt); rows.set(record.apartment.id, record) }
    received += items.length
    progress(`서울 단지 ${received.toLocaleString()} / ${total.toLocaleString()}건 조회`)
    if (received >= total) {
      if (rows.size !== total) throw new ApiError('단지 목록에 중복 또는 누락이 있습니다. 다시 조회해 주세요.', 'format')
      return [...rows.values()]
    }
    if (!items.length) throw new ApiError('단지 목록이 중간에 끊겼습니다. 기존 자료를 유지합니다.', 'format')
    await new Promise((resolve) => setTimeout(resolve, 250))
    signal.throwIfAborted()
  }
  throw new ApiError('단지 목록 조회 범위를 초과했습니다.', 'format')
}
