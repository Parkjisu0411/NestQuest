import { describe, expect, it, vi } from 'vitest'
import { independentProviderStages } from './independentProviderStages.ts'
import { ApiError } from './http.ts'

describe('independent automatic provider stages', () => {
  it('continues detail and prices for later apartments after an Kakao quota error', async () => {
    const report=vi.fn(), run=independentProviderStages(new AbortController().signal, report)
    const commute=vi.fn(async()=>{throw new ApiError('Kakao 한도','limit')})
    const details=vi.fn(async()=>{}), prices=vi.fn(async()=>{})
    for(let index=0;index<3;index++) {
      await run('detail',details); await run('commute',commute); await run('prices',prices)
    }
    expect(commute).toHaveBeenCalledTimes(1)
    expect(details).toHaveBeenCalledTimes(3)
    expect(prices).toHaveBeenCalledTimes(3)
    expect(report).toHaveBeenCalledWith('commute','Kakao 한도')
  })
  it('a trade failure does not prevent route lookup',async()=>{
    const run=independentProviderStages(new AbortController().signal,vi.fn()), commute=vi.fn(async()=>{})
    await run('prices',async()=>{throw new ApiError('거래 오류','format')})
    await run('commute',commute)
    expect(commute).toHaveBeenCalledOnce()
  })
  it('does not swallow storage errors or cancellation',async()=>{
    const abort=new AbortController(), run=independentProviderStages(abort.signal,vi.fn())
    await expect(run('detail',async()=>{throw new Error('저장 실패')})).rejects.toThrow('저장 실패')
    abort.abort()
    const fetch=vi.fn(async()=>{})
    await expect(run('commute',fetch)).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })
})
