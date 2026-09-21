export const VISIT_OBSERVATION_GROUPS = [
  { id: 'interior', label: '집 내부 (선택)', items: [
    { id: 'unitIdentity', label: '방문한 집', hint: '필요하면 동·층·향·면적을 기록하세요. 내부에 들어가지 않았다면 비워 두세요.' },
    { id: 'daylight', label: '채광·환기·실내 소음', hint: '확인한 시각, 창 방향, 환기와 소음을 기록하세요.' },
    { id: 'condition', label: '누수·결로·설비 상태', hint: '직접 확인한 흔적과 추가 확인할 곳을 기록하세요.' },
    { id: 'layout', label: '구조·수납·수리 필요', hint: '가구 배치, 수납, 수리할 부분을 기록하세요.' },
  ] },
  { id: 'access', label: '이동·접근', items: [
    { id: 'stationWalk', label: '역·정류장까지 이동', hint: '직접 걸린 시간, 횡단보도, 계단을 기록하세요.' },
    { id: 'walkingRoute', label: '보행 동선·경사', hint: '경사, 보도 폭, 유모차·보행 접근을 확인하세요.' },
    { id: 'commuteRoute', label: '통근 경로 체감', hint: '직접 확인한 환승·대기·혼잡을 기록하세요.' },
  ] },
  { id: 'complex', label: '단지 환경', items: [
    { id: 'parking', label: '주차·차량 동선', hint: '방문 시점의 주차 여유와 보행 동선 분리를 확인하세요.' },
    { id: 'maintenance', label: '공용부 관리', hint: '출입구, 엘리베이터, 쓰레기장 상태를 기록하세요.' },
    { id: 'noise', label: '소음·냄새', hint: '확인한 장소와 시간, 원인을 함께 남기세요.' },
  ] },
  { id: 'surroundings', label: '주변 생활', items: [
    { id: 'amenities', label: '상점·병원 등 편의시설', hint: '실제로 이용할 시설까지의 거리와 동선을 확인하세요.' },
    { id: 'schoolRoute', label: '학교 주변·통학 동선', hint: '횡단보도와 차량 통행 등 직접 본 내용을 남기세요.' },
    { id: 'walkingArea', label: '산책·동네 분위기', hint: '공원 접근, 조명, 방문 시간대 분위기를 기록하세요.' },
  ] },
] as const
export type ObservationGroupId = typeof VISIT_OBSERVATION_GROUPS[number]['id']
export type ObservationId = typeof VISIT_OBSERVATION_GROUPS[number]['items'][number]['id']
export const OBSERVATION_STATUS_LABELS = { unchecked: '미확인', checked: '확인함', notApplicable: '해당 없음' } as const
export type ObservationStatus = keyof typeof OBSERVATION_STATUS_LABELS
export type VisitObservations = Partial<Record<ObservationId, { status: ObservationStatus; note: string; photoIds?: string[] }>>

/** Optional for legacy records; reject malformed content instead of losing notes. */
export function parseVisitObservations(value: unknown): VisitObservations | undefined {
  if (value === undefined) return undefined
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid observations')
  const ids: string[] = VISIT_OBSERVATION_GROUPS.flatMap((group) => group.items.map((item) => item.id))
  const result: VisitObservations = {}
  for (const [id, entry] of Object.entries(value)) {
    if (!ids.includes(id) || !entry || typeof entry !== 'object' ||
      !Object.hasOwn(OBSERVATION_STATUS_LABELS, entry.status) || typeof entry.note !== 'string') throw new Error('Invalid observation')
    result[id as ObservationId] = { status: entry.status, note: entry.note }
    if (entry.photoIds !== undefined) {
      if (!Array.isArray(entry.photoIds) || !entry.photoIds.every((photoId: unknown) => typeof photoId === 'string' && photoId.trim().length > 0) || new Set(entry.photoIds).size !== entry.photoIds.length) throw new Error('Invalid photo links')
      result[id as ObservationId]!.photoIds = [...entry.photoIds]
    }
  }
  return result
}

export function unlinkObservationPhoto(value: VisitObservations, photoId: string): VisitObservations {
  return Object.fromEntries(Object.entries(value).map(([id, entry]) => [id,
    entry.photoIds?.includes(photoId) ? { ...entry, photoIds: entry.photoIds.filter((id) => id !== photoId) } : entry,
  ]))
}

export function validateObservationPhotos(value: VisitObservations | undefined, photos: { id: string }[]) {
  const ids = new Set(photos.map((photo) => photo.id))
  if (Object.values(value ?? {}).some((entry) => entry.photoIds?.some((id) => !ids.has(id)))) throw new Error('Unknown observation photo')
}
