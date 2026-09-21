import type { QuestState } from './models.ts'

export function listedShortlist(
  states: Record<string, QuestState>,
): QuestState[] {
  return Object.values(states)
    .filter((item) => item.stage === 'SHORTLIST')
    .sort((left, right) => {
      const leftRank = left.shortlistRank ?? Number.POSITIVE_INFINITY
      const rightRank = right.shortlistRank ?? Number.POSITIVE_INFINITY
      if (leftRank !== rightRank) {
        return leftRank - rightRank
      }
      return left.apartmentId.localeCompare(right.apartmentId)
    })
}

export function withNormalizedShortlistRanks(
  states: Record<string, QuestState>,
  now: string,
): Record<string, QuestState> {
  const listed = listedShortlist(states)
  if (listed.length === 0) {
    return states
  }

  const next = { ...states }
  listed.forEach((item, index) => {
    const rank = index + 1
    next[item.apartmentId] = {
      ...item,
      shortlistRank: rank,
      updatedAt: now,
    }
  })
  return next
}

export function addToShortlist(
  states: Record<string, QuestState>,
  apartmentId: string,
  now: string,
): Record<string, QuestState> {
  const current = states[apartmentId]
  if (!current || current.stage === 'PASSED' || current.stage === 'SHORTLIST') {
    return states
  }

  return {
    ...states,
    [apartmentId]: {
      ...current,
      stage: 'SHORTLIST',
      shortlistRank: listedShortlist(states).length + 1,
      updatedAt: now,
    },
  }
}

export function removeFromShortlist(
  states: Record<string, QuestState>,
  apartmentId: string,
  now: string,
  hasVisit = true,
): Record<string, QuestState> {
  const current = states[apartmentId]
  if (!current || current.stage !== 'SHORTLIST') {
    return states
  }

  const rest: QuestState = {
    ...current,
    stage: hasVisit ? 'VISITED' : 'CANDIDATE',
    updatedAt: now,
  }
  delete rest.shortlistRank

  return withNormalizedShortlistRanks(
    {
      ...states,
      [apartmentId]: rest,
    },
    now,
  )
}

export function moveShortlist(
  states: Record<string, QuestState>,
  apartmentId: string,
  direction: 'up' | 'down',
  now: string,
): Record<string, QuestState> {
  const listed = listedShortlist(states)
  const index = listed.findIndex((item) => item.apartmentId === apartmentId)
  const swapIndex = direction === 'up' ? index - 1 : index + 1
  if (index < 0 || swapIndex < 0 || swapIndex >= listed.length) {
    return states
  }

  const current = listed[index]
  const other = listed[swapIndex]
  return withNormalizedShortlistRanks(
    {
      ...states,
      [current.apartmentId]: {
        ...current,
        shortlistRank: other.shortlistRank ?? swapIndex + 1,
        updatedAt: now,
      },
      [other.apartmentId]: {
        ...other,
        shortlistRank: current.shortlistRank ?? index + 1,
        updatedAt: now,
      },
    },
    now,
  )
}

export function setShortlistMemo(
  states: Record<string, QuestState>,
  apartmentId: string,
  memo: string,
  now: string,
): Record<string, QuestState> {
  const current = states[apartmentId]
  if (!current || current.stage !== 'SHORTLIST') {
    return states
  }

  const trimmed = memo.trim()
  const next: QuestState = {
    ...current,
    updatedAt: now,
  }
  if (trimmed === '') {
    delete next.shortlistMemo
  } else {
    next.shortlistMemo = trimmed
  }

  return {
    ...states,
    [apartmentId]: next,
  }
}
