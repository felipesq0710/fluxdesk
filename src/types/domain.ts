// Tipos de domínio espelhando o esquema do banco (supabase/migrations).

export type UserRole = 'requester' | 'technician' | 'admin'

export type TicketStatus =
  | 'open'
  | 'in_progress'
  | 'waiting_requester'
  | 'waiting_third_party'
  | 'resolved'
  | 'closed'

export type TicketPriority = 'low' | 'medium' | 'high' | 'critical'

export type CommentKind = 'public' | 'internal'

export type ArticleStatus = 'draft' | 'published'

export type NotificationType =
  | 'ticket_created'
  | 'ticket_assigned'
  | 'status_changed'
  | 'comment_added'
  | 'info_requested'
  | 'ticket_resolved'
  | 'ticket_closed'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Chamados
// ---------------------------------------------------------------------------

export interface PersonRef {
  id: string
  full_name: string
}

export interface Ticket {
  id: string
  number: number
  code: string
  title: string
  description: string
  requester_id: string
  assignee_id: string | null
  category_id: string
  priority: TicketPriority
  status: TicketStatus
  created_at: string
  updated_at: string
  resolved_at: string | null
  closed_at: string | null
  requester: PersonRef | null
  assignee: PersonRef | null
  category: { id: string; name: string } | null
}

export interface TicketComment {
  id: string
  ticket_id: string
  author_id: string
  kind: CommentKind
  body: string
  created_at: string
  author: (PersonRef & { role: UserRole }) | null
}

export type HistoryEventType =
  | 'created'
  | 'status_changed'
  | 'resolved'
  | 'closed'
  | 'reopened'
  | 'priority_changed'
  | 'assignee_changed'
  | 'category_changed'
  | 'edited'

export interface TicketHistoryEvent {
  id: string
  ticket_id: string
  actor_id: string | null
  event_type: HistoryEventType
  old_value: string | null
  new_value: string | null
  created_at: string
  actor: { full_name: string } | null
}

export interface TicketAttachment {
  id: string
  ticket_id: string
  uploader_id: string
  file_name: string
  storage_path: string
  mime_type: string
  size_bytes: number
  created_at: string
  uploader: { full_name: string } | null
}

// ---------------------------------------------------------------------------
// Notificações, configurações, base de conhecimento
// ---------------------------------------------------------------------------

export interface AppNotification {
  id: string
  recipient_id: string
  ticket_id: string | null
  type: NotificationType
  title: string
  body: string | null
  is_read: boolean
  created_at: string
}

export interface AppSettings {
  allow_requester_priority: boolean
  requester_reopen_days: number | null
  updated_at: string
}

export interface KnowledgeArticle {
  id: string
  title: string
  content: string
  category_id: string | null
  author_id: string
  status: ArticleStatus
  tags: string[]
  created_at: string
  updated_at: string
  published_at: string | null
  author: { full_name: string } | null
  category: { id: string; name: string } | null
}
