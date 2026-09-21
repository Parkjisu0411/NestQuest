import { CapacitorHttp } from '@capacitor/core'
import { isAndroidApp } from '../../platform/native.ts'
import { PersistError } from '../../persistence/errors.ts'
import { XMLParser, XMLValidator } from 'fast-xml-parser'

export const ENDPOINTS = {
  geocode: 'https://dapi.kakao.com/v2/local/search/address.json',
  list: 'https://apis.data.go.kr/1613000/AptListService4/getSidoAptList4',
  detail: 'https://apis.data.go.kr/1613000/AptBasisInfoServiceV5/getAphusDtlInfoV5',
  basic: 'https://apis.data.go.kr/1613000/AptBasisInfoServiceV5/getAphusBassInfoV5',
  trades: 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev',
  commute: 'https://dapi.kakao.com/v2/routing/publictraffic',
} as const
export type Endpoint = keyof typeof ENDPOINTS
export class ApiError extends PersistError {
  readonly kind: 'auth' | 'limit' | 'network' | 'format' | 'no-route'
  constructor(message: string, kind: ApiError['kind'] = 'network') { super(message); this.kind = kind }
}
export function pauseProviderRequests(signal: AbortSignal, milliseconds = 400): Promise<void> {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException('조회 취소', 'AbortError')) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, milliseconds)
    signal.addEventListener('abort', abort, { once: true })
  })
}
export function parseApiBody(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw
  const source = raw.trim()
  if (source.length > 20_000_000 || /<!DOCTYPE|<!ENTITY/i.test(source)) throw new ApiError('응답 크기 또는 형식이 올바르지 않습니다.', 'format')
  try {
    if (source.startsWith('<')) {
      if (XMLValidator.validate(source) !== true) throw new Error()
      return new XMLParser({ parseTagValue: false, trimValues: true, processEntities: true }).parse(source)
    }
    return JSON.parse(source)
  } catch { throw new ApiError('API 응답을 읽을 수 없습니다.', 'format') }
}
export async function requestApi(endpoint: Endpoint, params: Record<string, string>, signal?: AbortSignal, headers?: Record<string, string>): Promise<unknown> {
  signal?.throwIfAborted()
  try {
    let status: number; let raw: unknown
    if (isAndroidApp()) {
      const result = await CapacitorHttp.get({ url: ENDPOINTS[endpoint], params, headers, responseType: 'text', connectTimeout: 15000, readTimeout: 20000 })
      status = result.status; raw = result.data
    } else {
      const result = await fetch(`/api/provider/${endpoint}?${new URLSearchParams(params)}`, { headers, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000), cache: 'no-store' })
      status = result.status; raw = await result.text()
    }
    signal?.throwIfAborted()
    if (status === 429) throw new ApiError('조회 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.', 'limit')
    if (status === 401 || status === 403) throw new ApiError('API 키·활용 승인·등록 도메인을 확인해 주세요.', 'auth')
    if (status < 200 || status >= 300) throw new ApiError('정보 제공 서비스에 연결하지 못했습니다.')
    return parseApiBody(raw)
  } catch (error) {
    if (signal?.aborted) throw new DOMException('조회 취소', 'AbortError')
    if (error instanceof ApiError) throw error
    throw new ApiError('네트워크 연결 또는 서비스 응답을 확인해 주세요.')
  }
}
