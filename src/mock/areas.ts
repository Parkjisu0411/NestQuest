import { METRO_AREAS } from '../data/metroAreas.ts'
import type { QuestArea } from '../domain/models.ts'
export interface SetupAreaRegion extends QuestArea { shortLabel:string; ring:'seoul'|'metro'; path:string; labelX:number; labelY:number }
export const SETUP_AREA_REGIONS:SetupAreaRegion[]=METRO_AREAS.map(a=>({...a,shortLabel:a.sigunguName,ring:a.sidoCode==='11'?'seoul':'metro',path:'',labelX:0,labelY:0}))
export const SEOUL_SIDO_CODE = '11'
export const GYEONGGI_SIDO_CODE = '41'
export const INCHEON_SIDO_CODE = '28'

export function toQuestArea(region: SetupAreaRegion): QuestArea {
  return {
    sidoCode: region.sidoCode,
    sidoName: region.sidoName,
    sigunguCode: region.sigunguCode,
    sigunguName: region.sigunguName,
  }
}

export function hasSidoAreas(sidoCode: string): boolean {
  return SETUP_AREA_REGIONS.some((region) => region.sidoCode === sidoCode)
}

export function questAreasForSido(sidoCode: string): QuestArea[] {
  return SETUP_AREA_REGIONS.filter((region) => region.sidoCode === sidoCode).map(
    toQuestArea,
  )
}

export function mergeQuestAreas(
  current: readonly QuestArea[],
  adding: readonly QuestArea[],
): QuestArea[] {
  const next = new Map(current.map((area) => [area.sigunguCode, area]))
  for (const area of adding) {
    next.set(area.sigunguCode, area)
  }
  return [...next.values()]
}

export function groupedSetupRegions(): Array<{
  sidoCode: string
  sidoName: string
  regions: SetupAreaRegion[]
}> {
  const groups = new Map<string, { sidoName: string; regions: SetupAreaRegion[] }>()
  for (const region of SETUP_AREA_REGIONS) {
    const group = groups.get(region.sidoCode)
    if (group) {
      group.regions.push(region)
    } else {
      groups.set(region.sidoCode, {
        sidoName: region.sidoName,
        regions: [region],
      })
    }
  }

  const order = [SEOUL_SIDO_CODE, GYEONGGI_SIDO_CODE, INCHEON_SIDO_CODE]
  return [...groups.entries()]
    .sort((left, right) => {
      const leftIndex = order.indexOf(left[0])
      const rightIndex = order.indexOf(right[0])
      const leftRank = leftIndex === -1 ? order.length : leftIndex
      const rightRank = rightIndex === -1 ? order.length : rightIndex
      return leftRank - rightRank
    })
    .map(([sidoCode, group]) => ({
      sidoCode,
      sidoName: group.sidoName.replace('특별시', '').replace('광역시', '').replace('도', ''),
      regions: [...group.regions].sort((left, right) =>
        left.sigunguName.localeCompare(right.sigunguName, 'ko'),
      ),
    }))
}
