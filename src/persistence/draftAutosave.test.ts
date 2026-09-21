import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createDraftAutosave } from './draftAutosave.ts'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('draft autosave lifecycle', () => {
  test('coalesces rapid input into the latest snapshot', async () => {
    const write = vi.fn().mockResolvedValue(undefined)
    const autosave = createDraftAutosave(write, vi.fn())
    autosave.update('old')
    autosave.update('latest')
    await vi.advanceTimersByTimeAsync(349)
    expect(write).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(write).toHaveBeenCalledExactlyOnceWith('latest')
    expect(autosave.getStatus()).toBe('saved')
  })

  test('flushes pending content on exit without waiting for the debounce', async () => {
    const write = vi.fn().mockResolvedValue(undefined)
    const autosave = createDraftAutosave(write, vi.fn())
    autosave.update('draft')
    await autosave.flush()
    await vi.runAllTimersAsync()
    expect(write).toHaveBeenCalledExactlyOnceWith('draft')
  })

  test('keeps failed content for an explicit retry', async () => {
    const write = vi.fn().mockRejectedValueOnce(new Error('quota')).mockResolvedValue(undefined)
    const autosave = createDraftAutosave(write, vi.fn())
    autosave.update('photo and memo')
    await autosave.flush()
    expect(autosave.getStatus()).toBe('error')
    await autosave.flush()
    expect(autosave.getStatus()).toBe('saved')
    expect(write.mock.calls).toEqual([['photo and memo'], ['photo and memo']])
  })

  test('serializes writes and does not label newer pending input as saved', async () => {
    let finish!: () => void
    const write = vi.fn().mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve })).mockResolvedValue(undefined)
    const autosave = createDraftAutosave(write, vi.fn())
    autosave.update('first')
    const first = autosave.flush()
    await Promise.resolve()
    autosave.update('second')
    const second = autosave.flush()
    expect(write).toHaveBeenCalledTimes(1)
    finish()
    await first
    await second
    expect(write.mock.calls).toEqual([['first'], ['second']])
    expect(autosave.getStatus()).toBe('saved')
  })

  test('drains active writes before completion and never resurrects the draft on unmount', async () => {
    let finish!: () => void
    const write = vi.fn(() => new Promise<void>((resolve) => { finish = resolve }))
    const autosave = createDraftAutosave(write, vi.fn())
    autosave.update('in flight')
    void autosave.flush()
    await Promise.resolve()
    autosave.update('pending')
    let drained = false
    const pause = autosave.pause().then(() => { drained = true })
    await Promise.resolve()
    expect(drained).toBe(false)
    finish()
    await pause
    autosave.update('late render')
    await autosave.flush()
    await vi.runAllTimersAsync()
    expect(write).toHaveBeenCalledExactlyOnceWith('in flight')
  })

  test('resumes draft persistence after failed visit completion', async () => {
    const write = vi.fn().mockResolvedValue(undefined)
    const autosave = createDraftAutosave(write, vi.fn())
    autosave.update('old')
    await autosave.pause()
    autosave.resume()
    autosave.update('current complete form')
    await autosave.flush()
    expect(write).toHaveBeenCalledExactlyOnceWith('current complete form')
  })
})
