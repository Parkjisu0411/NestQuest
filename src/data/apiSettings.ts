import type { ApiSettings } from './apiKeyConfig.ts'
declare const __NESTQUEST_API_KEYS__: ApiSettings
// Deliberately embedded for a personal APK. Not a secret from the APK recipient.
// Never place credentials in UI, backups, user state or diagnostic output.
const current: Readonly<ApiSettings> = Object.freeze(__NESTQUEST_API_KEYS__)
export function getApiSettings() { return current }
