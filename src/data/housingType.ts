import type { Apartment } from '../domain/models.ts'

// K-apt can group multiple uses under one complex. This verified mixed complex
// contains urban housing + officetels, not the user's intended general apartments.
// https://fin.land.naver.com/complexes/106449
const NON_GENERAL_COMPLEXES = new Set(['kapt:A10095501'])
export function isGeneralApartment(apartment: Apartment): boolean {
  if (NON_GENERAL_COMPLEXES.has(apartment.id)) return false
  return apartment.housingType?.replace(/\s+/g, '') === '아파트'
    && !/도시형|오피스텔/.test(apartment.name)
}
