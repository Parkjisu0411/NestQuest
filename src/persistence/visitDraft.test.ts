import { describe, expect, test } from 'vitest'
import { parseVisitDraft, visitDraftKey, type VisitDraft } from './visitDraft.ts'

const draft: VisitDraft = {
  version: 1, id: 'draft-one', questId: 'quest', apartmentId: 'apartment',
  phase: 'rate', visitedLocal: '2026-09-17T14:30', visitType: 'WEEKDAY_DAY',
  photos: [{ id: 'photo', file: new Blob(['original photo'], { type: 'image/jpeg' }) }],
  pros: ['밝다'], cons: ['소음'], proDraft: '추가 전 장점', conDraft: '추가 전 단점',
  memo: '첫 줄\n둘째 줄', metricIndex: 3,
  ratings: { stationAccess: 4, commuteFeel: 3, commercial: null, school: null, nature: null, neighborhood: null },
  adjustments: [{ id: 'factor', type: 'POSITIVE', description: '추가 장점', createdAt: '2026-09-17T00:00:00.000Z' }],
  factorType: 'NEGATIVE', factorText: '추가 전 요인', updatedAt: '2026-09-17T00:00:00.000Z',
}

describe('visit draft storage contract', () => {
  test('round-trips photo originals, unsubmitted fields and evaluation progress through structured clone', async () => {
    const restored = parseVisitDraft(structuredClone(draft), 'quest', 'apartment')
    expect(restored).toEqual(draft)
    expect(await restored.photos[0].file.text()).toBe('original photo')
    expect(restored.metricIndex).toBe(3)
    expect(restored.proDraft).toBe('추가 전 장점')
    expect(restored.phase).toBe('rate')
  })

  test('separates quest and apartment keys without separator collisions', () => {
    expect(visitDraftKey('quest', 'a')).not.toBe(visitDraftKey('quest', 'b'))
    expect(visitDraftKey('a:b', 'c')).not.toBe(visitDraftKey('a', 'b:c'))
  })

  test.each([
    { version: 2 }, { questId: 'other' }, { apartmentId: 'other' },
    { phase: 'unknown' }, { metricIndex: 8 }, { photos: [{ id: 'photo', file: 'lost blob' }] },
    { pros: [1] }, { ratings: { ...draft.ratings, school: 8 } },
  ])('rejects invalid or unrelated drafts without replacing them: %j', (overrides) => {
    expect(() => parseVisitDraft({ ...draft, ...overrides }, 'quest', 'apartment')).toThrow('작성 중인 임장')
  })
})

test('observation fields and current section survive draft reload', () => {
  const input: VisitDraft = { ...draft, observations: { noise: { status: 'checked', note: '저녁 차량 소음\n도로 쪽' } }, observationGroup: 'complex' }
  expect(parseVisitDraft(structuredClone(input), 'quest', 'apartment')).toEqual(input)
})

test.each([{ observations: { noise: { status: 'good', note: '' } } }, { observationGroup: 'invalid-group' }])('rejects malformed observation draft %j', (change) => {
  expect(() => parseVisitDraft({ ...draft, ...change }, 'quest', 'apartment')).toThrow('작성 중인 임장')
})

test('photo links survive draft reload and reject links outside its photo list', () => {
  const input: VisitDraft = { ...draft, observations: { noise: { status: 'checked', note: '', photoIds: ['photo'] } } }
  expect(parseVisitDraft(structuredClone(input), 'quest', 'apartment').observations).toEqual(input.observations)
  expect(() => parseVisitDraft({ ...input, photos: [] }, 'quest', 'apartment')).toThrow('작성 중인 임장')
})
