import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { App } from '@capacitor/app'
import { isAndroidApp } from './native.ts'

export function AndroidNavigation() {
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => {
    if (!isAndroidApp()) return
    let disposed = false
    const listener = App.addListener('backButton', () => {
      if (disposed) return
      const dialog = document.querySelector<HTMLDialogElement>('dialog[open]')
      if (dialog) {
        const event = new Event('cancel', { cancelable: true })
        if (dialog.dispatchEvent(event)) dialog.close()
        return
      }
      if (window.history.state?.idx > 0) navigate(-1)
      else if (location.pathname !== '/' && location.pathname !== '/setup') navigate('/')
      else void App.minimizeApp()
    })
    return () => { disposed = true; void listener.then((handle) => handle.remove()) }
  }, [navigate, location.pathname])
  return null
}
