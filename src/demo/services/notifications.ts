import { currentActor, db } from '@/demo/store'
import type { AppNotification } from '@/types/domain'

export const NOTIFICATIONS_PAGE_SIZE = 20
export interface NotificationPage {
  items: AppNotification[]
  total: number
  page: number
}

const mine = () => db.notifications.filter((n) => n.recipient_id === currentActor().user.id)

export async function listNotifications(page: number, onlyUnread: boolean): Promise<NotificationPage> {
  const rows = mine().filter((n) => !onlyUnread || !n.is_read).sort((a, b) => b.created_at.localeCompare(a.created_at))
  const from = (page - 1) * NOTIFICATIONS_PAGE_SIZE
  return { items: rows.slice(from, from + NOTIFICATIONS_PAGE_SIZE), total: rows.length, page }
}
export async function countUnread(): Promise<number> {
  return mine().filter((n) => !n.is_read).length
}
export async function markRead(id: string): Promise<void> {
  const n = db.notifications.find((x) => x.id === id)
  if (n) n.is_read = true
}
export async function markAllRead(): Promise<void> {
  for (const n of mine()) n.is_read = true
}
