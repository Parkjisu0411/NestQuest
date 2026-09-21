import { calculatePurchaseBudget, formatEok } from './calculations.ts'
import type { QuestArea, SearchCriteria } from './models.ts'

export interface SidoAvailability {
  sidoCode: string
  label: string
  total: number
}

export function formatAreaSummary(
  areas: QuestArea[],
  availability: readonly SidoAvailability[],
): string {
  if (areas.length === 0) {
    return '지역 없음'
  }

  const selectedBySido = new Map<string, QuestArea[]>()
  for (const area of areas) {
    const current = selectedBySido.get(area.sidoCode) ?? []
    current.push(area)
    selectedBySido.set(area.sidoCode, current)
  }

  const parts = availability.flatMap((sido) => {
    const selected = selectedBySido.get(sido.sidoCode) ?? []
    if (selected.length === 0) {
      return []
    }
    if (sido.total > 0 && selected.length === sido.total) {
      return [`${sido.label} 전체`]
    }
    if (selected.length >= 4 || availability.filter((item) => (selectedBySido.get(item.sidoCode) ?? []).length > 0).length > 1) {
      return [`${sido.label} ${selected.length}개`]
    }
    return [
      selected
        .map((area) => area.sigunguName.replace(/구$/, '').replace(/시$/, ''))
        .join(' · '),
    ]
  })

  if (parts.length === 0) {
    return `${areas.length}개 지역`
  }

  const usesCount = parts.some((part) => part.includes('개') || part.includes('전체'))
  if (usesCount && parts.length > 1) {
    return `${parts.join(' · ')} 지역`
  }
  if (parts.length === 1 && parts[0]?.endsWith('개')) {
    return `${parts[0]} 지역`
  }
  return parts.join(' · ')
}

export function formatQuestContext(
  criteria: SearchCriteria,
  availability: readonly SidoAvailability[],
): string {
  const parts = [formatAreaSummary(criteria.areas, availability)]
  const budget = calculatePurchaseBudget(
    criteria.availableCash,
    criteria.expectedLoanLimit,
  )
  if (budget !== undefined) {
    parts.push(`예산 ${formatEok(budget)}`)
  }
  if (criteria.minExclusiveArea !== undefined) {
    parts.push(`${criteria.minExclusiveArea}㎡ 이상`)
  }
  if (criteria.maxBuildingAge !== undefined) {
    parts.push(`${criteria.maxBuildingAge}년 이하`)
  }
  if (criteria.minHouseholdCount !== undefined) {
    parts.push(`${criteria.minHouseholdCount.toLocaleString('ko-KR')}세대 이상`)
  }
  if (criteria.commuteDestination) {
    parts.push(
      criteria.maxCommuteMinutes === undefined
        ? criteria.commuteDestination.name
        : `${criteria.commuteDestination.name} ${criteria.maxCommuteMinutes}분`,
    )
  }
  return parts.join(' · ')
}
