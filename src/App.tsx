import { QuestProvider } from './app/QuestProvider.tsx'
import { AppRoutes } from './app/AppRoutes.tsx'
import { AppAvailability } from './ui/AppAvailability.tsx'
import { AndroidNavigation } from './platform/AndroidNavigation.tsx'

function App() {
  return (
    <QuestProvider>
      <AndroidNavigation />
      <AppAvailability />
      <AppRoutes />
    </QuestProvider>
  )
}

export default App
