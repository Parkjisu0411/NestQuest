import { describe, expect, test } from 'vitest'
import {
  annualRateToPercent,
  calculateBuildingAge,
  calculateDiscoverBudgetCeiling,
  calculateMonthlyLoanPayment,
  calculateParkingPerHousehold,
  calculatePurchaseBudget,
  eokToWon,
  formatLoanPercent,
  percentToAnnualRate,
} from './calculations.ts'

describe('calculatePurchaseBudget', () => {
  test('adds available cash and expected loan limit', () => {
    expect(calculatePurchaseBudget(eokToWon(3), eokToWon(5))).toBe(eokToWon(8))
  })

  test('treats a missing component as zero when the other is present', () => {
    expect(calculatePurchaseBudget(eokToWon(2), undefined)).toBe(eokToWon(2))
    expect(calculatePurchaseBudget(undefined, eokToWon(4))).toBe(eokToWon(4))
  })

  test('returns undefined when both budget inputs are absent', () => {
    expect(calculatePurchaseBudget(undefined, undefined)).toBeUndefined()
  })

  test('returns undefined for negative budget inputs', () => {
    expect(calculatePurchaseBudget(-1, eokToWon(5))).toBeUndefined()
    expect(calculatePurchaseBudget(eokToWon(3), -1)).toBeUndefined()
  })

  test('allows zero cash or zero loan limit', () => {
    expect(calculatePurchaseBudget(0, eokToWon(5))).toBe(eokToWon(5))
    expect(calculatePurchaseBudget(eokToWon(3), 0)).toBe(eokToWon(3))
  })
})

describe('calculateDiscoverBudgetCeiling', () => {
  test('applies the +5% Discover visibility buffer', () => {
    expect(calculateDiscoverBudgetCeiling(eokToWon(8))).toBe(eokToWon(8.4))
  })

  test('returns undefined when there is no purchase budget', () => {
    expect(calculateDiscoverBudgetCeiling(undefined)).toBeUndefined()
  })
})

describe('calculateBuildingAge', () => {
  const asOf = new Date(2026, 8, 16)

  test('derives full years from approval date', () => {
    expect(calculateBuildingAge('2014-08-20', asOf)).toBe(12)
    expect(calculateBuildingAge('2014-09-16', asOf)).toBe(12)
    expect(calculateBuildingAge('2014-09-17', asOf)).toBe(11)
  })

  test('returns undefined for an unparseable date', () => {
    expect(calculateBuildingAge('unknown', asOf)).toBeUndefined()
  })
})

describe('calculateParkingPerHousehold', () => {
  test('divides parking count by household count', () => {
    expect(calculateParkingPerHousehold(1205, 1004)).toBeCloseTo(1.2, 2)
  })

  test('returns undefined when household count is not usable', () => {
    expect(calculateParkingPerHousehold(100, 0)).toBeUndefined()
    expect(calculateParkingPerHousehold(100, -1)).toBeUndefined()
  })
})

describe('calculateMonthlyLoanPayment', () => {
  test('calculates equal principal-and-interest for a positive rate', () => {
    const payment = calculateMonthlyLoanPayment(500_000_000, 0.04, 30)
    expect(payment).toBeCloseTo(2_387_076.48, 1)
  })

  test('divides principal by month count when interest is zero', () => {
    expect(calculateMonthlyLoanPayment(500_000_000, 0, 30)).toBeCloseTo(
      500_000_000 / 360,
    )
  })

  test('returns zero when principal is zero', () => {
    expect(calculateMonthlyLoanPayment(0, 0.04, 30)).toBe(0)
    expect(calculateMonthlyLoanPayment(0, 0, 30)).toBe(0)
  })

  test('calculates a standard long-term loan from expected loan limit', () => {
    const payment = calculateMonthlyLoanPayment(eokToWon(5), 0.04, 30)
    expect(payment).toBeCloseTo(2_387_076.48, 1)
  })

  test('returns undefined for invalid negative inputs', () => {
    expect(calculateMonthlyLoanPayment(-1, 0.04, 30)).toBeUndefined()
    expect(calculateMonthlyLoanPayment(500_000_000, -0.01, 30)).toBeUndefined()
    expect(calculateMonthlyLoanPayment(500_000_000, 0.04, -1)).toBeUndefined()
    expect(calculateMonthlyLoanPayment(500_000_000, 0.04, 0)).toBeUndefined()
  })
})

describe('loan assumption display conversion', () => {
  test('converts 0.04 to 4.0% for the Settings UI', () => {
    expect(annualRateToPercent(0.04)).toBe(4)
    expect(formatLoanPercent(0.04)).toBe('4.0')
    expect(percentToAnnualRate(4)).toBe(0.04)
    expect(percentToAnnualRate(4.0)).toBe(0.04)
  })

  test('round-trips a one-decimal percent', () => {
    expect(percentToAnnualRate(annualRateToPercent(0.035))).toBeCloseTo(0.035)
    expect(formatLoanPercent(0.035)).toBe('3.5')
  })
})
