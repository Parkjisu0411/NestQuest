import { useEffect, useState } from 'react'
import { isAndroidApp } from '../platform/native.ts'

interface InstallPrompt extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function AppAvailability() {
  const [online, setOnline] = useState(() => navigator.onLine)
  const [offlineReady, setOfflineReady] = useState(false)
  const [updateReady, setUpdateReady] = useState(false)
  const [install, setInstall] = useState<InstallPrompt | null>(null)
  const [message, setMessage] = useState('')
  useEffect(() => {
    const connectivity = () => setOnline(navigator.onLine)
    const prompt = (event: Event) => { event.preventDefault(); setInstall(event as InstallPrompt) }
    const installed = () => setInstall(null)
    window.addEventListener('online', connectivity)
    window.addEventListener('offline', connectivity)
    window.addEventListener('beforeinstallprompt', prompt)
    window.addEventListener('appinstalled', installed)
    let active = true
    let cleanup = () => {}
    if (!isAndroidApp() && import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((registration) => {
        if (!active) return
        const check = () => { if (active) { setOfflineReady(Boolean(registration.active)); setUpdateReady(Boolean(registration.waiting)) } }
        const found = () => { registration.installing?.addEventListener('statechange', check) }
        registration.addEventListener('updatefound', found)
        const refresh = () => { if (document.visibilityState === 'visible' && navigator.onLine) void registration.update().catch(() => {}) }
        document.addEventListener('visibilitychange', refresh)
        cleanup = () => { registration.removeEventListener('updatefound', found); document.removeEventListener('visibilitychange', refresh) }
        found(); check()
        void navigator.serviceWorker.ready.then(() => { if (active) setOfflineReady(true) })
      }).catch(() => { if (active) setMessage('오프라인 실행을 준비하지 못했습니다. 온라인 상태에서 앱을 다시 열어 주세요.') })
    }
    return () => {
      active = false; cleanup()
      window.removeEventListener('online', connectivity); window.removeEventListener('offline', connectivity)
      window.removeEventListener('beforeinstallprompt', prompt); window.removeEventListener('appinstalled', installed)
    }
  }, [])
  return <aside className="app-availability" aria-label="앱 사용 상태">
    {!online ? <p role="status">오프라인 · 이 기기에 저장된 기록을 열고 작성할 수 있습니다.</p> : null}
    {isAndroidApp() ? <span>기기에 설치된 앱 · 기록은 이 기기에 저장됩니다</span> : offlineReady ? <span>오프라인 실행 준비됨</span> : null}
    {updateReady ? <p role="status">새 버전이 준비됐습니다. 작성 내용을 저장한 후 NestQuest 창을 모두 닫고 다시 열면 적용됩니다.</p> : null}
    {message ? <p role="status">{message}</p> : null}
    {install ? <button onClick={async () => {
      try { await install.prompt(); await install.userChoice } catch { setMessage('브라우저 메뉴의 앱 설치 또는 홈 화면에 추가를 이용해 주세요.') }
      setInstall(null)
    }}>홈 화면에 설치</button> : null}
  </aside>
}
