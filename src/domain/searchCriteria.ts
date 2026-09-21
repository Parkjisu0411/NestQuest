import type { CommuteDestination, SearchCriteria } from './models.ts'

export function withOptionalField<K extends keyof SearchCriteria>(
  criteria: SearchCriteria,
  key: K,
  value: SearchCriteria[K] | undefined,
): SearchCriteria {
  const next = { ...criteria }
  if (value === undefined) {
    delete next[key]
  } else {
    next[key] = value
  }
  return next
}

export function withBudget(
  criteria: SearchCriteria,
  availableCash: number | undefined,
  expectedLoanLimit: number | undefined,
): SearchCriteria {
  return withOptionalField(
    withOptionalField(criteria, 'availableCash', availableCash),
    'expectedLoanLimit',
    expectedLoanLimit,
  )
}

export function withCommute(
  criteria: SearchCriteria,
  destination: CommuteDestination | undefined,
  maxCommuteMinutes: number | undefined,
): SearchCriteria {
  const next = { ...criteria }
  if (destination === undefined) {
    delete next.commuteDestination
    delete next.maxCommuteMinutes
    return next
  }

  next.commuteDestination = destination
  if (maxCommuteMinutes === undefined) {
    delete next.maxCommuteMinutes
  } else {
    next.maxCommuteMinutes = maxCommuteMinutes
  }
  return next
}

export function formatCommuteSummary(criteria: SearchCriteria): string {
  if (!criteria.commuteDestination) {
    return '설정 안 함'
  }
  if (criteria.maxCommuteMinutes === undefined) {
    return criteria.commuteDestination.name
  }
  return `${criteria.commuteDestination.name} · ${criteria.maxCommuteMinutes}분`
}
