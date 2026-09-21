import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.nestquest.personal',
  appName: 'NestQuest',
  webDir: 'dist',
  // Keep this origin stable: IndexedDB records belong to it.
  server: { hostname: 'localhost', androidScheme: 'https' },
}

export default config
