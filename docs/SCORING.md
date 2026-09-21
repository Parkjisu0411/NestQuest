# NestQuest V0.1 Scoring and Calculation Specification

## Confirmed scoring revision — 2026-09-17

The following rules are implemented. Sections 10–13 describe qualitative notes and the weighted-average score.

- Retain per-metric ratings and importance weights.
- My Score = sum(eligible rating × priority) / sum(eligible priority).
- Retain the existing visit requirement and eligibility exclusions (unrated metrics and priority zero). No eligible weight means no score.
- Extra positive/negative factors are qualitative notes only; no numeric values or adjustment caps apply.
- Display one decimal place; retain precision internally. Do not persist derived scores.
- Preserve existing positive/negative descriptions during migration. Legacy impact values must not affect the new score; no new impact selector is required for these notes.
- Update tests to verify that adding, removing, or editing qualitative notes does not change the score. Keep rating, priority, no-visit, and no-eligible-metric tests.

Status: implemented and verified by unit and backup compatibility tests.

## 1. Purpose

This document defines NestQuest V0.1 calculations.

NestQuest intentionally minimizes scoring.

Objective facts should generally remain facts rather than being converted into arbitrary scores.

---

# 2. Scoring Philosophy

NestQuest does not mathematically determine the objectively best home.

Core principle:

조건으로 찾는다
→ 관심 있는 집을 고른다
→ 직접 가본다
→ 내 기준으로 평가한다
→ 비교한다
→ 내가 선택한다

V0.1 must not create:

- Data Score
- Match Score
- AI Score
- Finance Score
- Commute Score
- Price Score
- pre-visit Recommendation Score
- automated overall recommendation ranking

The only primary composite score is:

My Score

---

# 3. Objective Data Is Not a Score

Examples:

예상가격 = 8.6억

통근시간 = 43분

가까운 역 = 약 480m

준공 = 2014년

세대수 = 1,004세대

Do not convert these into:

가격점수 82

교통점수 91

단지점수 76

Objective facts are used for:

- Hard Filtering
- sorting
- factual comparison
- decision context

---

# 4. My Score Eligibility

My Score exists only when:

1. at least one Visit exists

and

2. at least one User Evaluation metric has:
   - non-null rating
   - priority greater than zero

Therefore:

NO VISIT
→ NO MY SCORE

If no eligible metric exists:

My Score is undefined.

Do not display zero.

---

# 5. Standard Metrics

Exactly six:

    stationAccess
    commuteFeel
    commercial
    school
    nature
    neighborhood

User labels:

- 역 접근성
- 통근 체감
- 상권
- 학군
- 자연 / 산책
- 동네 분위기

Do not add numeric standard metrics for:

- 소음
- 조경
- 관리상태
- 개방감
- 보행환경
- 주차체감

These belong in notes or Extra Factors.

---

# 6. Rating Scale

    1 = 매우 불만족
    2 = 아쉬움
    3 = 보통
    4 = 만족
    5 = 매우 만족
    null = 평가 안 함

`null` is excluded.

---

# 7. Priority Weights

    0 = 평가하지 않음
    1 = 낮음
    2 = 보통
    3 = 높음
    4 = 매우 높음

The same priorities apply across apartments in the active Quest.

Priorities are collected during Setup and may be edited in Settings.

There are no hidden default priority values.

A metric with no explicit priority choice must not receive an inferred weight.

---

# 8. Eligible Metric

A metric participates when:

    rating != null

and:

    priority > 0

Otherwise it is excluded.

---

# 9. Base Score

Formula:

    Base Score =
      Σ(rating × priority)
      /
      Σ(priority)

Example:

역 접근성:

    rating = 4
    priority = 3

통근 체감:

    rating = 5
    priority = 4

상권:

    rating = 4
    priority = 2

학군:

    rating = null
    priority = 0

자연 / 산책:

    rating = 3
    priority = 3

동네 분위기:

    rating = 5
    priority = 4

Calculation:

    (4×3 + 5×4 + 4×2 + 3×3 + 5×4)
    /
    (3 + 4 + 2 + 3 + 4)

    = 69 / 16

    = 4.3125

Do not prematurely round the internal Base Score.

---

# 10. Extra Factors

Users may create free-form Extra Factors.

Types:

    POSITIVE
    NEGATIVE

Example:

    POSITIVE
    "거실에서 한강뷰가 상당히 좋음"

Example:

    NEGATIVE
    "바로 앞 대로변 소음이 예상보다 심함"

---

# 11. Qualitative Notes

Positive and negative notes have no numeric impact. New notes have no impact selection. Preserve legacy descriptions and accept legacy impact metadata for backup compatibility, but never use it in scoring.

---

# 12. Notes and Score Independence

Adding, editing, or removing notes must not change My Score. Notes alone cannot create a score when no eligible ratings exist.

---

# 13. Final My Score

    My Score = Base Score

Eligible ratings range from 1 to 5, so their positive-weight average also ranges from 1 to 5. No extra adjustment or cap is applied.

UI:

one decimal place.

Example:

    MY SCORE 4.6

Internal calculation may retain greater precision.

My Score is derived. Do not store it in IndexedDB or JSON backup.

---

# 14. Critical Negative Factor

"후보 제외" is not a numeric adjustment.

Do not convert it to:

-5

or:

My Score = 0

Instead:

offer explicit PASS action.

The user must choose PASS.

Never automatically PASS.

---

# 15. My Score Does Not Control Stage

My Score must not automatically produce:

- CANDIDATE
- SHORTLIST
- PASSED

Example:

MY SCORE 4.8

does not automatically mean SHORTLIST.

MY SCORE 2.0

does not automatically mean PASSED.

---

# 16. Manual Shortlist Ranking

Manual shortlist rank is independent of My Score.

Example:

My Score:

    영등포 4.6
    상도 4.3
    마곡 4.1

User rank:

    1. 마곡
    2. 영등포
    3. 상도

Valid.

Do not overwrite manual rank based on My Score.

---

# 17. Price Estimate Purpose

Price Estimate is a purchase-decision reference.

It is not:

- professional appraisal
- guaranteed fair value
- asking price
- future-price forecast

Avoid fake precision.

---

# 18. Price Estimate Unit

Calculate at:

Apartment + Area Group

Example:

마곡엠밸리7단지 59㎡

and:

마곡엠밸리7단지 84㎡

have separate estimates.

---

# 19. Valid Transactions

Use valid, confidently matched transactions.

Canceled:

excluded.

Questionable matching:

excluded until resolved.

---

# 20. Transaction Window

Initial rule:

1. use recent 6 months
2. if sample is insufficient, expand to 12 months

The exact "insufficient" threshold is UNRESOLVED.

Do not invent a threshold before inspecting real data.

When Phase 3 reaches this point:

- inspect real transaction distributions
- propose a simple threshold
- document it
- add tests

---

# 21. Representative Price

    estimatedPrice =
      median(valid transaction prices)

Median is preferred to reduce sensitivity to outliers.

---

# 22. Even Median

For an even count:

average the two middle values.

Example:

    8.3
    8.5
    8.7
    8.9

Median:

    8.6

---

# 23. Recent Range

    lowPrice =
      minimum valid price

    highPrice =
      maximum valid price

This is a recent transaction range.

It is not a statistical confidence interval.

---

# 24. Latest Price

    latestPrice =
      price of most recent valid transaction

If multiple transactions occur on the same latest date, do not fabricate a unique transaction.

Presentation can be decided during implementation.

---

# 25. Floor Adjustment

No floor adjustment in V0.1.

Floor remains visible in transaction history when available.

---

# 26. Price Confidence

Use:

    HIGH
    MEDIUM
    LOW

Do not use pseudo-precise percentages.

Confidence may consider:

- transaction count
- recency
- whether 12-month expansion was needed

Exact thresholds are UNRESOLVED until real-data inspection.

---

# 27. Area Grouping

Preserve raw exclusive area.

Similar values may be grouped.

Example:

    84.91
    84.93
    84.95

→

    84㎡

Exact grouping tolerance is UNRESOLVED.

Do not implement an arbitrary complex algorithm before inspecting real data.

---

# 28. Purchase Budget

    both budget inputs absent → undefined
    one present → present value + 0
    both present → availableCash + expectedLoanLimit

Example:

    3.0억 + 5.0억 = 8.0억

    2.0억 + omitted loan = 2.0억

    both omitted → no budget filter

---

# 29. Discover Budget Buffer

    discoverBudgetCeiling =
      purchaseBudget × 1.05

when a purchase budget exists.

Example:

    8.0억
    →
    8.4억

The user budget remains 8.0억.

The extra 5% is only a Discover visibility buffer.

If purchase budget is undefined, Discover budget ceiling is undefined and price is not a Hard Filter.

UI may label buffered results:

"예산 근처"

---

# 30. Price Is Not a Score

Cheaper does not automatically mean better.

Once homes satisfy the user's financial range, NestQuest must not endlessly reward lower prices through a score.

---

# 31. Building Age

Derive from:

    approvalDate

Do not persist a manually updated building-age value when approvalDate exists.

---

# 32. Household Count

Hard Filter, only when minHouseholdCount exists:

    householdCount >= minHouseholdCount

Household count is not a score.

---

# 33. Minimum Exclusive Area

Filtering occurs at Unit Type level, only when minExclusiveArea exists.

Example:

Minimum:

    59㎡

Complex:

    49㎡
    59㎡
    84㎡

Eligible target Unit Types:

    59㎡
    84㎡

If minExclusiveArea is omitted, exclusive area is not used as a Hard Filter.

---

# 34. Missing Hard-Filter Data — UNRESOLVED

If a required factual field is unavailable, do not silently treat it as zero or as passing.

Exact Discover behavior for unavailable Hard-Filter data should be determined during real-data integration.

The implementation must surface the decision rather than inventing behavior.

---

# 35. Commute Hard Filter

Applied only when both commuteDestination and maxCommuteMinutes exist.

Rule:

    totalMinutes <= maxCommuteMinutes

Only totalMinutes matters.

If commuteDestination is omitted, commute information is not required, commute values must not be invented, and commute time is not a Hard Filter even if maxCommuteMinutes somehow exists.

If a destination exists and maxCommuteMinutes is omitted, commute information may still be shown and commute time is not a Hard Filter.

Example:

Maximum:

    60 minutes

58 minutes / 2 transfers:

Pass.

63 minutes / 0 transfers:

Fail.

---

# 36. No Commute Score

Do not create Commute Score.

Do not automatically reward:

- fewer transfers
- subway-only route
- less walking

These may affect the user's later:

통근 체감.

---

# 37. Station Distance

Nearest station distance:

- factual comparison information
- not a Hard Filter
- not automatically included in My Score

The user evaluates actual accessibility through:

역 접근성.

---

# 38. Parking Per Household

When valid:

    parkingPerHousehold =
      parkingCount / householdCount

Factual only.

No Parking Score.

---

# 39. Management Fee — UNRESOLVED

Exact aggregation depends on real provider data.

When implemented, methodology must be:

- deterministic
- documented
- understandable

Management fee does not automatically affect My Score.

---

# 40. Monthly Loan Payment Purpose

NestQuest may provide a standardized reference monthly payment.

Question answered:

"내가 입력한 대출한도를 이 조건으로 빌린다고 가정하면 월 부담이 어느 정도인가?"

Not:

- mortgage eligibility
- bank quote
- policy calculation

---

# 41. Monthly Loan Payment Inputs

    P =
      expectedLoanLimit

    annualRate =
      LoanAssumption.annualInterestRate

    r =
      annualRate / 12

    n =
      termYears × 12

Repayment:

equal principal-and-interest.

---

# 42. Monthly Payment Formula

For positive interest:

    monthlyPayment =
      P ×
      [r × (1 + r)^n]
      /
      [(1 + r)^n - 1]

For zero interest:

    monthlyPayment =
      P / n

Implement as a pure function with tests.

---

# 43. Monthly Payment Display

Example:

예상 월 상환액

약 XXX만원

기준금리 4.0%

30년

원리금균등 기준

The 4.0% and 30-year figures are Phase 1 application reference assumptions.

Setup does not ask the user for these values.

Domain representation remains `annualInterestRate = 0.04`.

They are not a bank quote, eligibility estimate, recommendation, or current market-rate claim.

Use the current Quest LoanAssumption values, which start from the Phase 1 reference and may later be edited in Settings.

Do not imply bank approval or quotation.

---

# 44. AI Research and My Score

AI Research does not directly participate in My Score.

Correct flow:

AI Research
→ user reviews evidence
→ user decides
→ User Evaluation

Example:

AI Research
→ user reads commercial environment research
→ commercial = 4

The scored input is the user's rating.

---

# 45. Objective and Subjective Disagreement

This is valid:

    commute.totalMinutes = 43

and:

    commuteFeel = 2

Likewise:

    nearestStationDistance = 400m

and:

    stationAccess = 2

NestQuest must not force subjective ratings to align with objective facts.

---

# 46. Sorting

Objective data may be used for factual sorting.

Visited apartments may optionally be sorted by My Score.

Sorting is not recommendation.

Manual Shortlist ranking remains separate and must not be overwritten.

---

# 47. Missing Data

Missing data is not zero.

Examples:

Missing commute:

Unavailable.

Not:

0 minutes.

Missing management fee:

Unavailable.

Not:

0 KRW.

Missing parking:

Unavailable.

Not:

0 spaces.

---

# 48. Calculation Implementation

Prefer pure functions:

    calculatePurchaseBudget()

    calculateDiscoverBudgetCeiling()

    calculateBuildingAge()

    calculateParkingPerHousehold()

    calculatePriceEstimate()

    calculateMyScore()

    calculateMonthlyLoanPayment()

Add unit tests.

---

# 49. Required My Score Tests

Test:

- weighted calculation
- null rating exclusion
- priority zero exclusion
- qualitative note additions, edits, and removals leave the score unchanged
- legacy positive and negative impacts are ignored
- ratings at 1 and 5 retain their values
- new and legacy notes survive backup restoration without affecting the score
- no Visit
- no eligible ratings

---

# 50. Required Price Tests

When Price Estimate is implemented, test:

- odd median
- even median
- canceled transaction exclusion
- six-month window
- twelve-month fallback
- latest transaction
- low/high range
- no valid transactions
- validated Area Group behavior

Confidence tests are added after thresholds are finalized.

---

# 51. Required Loan Tests

Test:

- positive interest
- zero interest
- zero principal
- standard long-term loan
- invalid negative inputs

---

# 52. Explicitly Unresolved Decisions

The following are intentionally unresolved:

1. minimum 6-month transaction count before 12-month expansion
2. Area Group tolerance
3. HIGH / MEDIUM / LOW confidence thresholds
4. exact management fee aggregation
5. missing Hard-Filter-data behavior
6. representative commute route selection details

These are not permission to invent arbitrary rules.

When implementation reaches one of them:

1. inspect real data/provider behavior
2. propose a simple rule
3. explain its effect
4. obtain approval if materially product-affecting
5. document it
6. add tests

---

# 53. Final Guardrail

If a proposed calculation tries to answer:

"Which home is objectively best?"

it probably does not belong in NestQuest V0.1.

If it answers:

"Does this satisfy my stated condition?"

or:

"What does my own evaluation amount to?"

it is much more likely to fit NestQuest.
