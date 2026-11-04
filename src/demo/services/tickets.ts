import { PAGE_SIZE, dayStartISO, nextDayStartISO, sanitizeSearch, type TicketFilters } from '@/lib/ticketFilters'
import { STATUS_LABEL } from '@/lib/ticketLabels'
import { CATEGORIES, attachmentsOf, commentsOf, currentActor, db, historyOf, nextId, visibleTickets } from '@/demo/store'
import type { Category, CommentKind, Profile, Ticket, TicketAttachment, TicketComment, TicketHistoryEvent, TicketPriority, TicketStatus } from '@/types/domain'

export type { CreateTicketInput, TicketPage, TicketPatch, TicketScope, UploadOutcome } from '../../services/tickets'
import type { CreateTicketInput, TicketPage, TicketPatch, TicketScope, UploadOutcome } from '../../services/tickets'

export const ATTACHMENTS_BUCKET = 'ticket-attachments'
const ACTIVE: TicketStatus[] = ['open', 'in_progress', 'waiting_requester', 'waiting_third_party']
const PRIORITY_ORDER: Record<TicketPriority, number> = { low: 0, medium: 1, high: 2, critical: 3 }
const STATUS_ORDER: TicketStatus[] = ['open', 'in_progress', 'waiting_requester', 'waiting_third_party', 'resolved', 'closed']
const delay = () => new Promise((r) => setTimeout(r, 120))

function matches(t: Ticket, f: TicketFilters, userId: string, scope: TicketScope): boolean {
  const status = scope.status ?? f.status
  if (status && t.status !== status) return false
  const priority = scope.priority ?? f.priority
  if (priority && t.priority !== priority) return false
  if (f.category && t.category_id !== f.category) return false
  if (scope.assignedTo) {
    if (t.assignee_id !== scope.assignedTo) return false
  } else if (scope.unassigned) {
    if (t.assignee_id !== null) return false
  } else if (f.assignee === 'none') {
    if (t.assignee_id !== null) return false
  } else if (f.assignee === 'me') {
    if (t.assignee_id !== userId) return false
  } else if (f.assignee && t.assignee_id !== f.assignee) return false
  if (scope.activeOnly && !ACTIVE.includes(t.status)) return false
  if (scope.updatedSince && t.updated_at < scope.updatedSince) return false
  if (f.from && t.created_at < dayStartISO(f.from)) return false
  if (f.to && t.created_at >= nextDayStartISO(f.to)) return false
  const term = sanitizeSearch(f.search).toLowerCase()
  if (term && !(t.title.toLowerCase().includes(term) || t.code.toLowerCase().includes(term))) return false
  return true
}

function sortValue(t: Ticket, key: TicketFilters['sort']): string | number {
  switch (key) {
    case 'number': return t.number
    case 'title': return t.title.toLowerCase()
    case 'priority': return PRIORITY_ORDER[t.priority]
    case 'status': return STATUS_ORDER.indexOf(t.status)
    case 'updated_at': return t.updated_at
    default: return t.created_at
  }
}

export async function listTickets(filters: TicketFilters, currentUserId: string, scope: TicketScope = {}): Promise<TicketPage> {
  await delay()
  const { role } = currentActor()
  const rows = visibleTickets(role, currentUserId).filter((t) => matches(t, filters, currentUserId, scope))
  rows.sort((a, b) => {
    const x = sortValue(a, filters.sort)
    const y = sortValue(b, filters.sort)
    const cmp = x < y ? -1 : x > y ? 1 : 0
    return (filters.dir === 'asc' ? cmp : -cmp) || a.number - b.number
  })
  const from = (filters.page - 1) * PAGE_SIZE
  return { items: rows.slice(from, from + PAGE_SIZE), total: rows.length, page: filters.page, pageSize: PAGE_SIZE }
}

export async function countTickets(currentUserId: string, scope: TicketScope): Promise<number> {
  const { role } = currentActor()
  const empty = { search: '', status: '', priority: '', category: '', assignee: '', from: '', to: '', sort: 'created_at', dir: 'desc', page: 1 } as TicketFilters
  return visibleTickets(role, currentUserId).filter((t) => matches(t, empty, currentUserId, scope)).length
}

export async function getTicket(id: string): Promise<Ticket | null> {
  await delay()
  const { role, user } = currentActor()
  return visibleTickets(role, user.id).find((t) => t.id === id) ?? null
}

export async function createTicket(input: CreateTicketInput, requesterId: string): Promise<{ id: string; code: string }> {
  await delay()
  const requester = db.people.find((p) => p.id === requesterId) as Profile
  const category = db.categories.find((c) => c.id === input.categoryId)
  const number = db.nextNumber++
  const now = new Date().toISOString()
  const t: Ticket = {
    id: nextId('a'), number, code: `FLX-${String(number).padStart(6, '0')}`, title: input.title, description: input.description,
    requester_id: requesterId, assignee_id: null, category_id: input.categoryId, priority: input.priority, status: 'open',
    created_at: now, updated_at: now, resolved_at: null, closed_at: null,
    requester: { id: requester.id, full_name: requester.full_name }, assignee: null,
    category: category ? { id: category.id, name: category.name } : null,
  }
  db.tickets.unshift(t)
  return { id: t.id, code: t.code }
}

export async function updateTicket(id: string, patch: TicketPatch): Promise<void> {
  await delay()
  const t = db.tickets.find((x) => x.id === id)
  if (!t) throw { code: '42501', message: 'row-level security: nenhuma linha atualizada' }
  const { user } = currentActor()
  const history = historyOf(t)
  const log = (type: TicketHistoryEvent['event_type'], from: string | null, to: string | null) =>
    history.push({ id: nextId('h'), ticket_id: t.id, actor_id: user.id, event_type: type, old_value: from, new_value: to, created_at: new Date().toISOString(), actor: { full_name: user.full_name } })
  if (patch.status && patch.status !== t.status) {
    const type = patch.status === 'resolved' ? 'resolved' : patch.status === 'closed' ? 'closed' : t.status === 'resolved' || t.status === 'closed' ? 'reopened' : 'status_changed'
    log(type, STATUS_LABEL[t.status], STATUS_LABEL[patch.status])
    t.status = patch.status
    t.resolved_at = patch.status === 'resolved' || patch.status === 'closed' ? (t.resolved_at ?? new Date().toISOString()) : null
    t.closed_at = patch.status === 'closed' ? new Date().toISOString() : null
  }
  if ('assignee_id' in patch && patch.assignee_id !== t.assignee_id) {
    const next = db.people.find((p) => p.id === patch.assignee_id)
    log('assignee_changed', t.assignee?.full_name ?? null, next?.full_name ?? null)
    t.assignee_id = next?.id ?? null
    t.assignee = next ? { id: next.id, full_name: next.full_name } : null
    if (next && t.status === 'open') {
      log('status_changed', STATUS_LABEL.open, STATUS_LABEL.in_progress)
      t.status = 'in_progress'
    }
  }
  if (patch.priority && patch.priority !== t.priority) { log('priority_changed', t.priority, patch.priority); t.priority = patch.priority }
  if (patch.category_id && patch.category_id !== t.category_id) {
    const c = db.categories.find((x) => x.id === patch.category_id)
    log('category_changed', t.category?.name ?? null, c?.name ?? null)
    t.category_id = patch.category_id
    t.category = c ? { id: c.id, name: c.name } : t.category
  }
  if (patch.title !== undefined || patch.description !== undefined) {
    t.title = patch.title ?? t.title
    t.description = patch.description ?? t.description
    log('edited', null, null)
  }
  t.updated_at = new Date().toISOString()
}

export async function listCategories(options: { onlyActive?: boolean } = {}): Promise<Category[]> {
  return db.categories.filter((c) => !options.onlyActive || c.is_active).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

export async function listStaff(): Promise<Pick<Profile, 'id' | 'full_name' | 'role'>[]> {
  return db.people.filter((p) => p.role !== 'requester' && p.is_active).map((p) => ({ id: p.id, full_name: p.full_name, role: p.role }))
}

export async function listComments(ticketId: string): Promise<TicketComment[]> {
  await delay()
  const t = db.tickets.find((x) => x.id === ticketId)
  const { role } = currentActor()
  const all = t ? commentsOf(t) : []
  return role === 'requester' ? all.filter((c) => c.kind === 'public') : all
}

export async function addComment(ticketId: string, authorId: string, kind: CommentKind, body: string): Promise<void> {
  await delay()
  const t = db.tickets.find((x) => x.id === ticketId)
  const a = db.people.find((p) => p.id === authorId)
  if (!t || !a) return
  commentsOf(t).push({ id: nextId('m'), ticket_id: ticketId, author_id: authorId, kind, body, created_at: new Date().toISOString(), author: { id: a.id, full_name: a.full_name, role: a.role } })
  t.updated_at = new Date().toISOString()
}

export async function listHistory(ticketId: string): Promise<TicketHistoryEvent[]> {
  const t = db.tickets.find((x) => x.id === ticketId)
  return t ? historyOf(t) : []
}

export async function listAttachments(ticketId: string): Promise<TicketAttachment[]> {
  const t = db.tickets.find((x) => x.id === ticketId)
  return t ? attachmentsOf(t) : []
}

export async function uploadAttachment(ticketId: string, uploaderId: string, file: File): Promise<void> {
  const t = db.tickets.find((x) => x.id === ticketId)
  const u = db.people.find((p) => p.id === uploaderId)
  if (!t) return
  attachmentsOf(t).push({ id: nextId('f'), ticket_id: ticketId, uploader_id: uploaderId, file_name: file.name, storage_path: `demo/${ticketId}/${file.name}`, mime_type: file.type, size_bytes: file.size, created_at: new Date().toISOString(), uploader: { full_name: u?.full_name ?? '' } })
}

export async function uploadAttachments(ticketId: string, uploaderId: string, files: File[]): Promise<UploadOutcome> {
  for (const f of files) await uploadAttachment(ticketId, uploaderId, f)
  return { uploaded: files.length, failed: [] }
}

export async function getAttachmentUrl(): Promise<string> {
  throw new Error('Downloads não estão disponíveis na demonstração.')
}

export async function deleteAttachment(attachment: Pick<TicketAttachment, 'id' | 'storage_path'>): Promise<void> {
  for (const list of db.attachments.values()) {
    const i = list.findIndex((a) => a.id === attachment.id)
    if (i >= 0) list.splice(i, 1)
  }
}

export { CATEGORIES }
