import { expect, test } from 'vitest'
import { parseVisitObservations, unlinkObservationPhoto, validateObservationPhotos, type VisitObservations } from './visitObservations.ts'

test('removing a shared photo unlinks every item while preserving notes and other links', () => {
  const value: VisitObservations = { noise: { status: 'checked', note: '도로', photoIds: ['shared', 'keep'] }, parking: { status: 'unchecked', note: '다시 확인', photoIds: ['shared'] } }
  const next = unlinkObservationPhoto(value, 'shared')
  expect(next.noise).toEqual({ status: 'checked', note: '도로', photoIds: ['keep'] })
  expect(next.parking?.photoIds).toEqual([])
  expect(value.parking?.photoIds).toEqual(['shared'])
})

test('links clone independently and legacy observations need no links', () => {
  const value: VisitObservations = { noise: { status: 'checked', note: '', photoIds: ['photo'] } }
  const copy = parseVisitObservations(value)!
  expect(copy).toEqual(value)
  expect(copy.noise?.photoIds).not.toBe(value.noise?.photoIds)
  expect(parseVisitObservations({ noise: { status: 'unchecked', note: '' } })?.noise?.photoIds).toBeUndefined()
})

test.each([['same', 'same'], [7], [''], 'photo'].map((photoIds) => ({ photoIds })))('rejects malformed photo ids %j', ({ photoIds }) => {
  expect(() => parseVisitObservations({ noise: { status: 'checked', note: '', photoIds } })).toThrow()
})

test('only photos belonging to this visit may be linked; missing originals do not invalidate metadata', () => {
  const value: VisitObservations = { noise: { status: 'checked', note: '', photoIds: ['photo'] } }
  expect(() => validateObservationPhotos(value, [{ id: 'photo' }])).not.toThrow()
  expect(() => validateObservationPhotos(value, [{ id: 'other-visit-photo' }])).toThrow()
})
