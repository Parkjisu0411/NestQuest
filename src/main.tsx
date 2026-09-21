import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import './index.css'
import App from './App.tsx'
import { AppErrorBoundary } from './ui/AppErrorBoundary.tsx'

const router = createBrowserRouter([{ path: '*', element: <AppErrorBoundary><App /></AppErrorBoundary> }])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
