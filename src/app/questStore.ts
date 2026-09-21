import { createContext, type Dispatch } from 'react'
import type {
  EvaluationPriorities,
  LoanAssumption,
  PassReason,
  Quest,
  QuestState,
  SearchCriteria,
  UserEvaluation,
  Visit,
} from '../domain/models.ts'
import {
  addToShortlist,
  moveShortlist,
  removeFromShortlist,
  setShortlistMemo,
  withNormalizedShortlistRanks,
} from '../domain/shortlist.ts'
import { stageAfterVisit } from '../domain/stages.ts'
import { catalogForState, createInitialApartmentQuestStates } from '../data/apartments.ts'
import type { CatalogSnapshot } from '../data/catalogSnapshot.ts'

export interface QuestAppState {
  catalogSnapshot?: CatalogSnapshot
  setupCompleted: boolean
  quest: Quest | null
  apartmentQuestStates: Record<string, QuestState>
  visitsByApartmentId: Record<string, Visit[]>
  userEvaluations: Record<string, UserEvaluation>
}

export type QuestAction =
  | { type: 'updateVisit'; visit: Visit }
  | { type: 'passApartment'; apartmentId: string; reason: PassReason; memo: string }
  | { type: 'restoreApartment'; apartmentId: string }
  | {
      type: 'completeSetup'
      quest: Quest
    }
  | {
      type: 'markCandidate'
      apartmentId: string
    }
  | {
      type: 'completeVisit'
      visit: Visit
      evaluation?: UserEvaluation
    }
  | {
      type: 'updateEvaluation'
      evaluation: UserEvaluation
    }
  | {
      type: 'addToShortlist'
      apartmentId: string
    }
  | {
      type: 'removeFromShortlist'
      apartmentId: string
    }
  | {
      type: 'moveShortlist'
      apartmentId: string
      direction: 'up' | 'down'
    }
  | {
      type: 'setShortlistMemo'
      apartmentId: string
      memo: string
    }
  | {
      type: 'updateQuest'
      searchCriteria?: SearchCriteria
      evaluationPriorities?: EvaluationPriorities
      loanAssumption?: LoanAssumption
    }
  | {
      type: 'replaceState'
      state: QuestAppState
    }

export const initialQuestState: QuestAppState = {
  setupCompleted: false,
  quest: null,
  apartmentQuestStates: {},
  visitsByApartmentId: {},
  userEvaluations: {},
}

export function questReducer(
  state: QuestAppState,
  action: QuestAction,
): QuestAppState {
  switch (action.type) {
    case 'updateVisit': {
      const visit = action.visit
      const visits = state.visitsByApartmentId[visit.apartmentId] ?? []
      const original = visits.find((item) => item.id === visit.id && item.questId === visit.questId)
      if (!state.quest || visit.questId !== state.quest.id || !original) return state
      return { ...state, visitsByApartmentId: { ...state.visitsByApartmentId,
        [visit.apartmentId]: visits.map((item) => item === original ? { ...visit, createdAt: original.createdAt } : item),
      } }
    }
    case 'passApartment': {
      if (!state.quest || !action.apartmentId) return state
      const current = state.apartmentQuestStates[action.apartmentId]
      if (current?.stage === 'PASSED' || (current && current.questId !== state.quest.id)) return state
      const now = new Date().toISOString()
      const next: QuestState = {
        ...(current ?? { questId: state.quest.id, apartmentId: action.apartmentId, targetUnitTypeIds: [] }),
        stage: 'PASSED', passedAt: now, passReason: action.reason,
        passMemo: action.memo.trim(), updatedAt: now,
      }
      delete next.shortlistRank
      return { ...state, apartmentQuestStates: withNormalizedShortlistRanks({ ...state.apartmentQuestStates, [action.apartmentId]: next }, now) }
    }
    case 'restoreApartment': {
      const current = state.apartmentQuestStates[action.apartmentId]
      if (!state.quest || current?.stage !== 'PASSED' || current.questId !== state.quest.id) return state
      const hasVisit = (state.visitsByApartmentId[action.apartmentId] ?? []).some((visit) => visit.questId === state.quest?.id && visit.apartmentId === action.apartmentId)
      const next: QuestState = { ...current, stage: hasVisit ? 'VISITED' : 'CANDIDATE', updatedAt: new Date().toISOString() }
      delete next.shortlistRank
      delete next.passedAt
      delete next.passReason
      delete next.passMemo
      return { ...state, apartmentQuestStates: { ...state.apartmentQuestStates, [action.apartmentId]: next } }
    }
    case 'completeSetup':
      return {
        setupCompleted: true,
        quest: action.quest,
        apartmentQuestStates: createInitialApartmentQuestStates(action.quest),
        visitsByApartmentId: {},
        userEvaluations: {},
      }
    case 'markCandidate': {
      if (!state.quest) {
        return state
      }

      const current = state.apartmentQuestStates[action.apartmentId]
      if (current && current.stage !== 'DISCOVERED') {
        return state
      }

      const now = new Date().toISOString()
      return {
        ...state,
        apartmentQuestStates: {
          ...state.apartmentQuestStates,
          [action.apartmentId]: current
            ? {
                ...current,
                stage: 'CANDIDATE',
                candidateAt: now,
                updatedAt: now,
              }
            : {
                questId: state.quest.id,
                apartmentId: action.apartmentId,
                stage: 'CANDIDATE',
                candidateAt: now,
                targetUnitTypeIds: [],
                updatedAt: now,
              },
        },
      }
    }
    case 'completeVisit': {
      if (!state.quest || action.visit.apartmentId === '' || action.visit.questId !== state.quest.id) {
        return state
      }

      const apartmentId = action.visit.apartmentId
      const now = action.visit.updatedAt
      const existingVisits = state.visitsByApartmentId[apartmentId] ?? []
      if (existingVisits.some((visit) => visit.id === action.visit.id)) {
        return state
      }
      const current = state.apartmentQuestStates[apartmentId]
      const nextStage = current ? stageAfterVisit(current.stage) : 'VISITED'
      const nextQuestState: QuestState = current
        ? {
            ...current,
            stage: nextStage,
            updatedAt: now,
          }
        : {
            questId: state.quest.id,
            apartmentId,
            stage: 'VISITED',
            targetUnitTypeIds: [],
            updatedAt: now,
          }

      return {
        ...state,
        visitsByApartmentId: {
          ...state.visitsByApartmentId,
          [apartmentId]: [...existingVisits, action.visit],
        },
        userEvaluations: action.evaluation
          ? {
              ...state.userEvaluations,
              [apartmentId]: action.evaluation,
            }
          : state.userEvaluations,
        apartmentQuestStates: {
          ...state.apartmentQuestStates,
          [apartmentId]: nextQuestState,
        },
      }
    }
    case 'updateEvaluation': {
      const evaluation = action.evaluation
      const visits = state.visitsByApartmentId[evaluation.apartmentId] ?? []
      if (!state.quest || evaluation.questId !== state.quest.id || !visits.some(
        (visit) => visit.questId === evaluation.questId && visit.apartmentId === evaluation.apartmentId,
      )) {
        return state
      }
      return {
        ...state,
        userEvaluations: { ...state.userEvaluations, [evaluation.apartmentId]: evaluation },
      }
    }
    case 'addToShortlist': {
      if (!state.quest || !catalogForState(state).find(action.apartmentId)) return state
      const states = state.apartmentQuestStates[action.apartmentId] ? state.apartmentQuestStates : {
        ...state.apartmentQuestStates,
        [action.apartmentId]: { questId: state.quest.id, apartmentId: action.apartmentId, stage: 'DISCOVERED' as const, targetUnitTypeIds: [], updatedAt: new Date().toISOString() },
      }
      return {
        ...state,
        apartmentQuestStates: addToShortlist(
          states,
          action.apartmentId,
          new Date().toISOString(),
        ),
      }
    }
    case 'removeFromShortlist':
      return {
        ...state,
        apartmentQuestStates: removeFromShortlist(
          state.apartmentQuestStates,
          action.apartmentId,
          new Date().toISOString(),
          (state.visitsByApartmentId[action.apartmentId] ?? []).some((visit) => visit.questId === state.quest?.id),
        ),
      }
    case 'moveShortlist':
      return {
        ...state,
        apartmentQuestStates: moveShortlist(
          state.apartmentQuestStates,
          action.apartmentId,
          action.direction,
          new Date().toISOString(),
        ),
      }
    case 'setShortlistMemo':
      return {
        ...state,
        apartmentQuestStates: setShortlistMemo(
          state.apartmentQuestStates,
          action.apartmentId,
          action.memo,
          new Date().toISOString(),
        ),
      }
    case 'updateQuest': {
      if (!state.quest) {
        return state
      }
      if (
        action.searchCriteria === undefined &&
        action.evaluationPriorities === undefined &&
        action.loanAssumption === undefined
      ) {
        return state
      }

      return {
        ...state,
        quest: {
          ...state.quest,
          searchCriteria: action.searchCriteria ?? state.quest.searchCriteria,
          evaluationPriorities:
            action.evaluationPriorities ?? state.quest.evaluationPriorities,
          loanAssumption: action.loanAssumption ?? state.quest.loanAssumption,
          updatedAt: new Date().toISOString(),
        },
      }
    }
    case 'replaceState':
      return action.state
  }
}

export const QuestStateContext = createContext<QuestAppState | null>(null)
export const QuestDispatchContext = createContext<Dispatch<QuestAction> | null>(
  null,
)
