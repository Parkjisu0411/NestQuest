import type { Apartment } from '../domain/models.ts'
import { useQuestState } from '../app/useQuest.ts'
import { commuteQueryKey, getCommuteServiceIssue, useCommuteQueries } from '../data/commuteSession.ts'

export function CommuteStatus({ apartment }: { apartment: Apartment }) {
  const destination = useQuestState().quest?.searchCriteria.commuteDestination
  const queries = useCommuteQueries()
  if (!destination) return null
  const query = queries.get(commuteQueryKey(apartment, destination))
  if (query?.status === 'success') return null
  const issue = getCommuteServiceIssue()
  const reason = issue?.kind === 'limit' ? 'Kakao 호출 한도 초과 · 한도 갱신 후 재조회 필요'
    : issue?.message ?? (query?.status === 'loading' ? '조회 중' : query?.message)
    ?? (apartment.latitude === undefined || apartment.longitude === undefined ? '단지 좌표 미확인' : '아직 조회하지 않음')
  return <span>통근: {reason}</span>
}
