import { Link, Navigate, Route, Routes } from 'react-router'
import { lazy, Suspense, type ReactNode } from 'react'
import { useQuestState } from './useQuest.ts'
import { AppNavigation } from '../ui/AppNavigation.tsx'
const CompareScreen = lazy(() => import('../screens/compare/CompareScreen.tsx').then(module => ({ default: module.CompareScreen })))
const ApartmentDetailScreen = lazy(() => import('../screens/apartment/ApartmentDetailScreen.tsx').then(module => ({ default: module.ApartmentDetailScreen })))
const QuestHomeScreen = lazy(() => import('../screens/quest/QuestHomeScreen.tsx').then(module => ({ default: module.QuestHomeScreen })))
const SetupScreen = lazy(() => import('../screens/setup/SetupScreen.tsx').then(module => ({ default: module.SetupScreen })))
import { RestoreScreen } from '../screens/setup/RestoreScreen.tsx'
const SettingsScreen = lazy(() => import('../screens/settings/SettingsScreen.tsx').then(module => ({ default: module.SettingsScreen })))
const ConnectionsScreen = lazy(() => import('../screens/settings/ConnectionsScreen.tsx').then(module => ({ default: module.ConnectionsScreen })))
const VisitScreen = lazy(() => import('../screens/visit/VisitScreen.tsx').then(module => ({ default: module.VisitScreen })))
const VisitDetailScreen = lazy(() => import('../screens/visit/VisitDetailScreen.tsx').then(module => ({ default: module.VisitDetailScreen })))
const EvaluationScreen = lazy(() => import('../screens/apartment/EvaluationScreen.tsx').then(module => ({ default: module.EvaluationScreen })))
const VisitEditScreen = lazy(() => import('../screens/visit/VisitEditScreen.tsx').then(module => ({ default: module.VisitEditScreen })))

function RequireQuest({ children }: { children: ReactNode }) {
  const { setupCompleted } = useQuestState()

  if (!setupCompleted) {
    return <Navigate to="/setup" replace />
  }

  return children
}

export function AppRoutes() {
  return (
    <Suspense fallback={<main style={{ padding: 24 }} role="status">화면을 준비하고 있습니다…</main>}>
    <Routes>
      <Route path="/connections" element={<RequireQuest><ConnectionsScreen /></RequireQuest>} />
      <Route path="*" element={<main style={{ padding: 24 }}><h1>페이지를 찾을 수 없습니다</h1><p>주소를 확인하거나 탐색 화면으로 돌아가 주세요.</p><Link to="/">내 집 찾기</Link></main>} />
      <Route path="/apartments/:apartmentId/visits/:visitId/edit" element={<RequireQuest><VisitEditScreen /></RequireQuest>} />
      <Route path="/setup" element={<SetupScreen />} />
      <Route path="/restore" element={<RestoreScreen />} />
      <Route
        path="/"
        element={
          <RequireQuest>
            <QuestHomeScreen />
          </RequireQuest>
        }
      />
      <Route
        path="/apartments/:apartmentId"
        element={
          <RequireQuest>
            <ApartmentDetailScreen />
          </RequireQuest>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireQuest>
            <SettingsScreen key="settings" />
          </RequireQuest>
        }
      />
      <Route
        path="/compare"
        element={
          <RequireQuest>
            <CompareScreen />
          </RequireQuest>
        }
      />
      <Route
        path="/apartments/:apartmentId/visit"
        element={
          <RequireQuest>
            <VisitScreen />
          </RequireQuest>
        }
      />
      <Route path="/filters" element={<RequireQuest><SettingsScreen key="filters" searchOnly /></RequireQuest>} />
      <Route
        path="/apartments/:apartmentId/evaluation"
        element={<RequireQuest><EvaluationScreen /></RequireQuest>}
      />
      <Route
        path="/apartments/:apartmentId/visits/:visitId"
        element={
          <RequireQuest>
            <VisitDetailScreen />
          </RequireQuest>
        }
      />
    </Routes>
    <AppNavigation />
    </Suspense>
  )
}
