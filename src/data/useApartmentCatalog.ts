import { useMemo } from 'react'
import { useQuestState } from '../app/useQuest.ts'
import { catalogForState } from './apartments.ts'
import { createApartmentCatalog } from './apartmentCatalog.ts'
import { commuteQueryKey, useCommuteQueries } from './commuteSession.ts'
import { savedCommute, storedCommute, commuteIsFresh } from './commuteCache.ts'
import { isGeneralApartment } from './housingType.ts'

export function useApartmentCatalog() {
  const state = useQuestState()
  const queries = useCommuteQueries()
  return useMemo(() => {
    const catalog = catalogForState(state)
    const destination = state.quest?.searchCriteria.commuteDestination
    const enriched = !destination ? catalog : createApartmentCatalog(catalog.list().map((record) => {
      const result = queries.get(commuteQueryKey(record.apartment, destination))
      const estimate = savedCommute(record, destination) ?? (result?.status === 'success' && result.estimate && commuteIsFresh(result.estimate) ? result.estimate : undefined) ?? storedCommute(record,destination)
      return { ...record, commutes: estimate ? [estimate] : [] }
    }), catalog.mode)
    // Hide non-general/unknown types from browsing while keeping existing records
    // reachable by ID for visit history; this is not a destructive migration.
    const visible = enriched.list().filter(record => isGeneralApartment(record.apartment))
    return { ...enriched, list: () => visible }
  }, [state, queries])
}
