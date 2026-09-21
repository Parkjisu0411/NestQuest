import { useContext, type Dispatch } from 'react'
import {
  QuestDispatchContext,
  QuestStateContext,
  type QuestAction,
  type QuestAppState,
} from './questStore.ts'

export function useQuestState(): QuestAppState {
  const value = useContext(QuestStateContext)
  if (value === null) {
    throw new Error('useQuestState must be used within QuestProvider')
  }
  return value
}

export function useQuestDispatch(): Dispatch<QuestAction> {
  const value = useContext(QuestDispatchContext)
  if (value === null) {
    throw new Error('useQuestDispatch must be used within QuestProvider')
  }
  return value
}
