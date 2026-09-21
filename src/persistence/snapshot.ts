import type {
  AdjustmentImpact,
  AdjustmentType,
  CommuteDestination,
  EvaluationAdjustment,
  EvaluationPriorities,
  EvaluationPriority,
  EvaluationRating,
  LoanAssumption,
  PassReason,
  Quest,
  QuestArea,
  QuestStage,
  QuestState,
  SearchCriteria,
  UserEvaluation,
  Visit,
  VisitPhoto,
  VisitType,
} from '../domain/models.ts'
import { parseCatalogSnapshot, type CatalogSnapshot } from '../data/catalogSnapshot.ts'
import type { QuestAppState } from '../app/questStore.ts'
import { parseVisitObservations, validateObservationPhotos } from '../domain/visitObservations.ts'
import { PersistError, BACKUP_UNREADABLE } from './errors.ts'
import { PERSISTENCE_SCHEMA_VERSION, type PersistenceSchemaVersion } from './schema.ts'

export interface PersistedUserStateV1 {
  catalogSnapshot?: CatalogSnapshot
  persistenceSchemaVersion: PersistenceSchemaVersion
  setupCompleted: boolean
  quest: Quest | null
  apartmentQuestStates: Record<string, QuestState>
  visitsByApartmentId: Record<string, Visit[]>
  userEvaluations: Record<string, UserEvaluation>
}

const QUEST_STAGES: ReadonlySet<QuestStage> = new Set([
  'DISCOVERED',
  'CANDIDATE',
  'VISITED',
  'SHORTLIST',
  'PASSED',
])

const PASS_REASONS: ReadonlySet<PassReason> = new Set([
  'PRICE',
  'COMMUTE',
  'COMPLEX',
  'NEIGHBORHOOD',
  'AFTER_VISIT',
  'OTHER',
])

const VISIT_TYPES: ReadonlySet<VisitType> = new Set([
  'WEEKDAY_DAY',
  'WEEKDAY_EVENING',
  'WEEKEND_DAY',
  'WEEKEND_EVENING',
  'OTHER',
])

const ADJUSTMENT_TYPES: ReadonlySet<AdjustmentType> = new Set(['POSITIVE', 'NEGATIVE'])
const ADJUSTMENT_IMPACTS: ReadonlySet<AdjustmentImpact> = new Set([
  'SMALL',
  'LARGE',
  'DECISIVE',
])

const PRIORITY_VALUES: ReadonlySet<EvaluationPriority> = new Set([0, 1, 2, 3, 4])

export function toPersistedUserState(state: QuestAppState): PersistedUserStateV1 {
  return {
    ...(state.catalogSnapshot ? { catalogSnapshot: parseCatalogSnapshot(state.catalogSnapshot) } : {}),
    persistenceSchemaVersion: PERSISTENCE_SCHEMA_VERSION,
    setupCompleted: state.setupCompleted,
    quest: state.quest === null ? null : cloneQuest(state.quest),
    apartmentQuestStates: mapValues(state.apartmentQuestStates, cloneQuestState),
    visitsByApartmentId: mapValues(state.visitsByApartmentId, (visits) =>
      visits.map(cloneVisit),
    ),
    userEvaluations: mapValues(state.userEvaluations, cloneUserEvaluation),
  }
}

export function persistedToAppState(snapshot: PersistedUserStateV1): QuestAppState {
  return {
    ...(snapshot.catalogSnapshot ? { catalogSnapshot: snapshot.catalogSnapshot } : {}),
    setupCompleted: snapshot.setupCompleted,
    quest: snapshot.quest,
    apartmentQuestStates: snapshot.apartmentQuestStates,
    visitsByApartmentId: snapshot.visitsByApartmentId,
    userEvaluations: snapshot.userEvaluations,
  }
}

export function parsePersistedUserState(value: unknown): PersistedUserStateV1 {
  if (!isRecord(value)) {
    throw new PersistError(BACKUP_UNREADABLE)
  }

  const schemaVersion = value.persistenceSchemaVersion
  if (schemaVersion !== 1 && schemaVersion !== PERSISTENCE_SCHEMA_VERSION) {
    throw new PersistError(BACKUP_UNREADABLE)
  }

  const setupCompleted = asBoolean(value.setupCompleted)
  const quest = parseQuest(value.quest)
  if (setupCompleted && quest === null) {
    throw new PersistError(BACKUP_UNREADABLE)
  }

  return {
    persistenceSchemaVersion: PERSISTENCE_SCHEMA_VERSION,
    setupCompleted,
    ...(value.catalogSnapshot !== undefined ? { catalogSnapshot: parseCatalogSnapshot(value.catalogSnapshot) } : {}),
    quest,
    apartmentQuestStates: parseQuestStateMap(value.apartmentQuestStates),
    visitsByApartmentId: parseVisitMap(value.visitsByApartmentId),
    userEvaluations: parseEvaluationMap(value.userEvaluations),
  }
}

export function collectPhotoBlobKeys(state: QuestAppState): string[] {
  const keys: string[] = []
  for (const visits of Object.values(state.visitsByApartmentId)) {
    for (const visit of visits) {
      for (const photo of visit.photos) {
        keys.push(photo.blobKey)
      }
    }
  }
  return keys
}

function cloneQuest(quest: Quest): Quest {
  return {
    id: quest.id,
    searchCriteria: cloneSearchCriteria(quest.searchCriteria),
    evaluationPriorities: { ...quest.evaluationPriorities },
    loanAssumption: { ...quest.loanAssumption },
    createdAt: quest.createdAt,
    updatedAt: quest.updatedAt,
  }
}

function cloneSearchCriteria(criteria: SearchCriteria): SearchCriteria {
  const next: SearchCriteria = {
    areas: criteria.areas.map((area) => ({ ...area })),
  }
  if (criteria.availableCash !== undefined) {
    next.availableCash = criteria.availableCash
  }
  if (criteria.expectedLoanLimit !== undefined) {
    next.expectedLoanLimit = criteria.expectedLoanLimit
  }
  if (criteria.minExclusiveArea !== undefined) {
    next.minExclusiveArea = criteria.minExclusiveArea
  }
  if (criteria.maxBuildingAge !== undefined) {
    next.maxBuildingAge = criteria.maxBuildingAge
  }
  if (criteria.minHouseholdCount !== undefined) {
    next.minHouseholdCount = criteria.minHouseholdCount
  }
  if (criteria.commuteDestination !== undefined) {
    next.commuteDestination = { ...criteria.commuteDestination }
  }
  if (criteria.maxCommuteMinutes !== undefined) {
    next.maxCommuteMinutes = criteria.maxCommuteMinutes
  }
  if (criteria.includeUnknown !== undefined) next.includeUnknown = criteria.includeUnknown
  return next
}

function cloneQuestState(state: QuestState): QuestState {
  const next: QuestState = {
    questId: state.questId,
    apartmentId: state.apartmentId,
    stage: state.stage,
    targetUnitTypeIds: [...state.targetUnitTypeIds],
    updatedAt: state.updatedAt,
  }
  if (state.candidateAt !== undefined) next.candidateAt = state.candidateAt
  if (state.shortlistRank !== undefined) {
    next.shortlistRank = state.shortlistRank
  }
  if (state.shortlistMemo !== undefined) {
    next.shortlistMemo = state.shortlistMemo
  }
  if (state.passedAt !== undefined) {
    next.passedAt = state.passedAt
  }
  if (state.passReason !== undefined) {
    next.passReason = state.passReason
  }
  if (state.passMemo !== undefined) {
    next.passMemo = state.passMemo
  }
  return next
}

function cloneVisit(visit: Visit): Visit {
  const next: Visit = {
    id: visit.id,
    questId: visit.questId,
    apartmentId: visit.apartmentId,
    visitedAt: visit.visitedAt,
    pros: [...visit.pros],
    cons: [...visit.cons],
    photos: visit.photos.map((photo) => ({ ...photo })),
    createdAt: visit.createdAt,
    updatedAt: visit.updatedAt,
  }
  if (visit.visitType !== undefined) {
    next.visitType = visit.visitType
  }
  if (visit.memo !== undefined) {
    next.memo = visit.memo
  }
  if (visit.observations !== undefined) next.observations = parseVisitObservations(visit.observations)
  return next
}

function cloneUserEvaluation(evaluation: UserEvaluation): UserEvaluation {
  return {
    questId: evaluation.questId,
    apartmentId: evaluation.apartmentId,
    ratings: { ...evaluation.ratings },
    adjustments: evaluation.adjustments.map((item) => ({ ...item })),
    updatedAt: evaluation.updatedAt,
  }
}

function parseQuest(value: unknown): Quest | null {
  if (value === null) {
    return null
  }
  if (!isRecord(value)) {
    throw new PersistError(BACKUP_UNREADABLE)
  }
  return {
    id: asId(value.id),
    searchCriteria: parseSearchCriteria(value.searchCriteria),
    evaluationPriorities: parseEvaluationPriorities(value.evaluationPriorities),
    loanAssumption: parseLoanAssumption(value.loanAssumption),
    createdAt: asIsoString(value.createdAt),
    updatedAt: asIsoString(value.updatedAt),
  }
}

function parseSearchCriteria(value: unknown): SearchCriteria {
  if (!isRecord(value)) {
    throw new PersistError(BACKUP_UNREADABLE)
  }
  const criteria: SearchCriteria = {
    areas: asArray(value.areas).map(parseQuestArea),
  }
  if (criteria.areas.length === 0) {
    throw new PersistError(BACKUP_UNREADABLE)
  }
  if (value.includeUnknown !== undefined) {
    if (typeof value.includeUnknown !== 'boolean') throw new PersistError(BACKUP_UNREADABLE)
    criteria.includeUnknown = value.includeUnknown
  }
  const availableCash = optionalNonNegativeNumber(value.availableCash)
  const expectedLoanLimit = optionalNonNegativeNumber(value.expectedLoanLimit)
  const minExclusiveArea = optionalNonNegativeNumber(value.minExclusiveArea)
  const maxBuildingAge = optionalNonNegativeNumber(value.maxBuildingAge)
  const minHouseholdCount = optionalNonNegativeNumber(value.minHouseholdCount)
  const maxCommuteMinutes = optionalNonNegativeNumber(value.maxCommuteMinutes)
  if (availableCash !== undefined) {
    criteria.availableCash = availableCash
  }
  if (expectedLoanLimit !== undefined) {
    criteria.expectedLoanLimit = expectedLoanLimit
  }
  if (minExclusiveArea !== undefined) {
    criteria.minExclusiveArea = minExclusiveArea
  }
  if (maxBuildingAge !== undefined) {
    criteria.maxBuildingAge = maxBuildingAge
  }
  if (minHouseholdCount !== undefined) {
    criteria.minHouseholdCount = minHouseholdCount
  }
  if (maxCommuteMinutes !== undefined) {
    criteria.maxCommuteMinutes = maxCommuteMinutes
  }
  if (value.commuteDestination !== undefined) {
    criteria.commuteDestination = parseCommuteDestination(value.commuteDestination)
  }
  return criteria
}

function parseQuestArea(value: unknown): QuestArea {
  if (!isRecord(value)) {
    throw new PersistError(BACKUP_UNREADABLE)
  }
  return {
    sidoCode: asNonEmptyString(value.sidoCode),
    sidoName: asNonEmptyString(value.sidoName),
    sigunguCode: asNonEmptyString(value.sigunguCode),
    sigunguName: asNonEmptyString(value.sigunguName),
  }
}

function parseCommuteDestination(value: unknown): CommuteDestination {
  if (!isRecord(value)) {
    throw new PersistError(BACKUP_UNREADABLE)
  }
  const destination: CommuteDestination = {
    id: asId(value.id),
    name: asNonEmptyString(value.name),
    latitude: asFiniteNumber(value.latitude),
    longitude: asFiniteNumber(value.longitude),
  }
  if (value.address !== undefined) {
    destination.address = asNonEmptyString(value.address)
  }
  return destination
}

function parseEvaluationPriorities(value: unknown): EvaluationPriorities {
  if (!isRecord(value)) {
    throw new PersistError(BACKUP_UNREADABLE)
  }
  return {
    stationAccess: asPriority(value.stationAccess),
    commuteFeel: asPriority(value.commuteFeel),
    commercial: asPriority(value.commercial),
    school: asPriority(value.school),
    nature: asPriority(value.nature),
    neighborhood: asPriority(value.neighborhood),
  }
}

function parseLoanAssumption(value: unknown): LoanAssumption {
  if (!isRecord(value)) {
    throw new PersistError(BACKUP_UNREADABLE)
  }
  const annualInterestRate = asFiniteNumber(value.annualInterestRate)
  const termYears = asFiniteNumber(value.termYears)
  if (annualInterestRate < 0 || termYears <= 0) {
    throw new PersistError(BACKUP_UNREADABLE)
  }
  return { annualInterestRate, termYears }
}

function parseQuestStateMap(value: unknown): Record<string, QuestState> {
  if (!isRecord(value)) {
    throw new PersistError(BACKUP_UNREADABLE)
  }
  const next: Record<string, QuestState> = {}
  for (const [apartmentId, state] of Object.entries(value)) {
    const parsed = parseQuestState(state)
    if (parsed.apartmentId !== apartmentId) {
      throw new PersistError(BACKUP_UNREADABLE)
    }
    next[apartmentId] = parsed
  }
  return next
}

function parseQuestState(value: unknown): QuestState {
  if (!isRecord(value)) {
    throw new PersistError(BACKUP_UNREADABLE)
  }
  const stage = asMember(value.stage, QUEST_STAGES)
  const state: QuestState = {
    questId: asId(value.questId),
    apartmentId: asId(value.apartmentId),
    stage,
    targetUnitTypeIds: asArray(value.targetUnitTypeIds).map(asId),
    updatedAt: asIsoString(value.updatedAt),
  }
  if (value.candidateAt !== undefined) state.candidateAt = asIsoString(value.candidateAt)
  if (value.shortlistRank !== undefined) {
    const rank = asFiniteNumber(value.shortlistRank)
    if (!Number.isInteger(rank) || rank < 1) {
      throw new PersistError(BACKUP_UNREADABLE)
    }
    state.shortlistRank = rank
  }
  if (value.shortlistMemo !== undefined) {
    state.shortlistMemo = asString(value.shortlistMemo)
  }
  if (value.passedAt !== undefined) {
    state.passedAt = asIsoString(value.passedAt)
  }
  if (value.passReason !== undefined) {
    state.passReason = asMember(value.passReason, PASS_REASONS)
  }
  if (value.passMemo !== undefined) {
    state.passMemo = asString(value.passMemo)
  }
  return state
}

function parseVisitMap(value: unknown): Record<string, Visit[]> {
  if (!isRecord(value)) {
    throw new PersistError(BACKUP_UNREADABLE)
  }
  const next: Record<string, Visit[]> = {}
  for (const [apartmentId, visits] of Object.entries(value)) {
    const parsed = asArray(visits).map(parseVisit)
    if (parsed.some((visit) => visit.apartmentId !== apartmentId)) {
      throw new PersistError(BACKUP_UNREADABLE)
    }
    next[apartmentId] = parsed
  }
  return next
}

function parseVisit(value: unknown): Visit {
  if (!isRecord(value)) {
    throw new PersistError(BACKUP_UNREADABLE)
  }
  const visit: Visit = {
    id: asId(value.id),
    questId: asId(value.questId),
    apartmentId: asId(value.apartmentId),
    visitedAt: asIsoString(value.visitedAt),
    pros: asArray(value.pros).map(asString),
    cons: asArray(value.cons).map(asString),
    photos: asArray(value.photos).map(parseVisitPhoto),
    createdAt: asIsoString(value.createdAt),
    updatedAt: asIsoString(value.updatedAt),
  }
  if (value.visitType !== undefined) {
    visit.visitType = asMember(value.visitType, VISIT_TYPES)
  }
  if (value.memo !== undefined) {
    visit.memo = asString(value.memo)
  }
  try {
    if (value.observations !== undefined) visit.observations = parseVisitObservations(value.observations)
    validateObservationPhotos(visit.observations, visit.photos)
  } catch { throw new PersistError(BACKUP_UNREADABLE) }
  return visit
}

function parseVisitPhoto(value: unknown): VisitPhoto {
  if (!isRecord(value)) {
    throw new PersistError(BACKUP_UNREADABLE)
  }
  return {
    id: asId(value.id),
    visitId: asId(value.visitId),
    blobKey: asNonEmptyString(value.blobKey),
    createdAt: asIsoString(value.createdAt),
  }
}

function parseEvaluationMap(value: unknown): Record<string, UserEvaluation> {
  if (!isRecord(value)) {
    throw new PersistError(BACKUP_UNREADABLE)
  }
  const next: Record<string, UserEvaluation> = {}
  for (const [apartmentId, evaluation] of Object.entries(value)) {
    const parsed = parseUserEvaluation(evaluation)
    if (parsed.apartmentId !== apartmentId) {
      throw new PersistError(BACKUP_UNREADABLE)
    }
    next[apartmentId] = parsed
  }
  return next
}

export function parseUserEvaluation(value: unknown): UserEvaluation {
  if (!isRecord(value)) {
    throw new PersistError(BACKUP_UNREADABLE)
  }
  if (!isRecord(value.ratings)) {
    throw new PersistError(BACKUP_UNREADABLE)
  }
  return {
    questId: asId(value.questId),
    apartmentId: asId(value.apartmentId),
    ratings: {
      stationAccess: asRating(value.ratings.stationAccess),
      commuteFeel: asRating(value.ratings.commuteFeel),
      commercial: asRating(value.ratings.commercial),
      school: asRating(value.ratings.school),
      nature: asRating(value.ratings.nature),
      neighborhood: asRating(value.ratings.neighborhood),
    },
    adjustments: asArray(value.adjustments).map(parseAdjustment),
    updatedAt: asIsoString(value.updatedAt),
  }
}

function parseAdjustment(value: unknown): EvaluationAdjustment {
  if (!isRecord(value)) {
    throw new PersistError(BACKUP_UNREADABLE)
  }
  return {
    id: asId(value.id),
    type: asMember(value.type, ADJUSTMENT_TYPES),
    description: asString(value.description),
    ...(value.impact === undefined
      ? {}
      : { impact: asMember(value.impact, ADJUSTMENT_IMPACTS) }),
    createdAt: asIsoString(value.createdAt),
  }
}

function optionalNonNegativeNumber(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined
  }
  const parsed = asFiniteNumber(value)
  if (parsed < 0) {
    throw new PersistError(BACKUP_UNREADABLE)
  }
  return parsed
}

function mapValues<T, U>(record: Record<string, T>, map: (value: T) => U): Record<string, U> {
  const next: Record<string, U> = {}
  for (const [key, value] of Object.entries(record)) {
    next[key] = map(value)
  }
  return next
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function asArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new PersistError(BACKUP_UNREADABLE)
  }
  return value
}

function asBoolean(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw new PersistError(BACKUP_UNREADABLE)
  }
  return value
}

function asString(value: unknown): string {
  if (typeof value !== 'string') {
    throw new PersistError(BACKUP_UNREADABLE)
  }
  return value
}

function asNonEmptyString(value: unknown): string {
  const text = asString(value)
  if (text.trim() === '') {
    throw new PersistError(BACKUP_UNREADABLE)
  }
  return text
}

function asId(value: unknown): string {
  return asNonEmptyString(value)
}

function asFiniteNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new PersistError(BACKUP_UNREADABLE)
  }
  return value
}

function asIsoString(value: unknown): string {
  const text = asNonEmptyString(value)
  if (!/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    throw new PersistError(BACKUP_UNREADABLE)
  }
  return text
}

function asPriority(value: unknown): EvaluationPriority {
  if (typeof value !== 'number' || !PRIORITY_VALUES.has(value as EvaluationPriority)) {
    throw new PersistError(BACKUP_UNREADABLE)
  }
  return value as EvaluationPriority
}

function asRating(value: unknown): EvaluationRating {
  if (value === null) {
    return null
  }
  if (value === 1 || value === 2 || value === 3 || value === 4 || value === 5) {
    return value
  }
  throw new PersistError(BACKUP_UNREADABLE)
}

function asMember<T extends string>(value: unknown, allowed: ReadonlySet<T>): T {
  if (typeof value !== 'string' || !allowed.has(value as T)) {
    throw new PersistError(BACKUP_UNREADABLE)
  }
  return value as T
}
