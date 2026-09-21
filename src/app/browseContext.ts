import { createContext, useContext, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type { StageFilterId } from '../domain/stages.ts'

export interface BrowseState {
  sort: 'default' | 'commute' | 'price' | 'name'
  stageFilter: StageFilterId
  showPassed: boolean
  selectedId: string | null
  listOpen: boolean
  listPage: number
}
export const initialBrowseState: BrowseState = {
  sort: 'default', stageFilter: 'all', showPassed: false, selectedId: null, listOpen: false, listPage: 0,
}
export const BrowseContext = createContext<{
  state: BrowseState
  setState: Dispatch<SetStateAction<BrowseState>>
  scrollTop: RefObject<number>
} | null>(null)

export function useBrowse() {
  const value = useContext(BrowseContext)
  if (!value) throw new Error('useBrowse requires BrowseProvider')
  return value
}
