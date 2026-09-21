import { afterEach, describe, expect, it, vi } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { apiProxy } from '../../../scripts/api-proxy.mjs'
afterEach(()=>vi.unstubAllGlobals())
describe('local provider proxy authorization',()=>{
  function request(endpoint:string,host='127.0.0.1:5176') { return {url:`/api/provider/${endpoint}?query=test`,method:'GET',headers:{host,origin:`http://${host}`,authorization:'KakaoAK test-only'}} as IncomingMessage }
  function response() { return {writeHead:vi.fn(),end:vi.fn()} as unknown as ServerResponse }
  it('forwards the REST credential as a header only to Kakao',async()=>{
    const fetchMock=vi.fn(async()=>new Response('{"documents":[]}',{status:200}));vi.stubGlobal('fetch',fetchMock)
    await apiProxy(request('geocode'),response())
    expect(fetchMock).toHaveBeenCalledWith('https://dapi.kakao.com/v2/local/search/address.json?query=test',expect.objectContaining({headers:{Authorization:'KakaoAK test-only'},redirect:'error'}))
    await apiProxy(request('list'),response())
    expect(fetchMock.mock.calls[1][1]).toMatchObject({headers:undefined})
  })
  it('rejects non-loopback callers before any upstream request',async()=>{
    const fetchMock=vi.fn();vi.stubGlobal('fetch',fetchMock);const output=response()
    await apiProxy(request('geocode','external.example'),output)
    expect(output.writeHead).toHaveBeenCalledWith(403);expect(fetchMock).not.toHaveBeenCalled()
  })
  it('does not leak provider network errors or credentials to the client',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>{throw new Error('secret-detail')}));const output=response()
    await apiProxy(request('geocode'),output)
    expect(output.end).toHaveBeenCalledWith('Provider unavailable')
  })
})
