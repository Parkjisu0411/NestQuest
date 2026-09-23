const endpoints = {
  geocode: 'https://dapi.kakao.com/v2/local/search/address.json',
  list: 'https://apis.data.go.kr/1613000/AptListService4/getSidoAptList4',
  detail: 'https://apis.data.go.kr/1613000/AptBasisInfoServiceV5/getAphusDtlInfoV5',
  basic: 'https://apis.data.go.kr/1613000/AptBasisInfoServiceV5/getAphusBassInfoV5',
  trades: 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev',
  commute: 'https://dapi.kakao.com/v2/routing/publictraffic',
}
// Loopback development helper only; never an arbitrary URL forwarding endpoint.
export async function apiProxy(request, response, next = () => {}) {
  const url = new URL(request.url, 'http://localhost')
  if (!url.pathname.startsWith('/api/provider/')) return next()
  const endpoint = endpoints[url.pathname.slice('/api/provider/'.length)]
  const host = request.headers.host || ''
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) || (request.headers.origin && request.headers.origin !== `http://${host}`)) {
    response.writeHead(403); response.end(); return
  }
  if (!endpoint || request.method !== 'GET' || url.search.length > 4096) { response.writeHead(400); response.end(); return }
  try {
    const headers = (endpoint === endpoints.geocode || endpoint === endpoints.commute) && typeof request.headers.authorization === 'string'
      ? { Authorization: request.headers.authorization } : { 'Content-Type':'application/json; charset=UTF-8' }
    const result = await fetch(endpoint + url.search, { headers, signal: AbortSignal.timeout(20000), redirect: 'error' })
    const text = await result.text()
    if (text.length > 20_000_000) throw new Error('Response too large')
    response.writeHead(result.status, { 'Content-Type': result.headers.get('content-type') || 'text/plain', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
    response.end(text)
  } catch { response.writeHead(502, { 'Cache-Control': 'no-store' }); response.end('Provider unavailable') }
}
