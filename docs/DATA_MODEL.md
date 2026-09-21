# NestQuest V0.1 Data Model

## 호환 보완 · 2026-09-18

SearchCriteria.includeUnknown은 선택 boolean이며 생략 시 true로 취급한다. 관찰 구역 interior에는 unitIdentity, daylight, condition, layout이 추가되며 모두 선택이다. 방문 전 SHORTLIST도 허용하므로 단계만으로 방문 기록의 존재를 추론하지 않는다. 후보 해제 시 실제 방문 유무를 확인한다. 이전 백업은 계속 읽을 수 있으나 새 필드/관찰 항목이 있는 백업의 구버전 앱 복원은 지원하지 않는다. 방문 수정에서 제거된 사진 원본은 다른 방문이 참조하지 않을 때 같은 저장 트랜잭션에서 삭제한다.


## 1. Purpose

This document defines the canonical data model for NestQuest V0.1.

The model should remain intentionally small and reflect actual product requirements.

Do not add fields simply because they are common in real-estate applications.

If a value can be deterministically calculated, prefer deriving it rather than storing duplicated state.

V0.1 supports one active Quest.

`questId` relationships are retained in user-owned records for clear data relationships and future-safe export structure, but no Multi-Quest UI should be implemented.

---

# 2. Data Provenance

Primary provenance categories:

- EXTERNAL_FACT
- USER_FACT
- DERIVED
- USER_EVALUATION
- AI_RESEARCH

## EXTERNAL_FACT

Objective information obtained from an external/public source.

Examples:

- apartment address
- approval date
- household count
- transaction price

## USER_FACT

Objective/factual information manually entered by the user.

Use sparingly.

## DERIVED

Deterministically calculated values.

Examples:

- purchase budget
- building age
- parking per household
- Price Estimate
- monthly loan payment
- My Score

## USER_EVALUATION

The user's subjective judgment.

## AI_RESEARCH

Optional supporting research produced externally.

These categories must remain conceptually distinguishable.

---

# 3. Quest

    interface Quest {
      id: string

      searchCriteria: SearchCriteria
      evaluationPriorities: EvaluationPriorities
      loanAssumption: LoanAssumption

      createdAt: string
      updatedAt: string
    }

V0.1 supports one active Quest.

Do not implement Quest naming, Quest lists, Quest switching, or Quest management UI.

---

# 4. SearchCriteria

    interface SearchCriteria {
      areas: QuestArea[]

      availableCash?: number
      expectedLoanLimit?: number

      minExclusiveArea?: number
      maxBuildingAge?: number
      minHouseholdCount?: number

      commuteDestination?: CommuteDestination
      maxCommuteMinutes?: number
    }

Search Area is required.

Optional fields are omitted when the user skipped them. Do not store sentinel values such as 0, Infinity, or 999 to mean “no filter”.

`commuteDestination` is optional. Missing destination means the user has not configured commute information. Do not invent a default destination.

Commute time is a Hard Filter only when both `commuteDestination` and `maxCommuteMinutes` exist. If `maxCommuteMinutes` exists without a destination, it must not filter apartments.

Derived:

    purchaseBudget =
      both budget inputs absent → undefined
      one present → present value + 0
      both present → availableCash + expectedLoanLimit

Discover:

    discoverBudgetCeiling =
      no purchaseBudget → undefined
      purchaseBudget exists → purchaseBudget * 1.05

A Hard Filter is applied only when the corresponding SearchCriteria field exists.

---

# 5. QuestArea

    interface QuestArea {
      sidoCode: string
      sidoName: string

      sigunguCode: string
      sigunguName: string
    }

Presence in `SearchCriteria.areas` means the area is selected.

Do not store a redundant `selected` property.

---

# 6. CommuteDestination

    interface CommuteDestination {
      id: string
      name: string
      address?: string

      latitude: number
      longitude: number
    }

V0.1 primarily uses one commute destination when the user configures one. The SearchCriteria field is optional.

---

# 7. EvaluationPriorities

    type EvaluationPriority = 0 | 1 | 2 | 3 | 4

    interface EvaluationPriorities {
      stationAccess: EvaluationPriority
      commuteFeel: EvaluationPriority
      commercial: EvaluationPriority
      school: EvaluationPriority
      nature: EvaluationPriority
      neighborhood: EvaluationPriority
    }

Meaning:

    0 = IGNORE
    1 = LOW
    2 = MEDIUM
    3 = HIGH
    4 = VERY_HIGH

Collected during Setup.

Every field must be explicitly set by the user.

Do not infer, substitute, or persist a hidden default priority.

The same EvaluationPriorities values apply to every apartment in the active Quest.

They may later be edited in Settings.

---

# 8. LoanAssumption

    interface LoanAssumption {
      annualInterestRate: number
      termYears: number
    }

Repayment method in V0.1:

equal principal-and-interest.

Setup does not collect these fields.

Phase 1 uses application reference values:

    annualInterestRate = 0.04
    termYears = 30

Domain representation: `0.04` = 4.0%.

These are not a bank quote, eligibility estimate, recommendation, or current market-rate claim.

The user may later edit LoanAssumption in Settings (`0.04` domain value is shown as 4.0%).

Monthly payment is DERIVED.

---

# 9. Apartment

    interface Apartment {
      id: string

      externalId?: string

      name: string
      address: string

      latitude?: number
      longitude?: number

      approvalDate?: string

      householdCount?: number
      buildingCount?: number

      parkingCount?: number
      heatingType?: string

      managementFee?: ManagementFeeSummary

      createdAt: string
      updatedAt: string
    }

Primary provenance:

EXTERNAL_FACT

Normally derive:

- buildingAge
- parkingPerHousehold

rather than storing them.

---

# 10. ManagementFeeSummary

Exact implementation depends on confirmed public-data availability.

Conceptual model:

    interface ManagementFeeSummary {
      monthlyAverage?: number
      perSquareMeterAverage?: number

      periodMonths?: number
      calculatedAt?: string
    }

This model may be adjusted after inspecting actual provider data.

Management fee is not a Hard Filter.

---

# 11. ApartmentUnitType

    interface ApartmentUnitType {
      id: string
      apartmentId: string

      areaGroup: number
      exclusiveAreas: number[]

      priceEstimate?: PriceEstimate
    }

Raw exclusive areas must be preserved.

Example:

    84.91
    84.93
    84.95

may eventually belong to:

    areaGroup = 84

Exact grouping tolerance is UNRESOLVED pending real-data validation.

Do not automatically populate:

- room count
- bathroom count

---

# 12. Transaction

    interface Transaction {
      id: string

      apartmentId: string
      unitTypeId?: string

      exclusiveArea: number
      floor?: number

      price: number
      contractDate: string

      canceled: boolean
    }

Provenance:

EXTERNAL_FACT

Canceled transactions must not influence active Price Estimates.

---

# 13. PriceEstimate

    type PriceConfidence =
      | 'HIGH'
      | 'MEDIUM'
      | 'LOW'

    interface PriceEstimate {
      apartmentId: string
      unitTypeId: string

      estimatedPrice: number

      lowPrice: number
      highPrice: number
      latestPrice: number

      transactionCount: number
      periodMonths: 6 | 12

      confidence: PriceConfidence

      calculatedAt: string
    }

Provenance:

DERIVED

Rules are defined in SCORING.md.

---

# 14. CommuteEstimate

    interface CommuteEstimate {
      apartmentId: string
      destinationId: string

      totalMinutes: number

      transferCount?: number
      walkingMinutes?: number

      route: CommuteRouteSegment[]

      provider: string
      calculatedAt: string
    }

Only `totalMinutes` participates in the Hard Filter.

---

# 15. CommuteRouteSegment

    type CommuteSegmentType =
      | 'WALK'
      | 'SUBWAY'
      | 'BUS'
      | 'OTHER'

    interface CommuteRouteSegment {
      type: CommuteSegmentType

      durationMinutes: number

      from?: string
      to?: string

      lineName?: string
    }

---

# 16. QuestStage

    type QuestStage =
      | 'DISCOVERED'
      | 'CANDIDATE'
      | 'VISITED'
      | 'SHORTLIST'
      | 'PASSED'

Quest Stage is complex-level.

---

# 17. QuestState

    interface QuestState {
      questId: string
      apartmentId: string

      stage: QuestStage

      targetUnitTypeIds: string[]

      shortlistRank?: number
      shortlistMemo?: string

      passedAt?: string
      passReason?: PassReason
      passMemo?: string

      updatedAt: string
    }

Target Unit Types exist inside the complex-level Quest relationship.

---

# 18. PassReason

    type PassReason =
      | 'PRICE'
      | 'COMMUTE'
      | 'COMPLEX'
      | 'NEIGHBORHOOD'
      | 'AFTER_VISIT'
      | 'OTHER'

PASSED means hidden, not deleted.

---

# 19. Visit

    interface Visit {
      id: string

      questId: string
      apartmentId: string

      visitedAt: string

      visitType?: VisitType

      pros: string[]
      cons: string[]

      memo?: string

      photos: VisitPhoto[]

      createdAt: string
      updatedAt: string
    }

Visit represents historical observation.

An apartment may have multiple Visits.

---

# 20. VisitType — PROVISIONAL

    type VisitType =
      | 'WEEKDAY_DAY'
      | 'WEEKDAY_EVENING'
      | 'WEEKEND_DAY'
      | 'WEEKEND_EVENING'
      | 'OTHER'

These values are provisional prototype choices.

They are not frozen product requirements.

Keep them easy to change.

Do not build significant domain logic around these exact categories.

---

# 21. VisitPhoto

    interface VisitPhoto {
      id: string
      visitId: string

      blobKey: string

      createdAt: string
    }

Actual image Blob data should be stored in IndexedDB.

V0.1 does not require per-photo captions.

---

# 22. EvaluationRating

    type EvaluationRating =
      | 1
      | 2
      | 3
      | 4
      | 5
      | null

`null` means Not Rated.

---

# 23. UserEvaluation

    interface UserEvaluation {
      questId: string
      apartmentId: string

      ratings: {
        stationAccess: EvaluationRating
        commuteFeel: EvaluationRating
        commercial: EvaluationRating
        school: EvaluationRating
        nature: EvaluationRating
        neighborhood: EvaluationRating
      }

      adjustments: EvaluationAdjustment[]

      updatedAt: string
    }

Provenance:

USER_EVALUATION

Important:

Visit
= historical observation

UserEvaluation
= current judgment

A new Visit must not automatically modify UserEvaluation.

My Score must not exist unless at least one Visit exists.

---

# 24. EvaluationAdjustment

Visit draft storage (implemented 2026-09-17): `VisitDraft` is a separate version-1 draft object in the IndexedDB `visitDrafts` store, keyed by JSON-encoded `[questId, apartmentId]`. Its visit ID is stable across retries and becomes the completed Visit ID. It stores capture fields, evaluation draft, input phase/index, unsubmitted input strings, and photo Blobs. It is excluded from canonical Quest state and JSON backups. IndexedDB database version 2 adds this store without changing the canonical snapshot/backup versions. Successful visit completion writes state/photos and deletes its draft in one transaction; backup replacement clears all drafts.

    type AdjustmentType =
      | 'POSITIVE'
      | 'NEGATIVE'

    type AdjustmentImpact =
      | 'SMALL'
      | 'LARGE'
      | 'DECISIVE'

    interface EvaluationAdjustment {
      id: string

      type: AdjustmentType
      description: string

      impact?: AdjustmentImpact // legacy metadata only; new notes omit this

      createdAt: string
    }

These records are qualitative positive/negative notes and never change My Score. The existing type and `adjustments` field names remain for storage compatibility. Legacy impact metadata is preserved when present but is not displayed or used in calculations.

The current reader accepts both old records with impact and new records without impact under the existing versioned envelope. New backups are intended for the updated application; older application versions requiring impact cannot read new notes. No destructive migration or loss of note descriptions is required.

No predefined Extra Factor categories should be introduced in V0.1.

---

# 25. Shortlist

V0.1 does not require a separate Shortlist entity.

Shortlist is represented through QuestState:

    stage = 'SHORTLIST'

with:

    shortlistRank
    shortlistMemo

Manual shortlist ranking is a user decision.

It does not need to match My Score.

---

# 26. AIResearch

    type AIResearchCategory =
      | 'COMMERCIAL'
      | 'SCHOOL_DISTRICT'

    interface AIResearch {
      id: string

      questId: string
      apartmentId: string

      category: AIResearchCategory

      summary: string

      sources: AIResearchSource[]

      researchedAt: string
    }

Provenance:

AI_RESEARCH

V0.1 intentionally does not require storing:

- AI model name
- full raw AI response

AI Research must not directly participate in My Score.

---

# 27. AIResearchSource

    interface AIResearchSource {
      title?: string
      url?: string
      publisher?: string
    }

Per-source access timestamps are not required in V0.1.

The overall research date is stored on AIResearch.

---

# 28. Persistence

V0.1 persistence target:

IndexedDB

Phase 2 database:

    name: nestquest
    version: 1

Object stores:

- userState — single key `active`, versioned canonical user snapshot
- photoBlobs — VisitPhoto Blob values keyed by `blobKey`

Do not persist static application reference data in IndexedDB. Mock apartments, unit types, prices, and commute examples remain bundled in source code. User-owned records reference those entities by ID.

Persisted user-owned state:

- Quest, including SearchCriteria, EvaluationPriorities, LoanAssumption
- QuestState per apartment, including target unit selections, shortlist rank/memo, pass fields
- Visits and VisitPhoto metadata
- UserEvaluation and EvaluationAdjustments

Do not persist derived My Score, purchase budget, Discover ceiling, or monthly payment.

VisitPhoto metadata lives in canonical Quest state. Image Blob data lives only in `photoBlobs`. JSON backup carries metadata, not binaries.

The IndexedDB version and the backup format version are versioned separately so future migrations can be added without rewriting the persistence layer.

Do not introduce a backend solely for persistence.

---

# 29. Derived Values

Normally calculate rather than persist:

## Purchase Budget

    both budget inputs absent → undefined
    one present → present value + 0
    both present → availableCash + expectedLoanLimit

## Discover Budget Ceiling

    no purchaseBudget → undefined
    purchaseBudget exists → purchaseBudget * 1.05

## Building Age

derived from:

    approvalDate

## Parking Per Household

    parkingCount / householdCount

when valid.

## Estimated Monthly Loan Payment

derived from:

- expectedLoanLimit
- annualInterestRate
- termYears

## My Score

derived from:

- UserEvaluation
- EvaluationPriorities
- EvaluationAdjustments
- existence of at least one Visit

Do not persist My Score. Recalculate after hydration and restore.

---

# 30. Data Separation Examples

Example:

    nearestStationDistance = 430m

This is factual/derived information.

    stationAccess = 3

This is User Evaluation.

Both coexist.

---

Example:

    commute.totalMinutes = 43

This is factual route information.

    commuteFeel = 2

This is User Evaluation.

Both coexist.

---

Example:

AI Research says:

    "주변 상업시설 선택지가 풍부한 편"

This remains AI_RESEARCH.

The user may still decide:

    commercial = 3

NestQuest preserves the user's judgment.

---

# 31. Explicit Model Exclusions

Do not introduce these V0.1 models unless PRODUCT_SPEC.md changes:

- PolicySnapshot
- FinanceEstimate
- TaxEstimate
- DataScore
- MatchScore
- AIScore
- RecommendationScore
- MortgageEligibility
- LTVCalculation
- DSRCalculation
- RoomCountEstimate
- BathroomCountEstimate
- MultiQuestManager
