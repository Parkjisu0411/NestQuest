export interface QuestArea {
  sidoCode: string
  sidoName: string
  sigunguCode: string
  sigunguName: string
}

export interface CommuteDestination {
  id: string
  name: string
  address?: string
  latitude: number
  longitude: number
}

export interface SearchCriteria {
  includeUnknown?: boolean
  areas: QuestArea[]
  availableCash?: number
  expectedLoanLimit?: number
  minExclusiveArea?: number
  maxBuildingAge?: number
  minHouseholdCount?: number
  commuteDestination?: CommuteDestination
  maxCommuteMinutes?: number
}

export type EvaluationPriority = 0 | 1 | 2 | 3 | 4

export interface EvaluationPriorities {
  stationAccess: EvaluationPriority
  commuteFeel: EvaluationPriority
  commercial: EvaluationPriority
  school: EvaluationPriority
  nature: EvaluationPriority
  neighborhood: EvaluationPriority
}

export interface LoanAssumption {
  annualInterestRate: number
  termYears: number
}

/** Phase 1 application reference only. Not a quote, market rate, or Setup input. */
export const REFERENCE_LOAN_ASSUMPTION: LoanAssumption = {
  annualInterestRate: 0.04,
  termYears: 30,
}

export interface Quest {
  id: string
  searchCriteria: SearchCriteria
  evaluationPriorities: EvaluationPriorities
  loanAssumption: LoanAssumption
  createdAt: string
  updatedAt: string
}

export const EVALUATION_PRIORITY_LABELS: Record<EvaluationPriority, string> = {
  0: '평가하지 않음',
  1: '낮음',
  2: '보통',
  3: '높음',
  4: '매우 높음',
}

export const EVALUATION_METRIC_LABELS: Record<keyof EvaluationPriorities, string> = {
  stationAccess: '역 접근성',
  commuteFeel: '통근 체감',
  commercial: '상권',
  school: '학군',
  nature: '자연 / 산책',
  neighborhood: '동네 분위기',
}

export const EVALUATION_METRIC_ORDER: Array<keyof EvaluationPriorities> = [
  'stationAccess',
  'commuteFeel',
  'commercial',
  'school',
  'nature',
  'neighborhood',
]

export interface Apartment {
  id: string
  housingType?: string
  externalId?: string
  name: string
  address: string
  roadAddress?: string
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

export interface ManagementFeeSummary {
  monthlyAverage?: number
  perSquareMeterAverage?: number
  periodMonths?: number
  calculatedAt?: string
}

export interface ApartmentUnitType {
  id: string
  apartmentId: string
  areaGroup: number
  exclusiveAreas: number[]
  priceEstimate?: PriceEstimate
}

export type PriceConfidence = 'HIGH' | 'MEDIUM' | 'LOW'

export interface PriceEstimate {
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

export type CommuteSegmentType = 'WALK' | 'SUBWAY' | 'BUS' | 'OTHER'

export interface CommuteRouteSegment {
  type: CommuteSegmentType
  durationMinutes: number
  from?: string
  to?: string
  lineName?: string
}

export interface CommuteEstimate {
  /** Provider, endpoints and calculation-version identity for persisted reuse. */
  queryKey?: string
  apartmentId: string
  destinationId: string
  totalMinutes: number
  transferCount?: number
  walkingMinutes?: number
  route: CommuteRouteSegment[]
  provider: string
  calculatedAt: string
}

export type QuestStage =
  | 'DISCOVERED'
  | 'CANDIDATE'
  | 'VISITED'
  | 'SHORTLIST'
  | 'PASSED'

export type PassReason =
  | 'PRICE'
  | 'COMMUTE'
  | 'COMPLEX'
  | 'NEIGHBORHOOD'
  | 'AFTER_VISIT'
  | 'OTHER'

export interface QuestState {
  questId: string
  apartmentId: string
  stage: QuestStage
  targetUnitTypeIds: string[]
  candidateAt?: string
  shortlistRank?: number
  shortlistMemo?: string
  passedAt?: string
  passReason?: PassReason
  passMemo?: string
  updatedAt: string
}

export interface Transaction {
  id: string
  apartmentId: string
  unitTypeId?: string
  exclusiveArea: number
  floor?: number
  price: number
  contractDate: string
  canceled: boolean
}

export type AIResearchCategory = 'COMMERCIAL' | 'SCHOOL_DISTRICT'

export interface AIResearchSource {
  title?: string
  url?: string
  publisher?: string
}

export interface AIResearch {
  id: string
  questId: string
  apartmentId: string
  category: AIResearchCategory
  summary: string
  sources: AIResearchSource[]
  researchedAt: string
}

export const PRICE_CONFIDENCE_LABELS: Record<PriceConfidence, string> = {
  HIGH: '높음',
  MEDIUM: '보통',
  LOW: '낮음',
}

export const RESEARCH_CATEGORY_LABELS: Record<AIResearchCategory, string> = {
  COMMERCIAL: '상권',
  SCHOOL_DISTRICT: '학군',
}

export type VisitType =
  | 'WEEKDAY_DAY'
  | 'WEEKDAY_EVENING'
  | 'WEEKEND_DAY'
  | 'WEEKEND_EVENING'
  | 'OTHER'

export interface VisitPhoto {
  id: string
  visitId: string
  blobKey: string
  createdAt: string
}

export interface Visit {
  observations?: import('./visitObservations.ts').VisitObservations
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

export type EvaluationRating = 1 | 2 | 3 | 4 | 5 | null

export type AdjustmentType = 'POSITIVE' | 'NEGATIVE'

export type AdjustmentImpact = 'SMALL' | 'LARGE' | 'DECISIVE'

export interface EvaluationAdjustment {
  id: string
  type: AdjustmentType
  description: string
  /** Legacy backup metadata only; never affects My Score. New notes omit it. */
  impact?: AdjustmentImpact
  createdAt: string
}

export interface UserEvaluation {
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

export const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  WEEKDAY_DAY: '평일 낮',
  WEEKDAY_EVENING: '평일 저녁',
  WEEKEND_DAY: '주말 낮',
  WEEKEND_EVENING: '주말 저녁',
  OTHER: '기타',
}

export const VISIT_TYPE_ORDER: VisitType[] = [
  'WEEKDAY_DAY',
  'WEEKDAY_EVENING',
  'WEEKEND_DAY',
  'WEEKEND_EVENING',
  'OTHER',
]

export const ADJUSTMENT_TYPE_LABELS: Record<AdjustmentType, string> = {
  POSITIVE: '좋았던 점',
  NEGATIVE: '아쉬웠던 점',
}

