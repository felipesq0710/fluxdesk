import { supabase } from '@/lib/supabase'
import type { AppNotification } from '@/types/domain'

export const NOTIFICATIONS_PAGE_SIZE = 20

const COLUMNS = 'id, recipient_id, ticket_id, type, title, body, is_read, created_at'

export interface NotificationPage {
  items: AppNotification[]
  total: number
  page: number
}

export async function listNotifications(page: number, onlyUnread: boolean): Promise<NotificationPage> {
  const from = (page - 1) * NOTIFICATIONS_PAGE_SIZE
  let query = supabase.from('notifications').select(COLUMNS, { count: 'exact' })
  if (onlyUnread) query = query.eq('is_read', false)
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .range(from, from + NOTIFICATIONS_PAGE_SIZE - 1)
    .overrideTypes<AppNotification[], { merge: false }>()
  if (error) throw error
  return { items: data ?? [], total: count ?? 0, page }
}

export async function countUnread(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false)
  if (error) throw error
  return count ?? 0
}

export async function markRead(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id)
  if (error) throw error
}

// A RLS limita a atualização às notificações do próprio usuário.
export async function markAllRead(): Promise<void> {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('is_read', false)
  if (error) throw error
}
