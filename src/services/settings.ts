import { supabase } from '@/lib/supabase'
import type { AppSettings } from '@/types/domain'

export const DEFAULT_SETTINGS: AppSettings = {
  allow_requester_priority: true,
  requester_reopen_days: null,
  updated_at: '',
}

export async function getAppSettings(): Promise<AppSettings> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('allow_requester_priority, requester_reopen_days, updated_at')
    .maybeSingle()
    .overrideTypes<AppSettings, { merge: false }>()
  if (error) throw error
  return data ?? DEFAULT_SETTINGS
}

export async function updateAppSettings(patch: Partial<Pick<AppSettings, 'allow_requester_priority' | 'requester_reopen_days'>>) {
  const { data, error } = await supabase.from('app_settings').update(patch).eq('id', true).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw { code: '42501', message: 'row-level security: nenhuma linha atualizada' }
}
