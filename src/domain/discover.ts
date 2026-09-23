import {
  calculateBuildingAge,
  calculateDiscoverBudgetCeiling,
  calculatePurchaseBudget,
} from './calculations.ts'
import type {
  Apartment,
  ApartmentUnitType,
  CommuteEstimate,
  PassReason,
  Quest,
  QuestArea,
  QuestState,
  SearchCriteria,
  Transaction,
  AIResearch,
} from './models.ts'
import { withNormalizedShortlistRanks } from './shortlist.ts'

export interface DiscoverableApartment {
  syncErrors?: Partial<Record<'detail' | 'price' | 'commute', { at: string }>>
  syncChecks?: Partial<Record<'detail' | 'price' | 'noRoute', { key: string; at: string }>>
  source?: { provider: string; fetchedAt: string }
  apartment: Apartment
  area: QuestArea
  unitTypes: ApartmentUnitType[]
  commutes: CommuteEstimate[]
  transactions?: Transaction[]
  research?: AIResearch[]
  initialStage?: QuestState['stage']
  passReason?: PassReason
}

export interface DiscoverMatch {
  apartment: Apartment
  area: QuestArea
  eligibleUnitTypes: ApartmentUnitType[]
  displayUnit?: ApartmentUnitType
  unknownFields: string[]
  commute?: CommuteEstimate
  purchaseBudget?: number
  nearBudget: boolean
}

export function unitMeetsMinExclusiveArea(
  unit: ApartmentUnitType,
  minExclusiveArea: number,
): boolean {
  return unit.exclusiveAreas.some((area) => area >= minExclusiveArea)
}

export function pickDisplayUnit(units: ApartmentUnitType[]): ApartmentUnitType {
  return [...units].sort((left, right) => {
    const leftPrice = left.priceEstimate?.estimatedPrice ?? Number.POSITIVE_INFINITY
    const rightPrice = right.priceEstimate?.estimatedPrice ?? Number.POSITIVE_INFINITY
    if (leftPrice !== rightPrice) {
      return leftPrice - rightPrice
    }
    return left.areaGroup - right.areaGroup
  })[0]
}

const RETAINED_STAGES = new Set<QuestState['stage']>([
  'CANDIDATE',
  'VISITED',
  'SHORTLIST',
  'PASSED',
])

/** Unknown values are included by policy, but must not be labelled confirmed matches. */
export function classifyFilterResult(record: DiscoverableApartment, criteria: SearchCriteria, asOf: Date = new Date()): 'confirmed' | 'unknown' | 'retained' {
  if (buildDiscoverMatch(record, { ...criteria, includeUnknown:false }, asOf)) return 'confirmed'
  if (buildDiscoverMatch(record, { ...criteria, includeUnknown:true }, asOf)) return 'unknown'
  return 'retained'
}

export function buildDiscoverMatch(
  record: DiscoverableApartment,
  criteria: SearchCriteria,
  asOf: Date = new Date(),
  mode: 'filtered' | 'retained' = 'filtered',
): DiscoverMatch | undefined {
  const purchaseBudget = calculatePurchaseBudget(
    criteria.availableCash,
    criteria.expectedLoanLimit,
  )
  const ceiling = calculateDiscoverBudgetCeiling(purchaseBudget)
  const includeUnknown = criteria.includeUnknown !== false

  if (mode === 'filtered') {
    const areaCodes = new Set(criteria.areas.map((area) => area.sigunguCode))
    if (!areaCodes.has(record.area.sigunguCode)) {
      return undefined
    }

    if (criteria.minHouseholdCount !== undefined) {
      if (record.apartment.householdCount === undefined) {
        if (!includeUnknown) return undefined
      }
      if (record.apartment.householdCount !== undefined && record.apartment.householdCount < criteria.minHouseholdCount) {
        return undefined
      }
    }

    if (criteria.maxBuildingAge !== undefined) {
      const buildingAge = record.apartment.approvalDate ? calculateBuildingAge(record.apartment.approvalDate, asOf) : undefined
      if ((buildingAge === undefined && !includeUnknown) || (buildingAge !== undefined && buildingAge > criteria.maxBuildingAge)) {
        return undefined
      }
    }
  }

  const destination = criteria.commuteDestination
  const commute = destination
    ? record.commutes.find((item) => item.destinationId === destination.id)
    : undefined
  if (mode === 'filtered' && destination && criteria.maxCommuteMinutes !== undefined && !commute && !includeUnknown) return undefined
  if (
    mode === 'filtered' &&
    destination !== undefined &&
    criteria.maxCommuteMinutes !== undefined &&
    commute !== undefined &&
    commute.totalMinutes > criteria.maxCommuteMinutes
  ) {
    return undefined
  }

  const areaPool = record.unitTypes
  const minExclusiveArea = criteria.minExclusiveArea
  const areaFiltered =
    minExclusiveArea === undefined
      ? areaPool
      : areaPool.filter((unit) => unit.exclusiveAreas.length === 0 ? includeUnknown : unitMeetsMinExclusiveArea(unit, minExclusiveArea))
  const eligibleUnitTypes = areaFiltered.filter((unit) => {
    if (mode !== 'filtered' || ceiling === undefined) {
      return true
    }
    const estimatedPrice = unit.priceEstimate?.estimatedPrice
    if (estimatedPrice === undefined) {
      return includeUnknown
    }
    return estimatedPrice <= ceiling
  })
  const unitsForDisplay =
    eligibleUnitTypes.length > 0
      ? eligibleUnitTypes
      : mode === 'retained'
        ? areaPool
        : []

  if (unitsForDisplay.length === 0 && record.unitTypes.length > 0) {
    return undefined
  }
  if (record.unitTypes.length === 0 && mode === 'filtered' && !includeUnknown && (ceiling !== undefined || minExclusiveArea !== undefined)) return undefined

  const displayUnit = pickDisplayUnit(unitsForDisplay)
  const estimatedPrice = displayUnit?.priceEstimate?.estimatedPrice
  if (mode === 'filtered' && ceiling !== undefined && estimatedPrice === undefined && !includeUnknown) {
    return undefined
  }

  return {
    apartment: record.apartment,
    area: record.area,
    eligibleUnitTypes: eligibleUnitTypes.length > 0 ? eligibleUnitTypes : unitsForDisplay,
    displayUnit,
    unknownFields: [
      ...(estimatedPrice === undefined ? ['가격'] : []),
      ...(!displayUnit?.exclusiveAreas.length ? ['면적'] : []),
      ...(record.apartment.householdCount === undefined ? ['세대수'] : []),
      ...(!record.apartment.approvalDate || calculateBuildingAge(record.apartment.approvalDate, asOf) === undefined ? ['연식'] : []),
      ...(destination && !commute ? ['통근'] : []),
    ],
    commute,
    purchaseBudget,
    nearBudget:
      purchaseBudget !== undefined &&
      ceiling !== undefined &&
      estimatedPrice !== undefined &&
      estimatedPrice > purchaseBudget &&
      estimatedPrice <= ceiling,
  }
}

export function discoverApartments(
  records: readonly DiscoverableApartment[],
  criteria: SearchCriteria,
  asOf: Date = new Date(),
): DiscoverMatch[] {
  const matches: DiscoverMatch[] = []

  for (const record of records) {
    const match = buildDiscoverMatch(record, criteria, asOf, 'filtered')
    if (match) {
      matches.push(match)
    }
  }

  return sortMatches(matches)
}

export function listQuestHomeMatches(
  records: readonly DiscoverableApartment[],
  criteria: SearchCriteria,
  states: Record<string, QuestState>,
  asOf: Date = new Date(),
): DiscoverMatch[] {
  const discovered = discoverApartments(records, criteria, asOf)
  const byId = new Map(discovered.map((match) => [match.apartment.id, match]))
  const recordById = new Map(records.map((record) => [record.apartment.id, record]))

  for (const state of Object.values(states)) {
    if (!RETAINED_STAGES.has(state.stage) || byId.has(state.apartmentId)) {
      continue
    }

    const record = recordById.get(state.apartmentId)
    if (!record) {
      continue
    }

    const match = buildDiscoverMatch(record, criteria, asOf, 'retained')
    if (match) {
      byId.set(state.apartmentId, match)
    }
  }

  return sortMatches([...byId.values()])
}

function sortMatches(matches: DiscoverMatch[]): DiscoverMatch[] {
  return [...matches].sort((left, right) => {
    const leftMinutes = left.commute?.totalMinutes ?? Number.POSITIVE_INFINITY
    const rightMinutes = right.commute?.totalMinutes ?? Number.POSITIVE_INFINITY
    if (leftMinutes !== rightMinutes) {
      return leftMinutes - rightMinutes
    }
    return left.apartment.name.localeCompare(right.apartment.name, 'ko')
  })
}

export function createApartmentQuestStates(
  quest: Quest,
  matches: DiscoverMatch[],
  records: readonly DiscoverableApartment[],
  now: string,
): Record<string, QuestState> {
  const seedById = new Map(records.map((record) => [record.apartment.id, record]))
  const states: Record<string, QuestState> = {}

  for (const match of matches) {
    const seed = seedById.get(match.apartment.id)
    const stage = seed?.initialStage ?? 'DISCOVERED'
    states[match.apartment.id] = {
      questId: quest.id,
      apartmentId: match.apartment.id,
      stage,
      targetUnitTypeIds: match.eligibleUnitTypes.map((unit) => unit.id),
      updatedAt: now,
      ...(stage === 'PASSED'
        ? {
            passedAt: now,
            passReason: seed?.passReason ?? 'OTHER',
          }
        : {}),
    }
  }

  return withNormalizedShortlistRanks(states, now)
}
