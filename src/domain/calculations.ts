export function calculatePurchaseBudget(
  availableCash: number | undefined,
  expectedLoanLimit: number | undefined,
): number | undefined {
  if (availableCash === undefined && expectedLoanLimit === undefined) {
    return undefined
  }

  const cash = availableCash ?? 0
  const loan = expectedLoanLimit ?? 0
  if (!Number.isFinite(cash) || !Number.isFinite(loan) || cash < 0 || loan < 0) {
    return undefined
  }

  return cash + loan
}

export function calculateDiscoverBudgetCeiling(
  purchaseBudget: number | undefined,
): number | undefined {
  if (
    purchaseBudget === undefined ||
    !Number.isFinite(purchaseBudget) ||
    purchaseBudget < 0
  ) {
    return undefined
  }

  return purchaseBudget * 1.05
}

/**
 * Equal principal-and-interest reference payment.
 * `annualInterestRate` is a decimal (0.04 for 4%), matching SCORING.md:
 * r = annualRate / 12.
 */
export function calculateMonthlyLoanPayment(
  principal: number,
  annualInterestRate: number,
  termYears: number,
): number | undefined {
  if (
    !Number.isFinite(principal) ||
    !Number.isFinite(annualInterestRate) ||
    !Number.isFinite(termYears)
  ) {
    return undefined
  }

  if (principal < 0 || annualInterestRate < 0 || termYears <= 0) {
    return undefined
  }

  const n = termYears * 12

  if (principal === 0) {
    return 0
  }

  if (annualInterestRate === 0) {
    return principal / n
  }

  const r = annualInterestRate / 12
  const compound = (1 + r) ** n

  return (principal * (r * compound)) / (compound - 1)
}

export const WON_PER_EOK = 100_000_000

export function eokToWon(eok: number): number {
  return eok * WON_PER_EOK
}

export function wonToEok(won: number): number {
  return won / WON_PER_EOK
}

/** Domain decimal `0.04` → UI percent `4`. */
export function annualRateToPercent(annualInterestRate: number): number {
  return Math.round(annualInterestRate * 1000) / 10
}

/** UI percent `4.0` → domain decimal `0.04`. */
export function percentToAnnualRate(percent: number): number {
  return percent / 100
}

export function formatLoanPercent(annualInterestRate: number): string {
  return annualRateToPercent(annualInterestRate).toFixed(1)
}

/**
 * Building age in full years from `approvalDate` (YYYY-MM-DD).
 * Returns undefined when the date cannot be parsed.
 */
export function calculateBuildingAge(
  approvalDate: string,
  asOf: Date = new Date(),
): number | undefined {
  const approval = parseIsoDate(approvalDate)
  if (approval === undefined) {
    return undefined
  }

  let age = asOf.getFullYear() - approval.getFullYear()
  const beforeAnniversary =
    asOf.getMonth() < approval.getMonth() ||
    (asOf.getMonth() === approval.getMonth() && asOf.getDate() < approval.getDate())

  if (beforeAnniversary) {
    age -= 1
  }

  return age < 0 ? 0 : age
}

export function calculateParkingPerHousehold(
  parkingCount: number,
  householdCount: number,
): number | undefined {
  if (
    !Number.isFinite(parkingCount) ||
    !Number.isFinite(householdCount) ||
    parkingCount < 0 ||
    householdCount <= 0
  ) {
    return undefined
  }

  return parkingCount / householdCount
}

function parseIsoDate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) {
    return undefined
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined
  }

  return date
}

export function formatEok(won: number): string {
  const eok = wonToEok(won)
  const rounded = Number.isInteger(eok) ? eok.toFixed(0) : eok.toFixed(1)
  return `${rounded}억`
}

export function formatManWon(won: number): string {
  const man = Math.round(won / 10_000)
  return `약 ${man.toLocaleString('ko-KR')}만원`
}
