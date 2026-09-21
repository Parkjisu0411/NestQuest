import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, test } from 'vitest'
import { QuestPersistContext, type QuestPersist } from '../../app/persistContext.ts'
import { initialQuestState, QuestStateContext, type QuestAppState } from '../../app/questStore.ts'
import { EvaluationScreen } from './EvaluationScreen.tsx'

const apartmentId = 'apt-magok-mvalley-7'
const now = '2026-09-17T00:00:00.000Z'
const state: QuestAppState = {
  ...initialQuestState, setupCompleted: true,
  quest: {
    id: 'quest', searchCriteria: { areas: [] },
    evaluationPriorities: { stationAccess: 1, commuteFeel: 1, commercial: 1, school: 0, nature: 1, neighborhood: 1 },
    loanAssumption: { annualInterestRate: 0.04, termYears: 30 }, createdAt: now, updatedAt: now,
  },
  visitsByApartmentId: { [apartmentId]: [{
    id: 'visit', questId: 'quest', apartmentId, visitedAt: now,
    pros: [], cons: [], photos: [], createdAt: now, updatedAt: now,
  }] },
  userEvaluations: { [apartmentId]: {
    questId: 'quest', apartmentId,
    ratings: { stationAccess: 4, commuteFeel: 4, commercial: 4, school: null, nature: 4, neighborhood: 4 },
    adjustments: [{ id: 'note', type: 'POSITIVE', description: '기존 장점', impact: 'LARGE', createdAt: now }],
    updatedAt: now,
  } },
}
const persistence: QuestPersist = {
  writeError: null, exportBackupFile() {}, async restoreBackupText() {},
  async completeVisit() {}, async saveEvaluation() {}, async saveVisitEdit() {},
  async exportPhotoBackup() {}, async restoreBackupFile() {},
}

function render(current: QuestAppState) {
  return renderToStaticMarkup(createElement(QuestStateContext.Provider, { value: current },
    createElement(QuestPersistContext.Provider, { value: persistence },
      createElement(MemoryRouter, { initialEntries: [`/apartments/${apartmentId}/evaluation`] },
        createElement(Routes, null, createElement(Route, {
          path: '/apartments/:apartmentId/evaluation', element: createElement(EvaluationScreen),
        })),
      ),
    ),
  ))
}

describe('evaluation editor rendering', () => {
  test('loads the saved ratings and notes without visit capture controls', () => {
    const html = render(state)
    expect(html).toContain('평가 수정')
    expect(html).toContain('기존 장점')
    expect(html).toContain('내 점수 4.0')
    expect(html).toContain('평가 저장')
    expect(html).not.toContain('사진 추가')
    expect(html).not.toContain('임장 완료')
    expect(html).not.toContain('LARGE')
  })
  test('offers a blank first evaluation after a saved visit', () => {
    const html = render({ ...state, userEvaluations: {} })
    expect(html).toContain('평가하기')
    expect(html).toContain('평가한 항목과 중요도가 있어야')
  })
  test('blocks editing via a direct URL without a visit', () => {
    const html = render({ ...state, visitsByApartmentId: {} })
    expect(html).toContain('임장 기록을 남긴 뒤 평가할 수 있습니다.')
    expect(html).not.toContain('평가 저장')
  })
})
