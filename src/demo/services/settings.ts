import { db } from '@/demo/store'
import type { AppSettings } from '@/types/domain'

export const DEFAULT_SETTINGS: AppSettings = { allow_requester_priority: true, requester_reopen_days: null, updated_at: '' }
export async function getAppSettings(): Promise<AppSettings> {
  return { ...db.settings }
}
export async function updateAppSettings(patch: Partial<Pick<AppSettings, 'allow_requester_priority' | 'requester_reopen_days'>>) {
  Object.assign(db.settings, patch, { updated_at: new Date().toISOString() })
}
