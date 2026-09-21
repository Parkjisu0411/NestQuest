import { expect, it, vi } from 'vitest'
import { geocodeApartment } from './geocodeApartment.ts'
import { ApiError } from './http.ts'

const apartment={roadAddress:'서울특별시 강북구 시험로 1',address:'서울특별시 강북구 미아동 123-4 시험아파트'}
it.each([null,new ApiError('합성 복수 주소','format')])('falls back to the exact lot when a road address is unresolved',async(first)=>{
  const lookup=vi.fn().mockImplementationOnce(async()=>{if(first instanceof Error)throw first;return first}).mockResolvedValueOnce({latitude:37.6,longitude:127})
  expect(await geocodeApartment(apartment,lookup)).toEqual({latitude:37.6,longitude:127})
  expect(lookup.mock.calls.map(c=>c[0])).toEqual([apartment.roadAddress,'서울특별시 강북구 미아동 123-4'])
})
it('keeps missing locations unknown and does not retry the same address',async()=>{
  const lookup=vi.fn().mockResolvedValue(null)
  expect(await geocodeApartment({address:'서울특별시 강북구 미아동 123-4'},lookup)).toBeNull()
  expect(lookup).toHaveBeenCalledTimes(1)
})
it.each(['limit','auth','network'] as const)('stops without fallback on %s',async(kind)=>{
  const lookup=vi.fn().mockRejectedValue(new ApiError('synthetic',kind))
  await expect(geocodeApartment(apartment,lookup)).rejects.toMatchObject({kind})
  expect(lookup).toHaveBeenCalledTimes(1)
})
