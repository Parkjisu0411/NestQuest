import type { Apartment } from '../../domain/models.ts'
import { seoulLotAddress } from './address.ts'
import { ApiError } from './http.ts'

/** Try two independently supplied addresses; never choose among ambiguous hits. */
export async function geocodeApartment(
  apartment: Pick<Apartment, 'address' | 'roadAddress'>,
  lookup: (address: string) => Promise<{ latitude: number; longitude: number } | null>,
) {
  const addresses = [...new Set([apartment.roadAddress?.trim(), seoulLotAddress(apartment.address) ?? apartment.address.trim()].filter((s): s is string => !!s))]
  for (const address of addresses) {
    try {
      const coordinate = await lookup(address)
      if (coordinate) return coordinate
    } catch (error) {
      if (!(error instanceof ApiError) || error.kind !== 'format') throw error
      // A road address can describe several buildings. The full legal lot may
      // identify this complex uniquely; otherwise leave the location unknown.
    }
  }
  return null
}
