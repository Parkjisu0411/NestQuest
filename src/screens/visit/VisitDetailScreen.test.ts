import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, test } from 'vitest'
import { initialQuestState, QuestStateContext } from '../../app/questStore.ts'
import type { Visit } from '../../domain/models.ts'
import { VisitDetailScreen } from './VisitDetailScreen.tsx'

const visit: Visit = {
  id: 'visit-one', questId: 'quest', apartmentId: 'apt-magok-mvalley-7',
  visitedAt: '2026-09-17T03:00:00.000Z',
  pros: ['첫 번째 장점', '두 번째 장점'],
  cons: ['첫 번째 단점', '두 번째 단점'],
  memo: '메모 첫 줄\n메모 둘째 줄 <script>실행 금지</script>',
  photos: [{ id: 'photo-one', visitId: 'visit-one', blobKey: 'photo-blob', createdAt: '2026-09-17T03:00:00.000Z' }],
  createdAt: '2026-09-17T03:00:00.000Z', updatedAt: '2026-09-17T03:00:00.000Z',
}

function renderVisit(path: string, visits: Visit[] = [visit]) {
  return renderToStaticMarkup(createElement(QuestStateContext.Provider, {
    value: { ...initialQuestState, visitsByApartmentId: { [visit.apartmentId]: visits } },
  }, createElement(MemoryRouter, { initialEntries: [path] },
    createElement(Routes, null,
      createElement(Route, {
        path: '/apartments/:apartmentId/visits/:visitId',
        element: createElement(VisitDetailScreen),
      }),
    ),
  )))
}

describe('saved visit detail', () => {
  test('shows all observations, multiline memo, and photo count with escaped user text', () => {
    const html = renderVisit(`/apartments/${visit.apartmentId}/visits/${visit.id}`)
    for (const text of [...visit.pros, ...visit.cons, '메모 첫 줄\n메모 둘째 줄', '사진 1장']) {
      expect(html).toContain(text)
    }
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
    expect(html).toContain(`/apartments/${visit.apartmentId}`)
  })

  test('selects the requested visit rather than another visit at the same apartment', () => {
    const another = { ...visit, id: 'visit-two', memo: '다른 날의 기록' }
    const html = renderVisit(`/apartments/${visit.apartmentId}/visits/visit-two`, [visit, another])
    expect(html).toContain('다른 날의 기록')
    expect(html).not.toContain('메모 첫 줄')
  })

  test('does not show a visit belonging to another apartment', () => {
    const html = renderVisit(`/apartments/another-apartment/visits/${visit.id}`)
    expect(html).toContain('이 방문 기록을 찾을 수 없습니다.')
    expect(html).not.toContain(visit.pros[0])
  })

  test('shows missing visit and empty field states', () => {
    expect(renderVisit(`/apartments/${visit.apartmentId}/visits/missing`))
      .toContain('이 방문 기록을 찾을 수 없습니다.')
    const html = renderVisit(`/apartments/${visit.apartmentId}/visits/${visit.id}`, [
      { ...visit, pros: [], cons: [], memo: undefined, photos: [] },
    ])
    expect(html).toContain('남긴 기록이 없습니다.')
    expect(html).toContain('남긴 메모가 없습니다.')
    expect(html).toContain('첨부한 사진이 없습니다.')
  })
})

test('observation links target the shared gallery photo and identify its categories', () => {
  const html = renderVisit(`/apartments/${visit.apartmentId}/visits/${visit.id}`, [{ ...visit, observations: {
    noise: { status: 'checked', note: '도로', photoIds: ['photo-one'] },
    parking: { status: 'checked', note: '', photoIds: ['photo-one'] },
  } }])
  expect(html.match(/href="#visit-photo-1"/g)).toHaveLength(2)
  expect(html.match(/id="visit-photo-1"/g)).toHaveLength(1)
  expect(html).toContain('주차·차량 동선 · 소음·냄새')
})
