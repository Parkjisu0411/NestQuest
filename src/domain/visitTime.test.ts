import { expect, test } from 'vitest'
import { editedVisitTime, toLocalVisitTime } from './visitTime.ts'

test('editing notes alone preserves the exact original instant including seconds', () => {
  const original = '2026-09-18T00:19:42.321Z'
  expect(editedVisitTime(original, toLocalVisitTime(original))).toBe(original)
})
test('explicitly edited time uses the local input', () => {
  expect(editedVisitTime('2026-09-18T00:19:42.321Z', '2026-09-19T12:30')).toBe(new Date('2026-09-19T12:30').toISOString())
})
test.each(['', 'invalid'])('invalid input does not silently become the current time: %s', (input) => {
  expect(() => editedVisitTime('2026-09-18T00:19:42.321Z', input)).toThrow('방문 시각')
})
