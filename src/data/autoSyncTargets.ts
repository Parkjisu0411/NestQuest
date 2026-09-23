import type { DiscoverableApartment } from '../domain/discover.ts'
import type { CommuteDestination, QuestState } from '../domain/models.ts'
import { needsCommute, needsDetail } from './syncPlan.ts'

/** Reserve background slots for unseen districts, independently of visible results. */
export function autoSyncTargets(records: DiscoverableApartment[], states: Record<string,QuestState>, areas: Set<string>, visible: string[] = [], selected?: string, full = false, destination?: CommuteDestination) {
  const eligible = records.filter(r=>r.apartment.externalId && (areas.has(r.area.sigunguCode) || r.apartment.id === selected || ['SHORTLIST','CANDIDATE','VISITED'].includes(states[r.apartment.id]?.stage)))
  if (full) return records.filter(r=>r.apartment.externalId && areas.has(r.area.sigunguCode))
  const byId = new Map(eligible.map(r=>[r.apartment.id,r]))
  const priorities: string[] = []
  if (selected && byId.has(selected)) priorities.push(selected)
  for (const stage of ['SHORTLIST','CANDIDATE','VISITED']) for (const r of eligible) if (states[r.apartment.id]?.stage === stage) priorities.push(r.apartment.id)
  const ids = new Set(priorities.slice(0,25))
  const pending = new Map<string, DiscoverableApartment[]>()
  for (const r of eligible) {
    if (!areas.has(r.area.sigunguCode) || !(needsDetail(r) || needsCommute(r,destination)) || ids.has(r.apartment.id)) continue
    const group = pending.get(r.area.sigunguCode) ?? []
    group.push(r)
    pending.set(r.area.sigunguCode,group)
  }
  // Least-covered districts first, then one apartment per district per round.
  const groups = [...pending.entries()].sort(([a, left],[b, right]) => {
    const totalA = eligible.filter(r=>r.area.sigunguCode===a).length
    const totalB = eligible.filter(r=>r.area.sigunguCode===b).length
    return right.length/totalB - left.length/totalA || a.localeCompare(b)
  }).map(([,group])=>group)
  let added = 0
  for (let round=0; added<25 && groups.some(group=>round<group.length); round++) {
    for (const group of groups) {
      if (group[round]) { ids.add(group[round].apartment.id); added++ }
      if (added===25) break
    }
  }
  for (const id of [...priorities,...visible]) if (byId.has(id) && ids.size<50) ids.add(id)
  if (!visible.length) for (const r of eligible) {
    if (ids.size>=Math.max(20,added)) break
    ids.add(r.apartment.id)
  }
  return [...ids].map(id=>byId.get(id)!).slice(0,50)
}
