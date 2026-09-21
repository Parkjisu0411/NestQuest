import { z } from 'zod'
import { ApiError, requestApi } from './http.ts'
import { DAY, readProviderCache, writeProviderCache } from '../providerCache.ts'
const coordinate = z.union([z.number(), z.string().trim().min(1)]).transform(Number).pipe(z.number().finite())
const responseSchema = z.object({ documents: z.array(z.object({ address_name: z.string(), x: coordinate, y: coordinate })) })
export async function geocode(address: string, key: string, signal?: AbortSignal, refresh = false): Promise<{ latitude: number; longitude: number } | null> {
  if (!key.trim()) throw new ApiError('Kakao REST API 키를 입력해 주세요.', 'auth')
  if (!address.trim()) throw new ApiError('정확한 단지 주소가 필요합니다.', 'format')
  signal?.throwIfAborted()
  const cacheKey = `geocode:v1:${address.trim()}`
  const cached = refresh ? undefined : await readProviderCache(cacheKey, 30 * DAY, raw => z.object({ latitude:z.number().min(33).max(39), longitude:z.number().min(124).max(132) }).nullable().parse(raw))
  signal?.throwIfAborted()
  if (cached !== undefined) return cached
  const result = responseSchema.safeParse(await requestApi('geocode', { query: address.trim(), analyze_type: 'exact' }, signal, { Authorization: 'KakaoAK ' + key.trim() }))
  if (!result.success) throw new ApiError('주소 변환 응답 형식이 올바르지 않습니다.', 'format')
  if (!result.data.documents.length) { await writeProviderCache(cacheKey, null); return null }
  if (result.data.documents.length !== 1) throw new ApiError('주소 위치를 하나로 확인할 수 없습니다.', 'format')
  const { x: longitude, y: latitude } = result.data.documents[0]
  if (longitude<124 || longitude>132 || latitude<33 || latitude>39) throw new ApiError('주소 좌표가 국내 범위를 벗어났습니다.', 'format')
  const position = { longitude, latitude }
  await writeProviderCache(cacheKey, position)
  signal?.throwIfAborted()
  return position
}
