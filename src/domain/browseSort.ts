import type { DiscoverMatch } from './discover.ts'
import type { QuestState, QuestStage, Visit } from './models.ts'
import type { StageFilterId } from './stages.ts'

export type BrowseSort = 'default' | 'commute' | 'price' | 'name'
export interface SortableApartment { match: DiscoverMatch; stage: QuestStage }
export const MAP_STAGE_ORDER: Record<QuestStage, number> = { SHORTLIST:0, VISITED:1, CANDIDATE:2, DISCOVERED:3, PASSED:4 }
const finite = (value: number | undefined) => value !== undefined && Number.isFinite(value) ? value : Infinity
const date = (value?: string) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0

export function sortBrowseItems<T extends SortableApartment>(items: T[], sort: BrowseSort, tab: StageFilterId, states: Record<string, QuestState>, visits: Record<string, Visit[]>): T[] {
  return [...items].sort((a,b) => {
    const excluded = Number(a.stage === 'PASSED') - Number(b.stage === 'PASSED')
    if (excluded) return excluded
    const aId = a.match.apartment.id, bId = b.match.apartment.id
    let difference = 0
    if (sort === 'default' && tab === 'shortlist') difference = finite(states[aId]?.shortlistRank) - finite(states[bId]?.shortlistRank)
    else if (sort === 'default' && tab === 'candidate') difference = date(states[bId]?.candidateAt ?? states[bId]?.updatedAt) - date(states[aId]?.candidateAt ?? states[aId]?.updatedAt)
    else if (sort === 'default' && tab === 'visited') {
      const latest = (id: string) => Math.max(0,...(visits[id] ?? []).map(visit => date(visit.visitedAt)))
      difference = latest(bId) - latest(aId)
    } else if (sort === 'price') difference = finite(a.match.displayUnit?.priceEstimate?.estimatedPrice) - finite(b.match.displayUnit?.priceEstimate?.estimatedPrice)
    else if (sort !== 'name') difference = finite(a.match.commute ? Math.round(a.match.commute.totalMinutes) : undefined) - finite(b.match.commute ? Math.round(b.match.commute.totalMinutes) : undefined)
    return (Number.isNaN(difference) ? 0 : difference) || a.match.apartment.name.localeCompare(b.match.apartment.name,'ko') || aId.localeCompare(bId)
  })
}

/** Keep existing rows in place as API values arrive; append new matches within their section. */
export function preserveBrowseOrder<T extends SortableApartment>(items: T[], ids: string[]): T[] {
  const order = new Map(ids.map((id,index) => [id,index]))
  return [...items].sort((a,b) => Number(a.stage === 'PASSED') - Number(b.stage === 'PASSED') ||
    (order.get(a.match.apartment.id) ?? Infinity) - (order.get(b.match.apartment.id) ?? Infinity))
}
