import { expect, it } from 'vitest'
import { isGeneralApartment } from './housingType.ts'
import { MOCK_APARTMENTS } from '../mock/apartments.ts'
import { parseCatalogSnapshot } from './catalogSnapshot.ts'
import { mapSeoulApartment } from './providers/publicData.ts'

it('accepts confirmed apartments but not officetels, urban housing, mixed-use or unknown types', () => {
  const apartment = {...MOCK_APARTMENTS[0].apartment,housingType:'아파트'}
  expect(isGeneralApartment(apartment)).toBe(true)
  for (const housingType of [undefined,'미확인','오피스텔','도시형생활주택(아파트)','주상복합','연립주택']) {
    expect(isGeneralApartment({...apartment,housingType})).toBe(false)
  }
  expect(isGeneralApartment({...apartment,id:'kapt:A10095501',name:'동대문와이즈캐슬'})).toBe(false)
  expect(isGeneralApartment({...apartment,name:'테스트(도시형)'})).toBe(false)
})
it('preserves housing classification in persisted catalogs', () => {
  const record = mapSeoulApartment({kaptCode:'TEST',kaptName:'테스트',kaptAddr:'서울특별시 중구 신당동 1',bjdCode:'1114016200'},'2026-09-21T00:00:00.000Z')
  record.apartment.housingType = '아파트'
  expect(parseCatalogSnapshot({mode:'live',records:[record]}).records[0].apartment.housingType).toBe('아파트')
})
