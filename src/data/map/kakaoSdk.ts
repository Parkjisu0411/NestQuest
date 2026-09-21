export interface KakaoCoordinate { getLat(): number; getLng(): number }
export interface KakaoBounds { extend(position: KakaoCoordinate): void; contain(position: KakaoCoordinate): boolean }
export interface KakaoMapInstance {
  getCenter(): KakaoCoordinate; setCenter(position: KakaoCoordinate): void
  setBounds(bounds: KakaoBounds, top?: number, right?: number, bottom?: number, left?: number): void
  getLevel(): number; setLevel(level: number): void; panTo(position: KakaoCoordinate): void
  relayout(): void
  getProjection(): { containerPointFromCoords(position: KakaoCoordinate): { x: number; y: number } }
}
export interface KakaoOverlay { setMap(map: KakaoMapInstance | null): void }
export interface KakaoMaps {
  load(callback: () => void): void
  Map: new (element: HTMLElement, options: { center: KakaoCoordinate; level: number }) => KakaoMapInstance
  LatLng: new (latitude: number, longitude: number) => KakaoCoordinate
  LatLngBounds: new () => KakaoBounds
  CustomOverlay: new (options: { position: KakaoCoordinate; content: HTMLElement; map: KakaoMapInstance; clickable: boolean; xAnchor: number; yAnchor: number; zIndex: number }) => KakaoOverlay
  event: { addListener(target: KakaoMapInstance, event: string, callback: () => void): void; removeListener(target: KakaoMapInstance, event: string, callback: () => void): void }
}
declare global { interface Window { kakao?: { maps?: KakaoMaps } } }
let pending: Promise<KakaoMaps> | undefined

/** Never propagate SDK errors or request URLs: the script URL contains the key. */
export function loadKakaoMaps(key: string): Promise<KakaoMaps> {
  if (!key.trim()) return Promise.reject(new Error('카카오 지도 JavaScript 키가 없습니다. 로컬 키 설정 후 다시 실행해 주세요.'))
  if (pending) return pending
  const request = new Promise<KakaoMaps>((resolve, reject) => {
    const script = document.createElement('script')
    let settled = false
    const timer = window.setTimeout(fail, 20000)
    function fail() {
      if (settled) return
      settled = true; window.clearTimeout(timer); script.remove()
      reject(new Error('카카오 지도를 불러오지 못했습니다. 인터넷 연결, 카카오맵 사용 설정과 JavaScript SDK 도메인 등록을 확인해 주세요. 목록과 임장 기록은 계속 사용할 수 있습니다.'))
    }
    function ready() {
      const maps = window.kakao?.maps
      if (!maps?.load) { fail(); return }
      try {
        maps.load(() => {
          if (settled) return
          if (!maps.Map || !maps.CustomOverlay) { fail(); return }
          settled = true; window.clearTimeout(timer); resolve(maps)
        })
      } catch { fail() }
    }
    script.async = true
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=${encodeURIComponent(key.trim())}`
    script.onload = ready
    script.onerror = fail
    document.head.appendChild(script)
  })
  pending = request.catch(error => { pending = undefined; throw error })
  return pending
}
