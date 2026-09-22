import type { DiscoverableApartment } from '../domain/discover.ts'
import type { QuestState } from '../domain/models.ts'
/** Explicit selection first; bounded background work never hydrates all Seoul at launch. */
export function autoSyncTargets(records: DiscoverableApartment[], states: Record<string,QuestState>, areas: Set<string>, visible: string[] = [], selected?: string, full = false) {
  const eligible = records.filter(r=>r.apartment.externalId && (areas.has(r.area.sigunguCode) || r.apartment.id === selected || ['SHORTLIST','CANDIDATE','VISITED'].includes(states[r.apartment.id]?.stage)))
  if (full) return records.filter(r=>r.apartment.externalId && areas.has(r.area.sigunguCode))
  const byId = new Map(eligible.map(r=>[r.apartment.id,r]))
  const ids = new Set<string>()
  if (selected) ids.add(selected)
  for (const stage of ['SHORTLIST','CANDIDATE','VISITED']) for (const r of eligible) if (states[r.apartment.id]?.stage === stage) ids.add(r.apartment.id)
  for (const id of visible) ids.add(id)
  // A fresh, unseeded catalog has no classified/visible apartments yet.
  if (!visible.length) for (const r of eligible.slice(0,20)) ids.add(r.apartment.id)
  return [...ids].flatMap(id=>byId.has(id)?[byId.get(id)!]:[]).slice(0,50)
}
