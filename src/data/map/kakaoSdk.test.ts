import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('Kakao map SDK lifecycle', () => {
  let scripts: { src: string; onload?: () => void; onerror?: () => void; remove: ReturnType<typeof vi.fn> }[]
  beforeEach(() => {
    vi.resetModules(); vi.useFakeTimers(); scripts = []
    vi.stubGlobal('window', { setTimeout, clearTimeout })
    vi.stubGlobal('document', {
      createElement: () => ({ src:'', remove:vi.fn() }),
      head:{ appendChild:(script: typeof scripts[number]) => scripts.push(script) },
    })
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
  it('does not request anything without a key', async () => {
    const { loadKakaoMaps } = await import('./kakaoSdk.ts')
    await expect(loadKakaoMaps('')).rejects.toThrow('JavaScript 키')
    expect(scripts).toHaveLength(0)
  })
  it('shares one SDK load across consumers and waits for the SDK callback', async () => {
    const { loadKakaoMaps } = await import('./kakaoSdk.ts')
    const first = loadKakaoMaps('synthetic-map-key')
    expect(loadKakaoMaps('synthetic-map-key')).toBe(first)
    expect(scripts).toHaveLength(1)
    const maps = { Map:vi.fn(), CustomOverlay:vi.fn(), load:(callback: () => void) => callback() }
    Object.assign(window,{kakao:{maps}})
    scripts[0].onload!()
    await expect(first).resolves.toBe(maps)
  })
  it('returns a safe error and permits a retry after script failure', async () => {
    const { loadKakaoMaps } = await import('./kakaoSdk.ts')
    const first = loadKakaoMaps('synthetic-secret')
    const error = first.catch(reason => reason as Error)
    scripts[0].onerror!()
    expect((await error).message).not.toContain('synthetic-secret')
    expect(scripts[0].remove).toHaveBeenCalledOnce()
    const retry = loadKakaoMaps('synthetic-secret').catch(reason => reason as Error)
    expect(scripts).toHaveLength(2)
    scripts[1].onerror!(); await retry
  })
  it('times out without exposing URLs and ignores late callbacks', async () => {
    const { loadKakaoMaps } = await import('./kakaoSdk.ts')
    const failed = loadKakaoMaps('synthetic-secret').catch(reason => reason as Error)
    await vi.advanceTimersByTimeAsync(20000)
    expect((await failed).message).not.toContain('appkey')
    expect(scripts[0].remove).toHaveBeenCalledOnce()
    scripts[0].onload!()
    expect(scripts[0].remove).toHaveBeenCalledOnce()
  })
})
