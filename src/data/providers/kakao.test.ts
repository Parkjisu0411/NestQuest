import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requestApi } from './http.ts'
import { geocode } from './kakao.ts'
vi.mock('./http.ts', async(original)=>({...await original<typeof import('./http.ts')>(),requestApi:vi.fn()}))
beforeEach(()=>vi.resetAllMocks())
describe('Kakao REST geocoding (synthetic responses)',()=>{
  it('uses authorization header, exact address query and abort signal without a SDK',async()=>{
    vi.mocked(requestApi).mockResolvedValue({documents:[{address_name:'테스트',x:'126.9',y:'37.5'}]})
    const signal=new AbortController().signal
    expect(await geocode(' 테스트 ',' private-key ',signal)).toEqual({longitude:126.9,latitude:37.5})
    expect(requestApi).toHaveBeenCalledWith('geocode',{query:'테스트',analyze_type:'exact'},signal,{Authorization:'KakaoAK private-key'})
  })
  it('distinguishes no result from ambiguous or invalid coordinates',async()=>{
    vi.mocked(requestApi).mockResolvedValueOnce({documents:[]});expect(await geocode('주소','key')).toBeNull()
    for(const documents of [[{address_name:'x',x:'',y:'37'}],[{address_name:'x',x:'190',y:'37'}],[{address_name:'x',x:'127',y:'37'},{address_name:'y',x:'127',y:'37'}]]) {
      vi.mocked(requestApi).mockResolvedValueOnce({documents});await expect(geocode('주소','key')).rejects.toThrow()
    }
  })
  it('never starts an unauthenticated or empty-address call',async()=>{
    await expect(geocode('주소','')).rejects.toThrow('키');await expect(geocode('','key')).rejects.toThrow('주소');expect(requestApi).not.toHaveBeenCalled()
  })
})
