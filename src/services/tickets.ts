import { supabase } from '@/lib/supabase'
import { safeStorageName } from '@/lib/attachments'
import { deleteAttachmentSafely } from '@/lib/attachmentDeletion'
import {
  DEFAULT_FILTERS,
  PAGE_SIZE,
  dayStartISO,
  nextDayStartISO,
  sanitizeSearch,
  type TicketFilters,
} from '@/lib/ticketFilters'
import type {
  Category,
  CommentKind,
  Profile,
  Ticket,
  TicketAttachment,
  TicketComment,
  TicketHistoryEvent,
  TicketPriority,
  TicketStatus,
} from '@/types/domain'

const TICKET_SELECT = `
  id, number, code, title, description, requester_id, assignee_id, category_id,
  priority, status, created_at, updated_at, resolved_at, closed_at,
  requester:profiles!tickets_requester_id_fkey(id, full_name),
  assignee:profiles!tickets_assignee_id_fkey(id, full_name),
  category:categories(id, name)
`

export const ATTACHMENTS_BUCKET = 'ticket-attachments'

export interface TicketPage {
  items: Ticket[]
  total: number
  page: number
  pageSize: number
}

export interface TicketScope {
  assignedTo?: string
  unassigned?: boolean
  activeOnly?: boolean
  status?: TicketStatus
  priority?: TicketPriority
  updatedSince?: string
}

const ACTIVE: TicketStatus[] = ['open', 'in_progress', 'waiting_requester', 'waiting_third_party']

function buildTicketQuery(filters: TicketFilters, currentUserId: string, scope: TicketScope, head: boolean) {
  let query = supabase.from('tickets').select(TICKET_SELECT, { count: 'exact', head })

  if (scope.status) query = query.eq('status', scope.status)
  else if (filters.status) query = query.eq('status', filters.status)

  if (scope.priority) query = query.eq('priority', scope.priority)
  else if (filters.priority) query = query.eq('priority', filters.priority)

  if (filters.category) query = query.eq('category_id', filters.category)

  if (scope.assignedTo) query = query.eq('assignee_id', scope.assignedTo)
  else if (scope.unassigned) query = query.is('assignee_id', null)
  else if (filters.assignee === 'none') query = query.is('assignee_id', null)
  else if (filters.assignee === 'me') query = query.eq('assignee_id', currentUserId)
  else if (filters.assignee) query = query.eq('assignee_id', filters.assignee)

  if (scope.activeOnly) query = query.in('status', ACTIVE)
  if (scope.updatedSince) query = query.gte('updated_at', scope.updatedSince)

  if (filters.from) query = query.gte('created_at', dayStartISO(filters.from))
  if (filters.to) query = query.lt('created_at', nextDayStartISO(filters.to))

  const term = sanitizeSearch(filters.search)
  if (term) query = query.or(`title.ilike.%${term}%,code.ilike.%${term}%`)

  return query
}

export async function listTickets(
  filters: TicketFilters,
  currentUserId: string,
  scope: TicketScope = {},
): Promise<TicketPage> {
  const from = (filters.page - 1) * PAGE_SIZE
  // Desempate por id mantém a paginação estável quando há valores iguais.
  const { data, error, count } = await buildTicketQuery(filters, currentUserId, scope, false)
    .order(filters.sort, { ascending: filters.dir === 'asc' })
    .order('id', { ascending: true })
    .range(from, from + PAGE_SIZE - 1)
    .overrideTypes<Ticket[], { merge: false }>()
  if (error) throw error
  return { items: data ?? [], total: count ?? 0, page: filters.page, pageSize: PAGE_SIZE }
}

export async function countTickets(currentUserId: string, scope: TicketScope): Promise<number> {
  const { count, error } = await buildTicketQuery(DEFAULT_FILTERS, currentUserId, scope, true)
  if (error) throw error
  return count ?? 0
}

export async function getTicket(id: string): Promise<Ticket | null> {
  const { data, error } = await supabase
    .from('tickets')
    .select(TICKET_SELECT)
    .eq('id', id)
    .maybeSingle()
    .overrideTypes<Ticket, { merge: false }>()
  if (error) throw error
  return data
}

export interface CreateTicketInput {
  title: string
  description: string
  categoryId: string
  priority: TicketPriority
}

export async function createTicket(input: CreateTicketInput, requesterId: string): Promise<{ id: string; code: string }> {
  const { data, error } = await supabase
    .from('tickets')
    .insert({
      title: input.title,
      description: input.description,
      category_id: input.categoryId,
      priority: input.priority,
      requester_id: requesterId,
    })
    .select('id, code')
    .single()
    .overrideTypes<{ id: string; code: string }, { merge: false }>()
  if (error) throw error
  return data
}

export interface TicketPatch {
  title?: string
  description?: string
  category_id?: string
  priority?: TicketPriority
  status?: TicketStatus
  assignee_id?: string | null
}

export async function updateTicket(id: string, patch: TicketPatch): Promise<void> {
  // select() devolve as linhas afetadas: RLS que filtra a atualização não gera erro, apenas zero linhas.
  const { data, error } = await supabase.from('tickets').update(patch).eq('id', id).select('id')
  if (error) throw error
  if (!data || data.length === 0) {
    throw { code: '42501', message: 'row-level security: nenhuma linha atualizada' }
  }
}

export async function listCategories(options: { onlyActive?: boolean } = {}): Promise<Category[]> {
  let query = supabase.from('categories').select('id, name, description, is_active, created_at, updated_at')
  if (options.onlyActive) query = query.eq('is_active', true)
  const { data, error } = await query.order('name').overrideTypes<Category[], { merge: false }>()
  if (error) throw error
  return data ?? []
}

export async function listStaff(): Promise<Pick<Profile, 'id' | 'full_name' | 'role'>[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .in('role', ['technician', 'admin'])
    .eq('is_active', true)
    .order('full_name')
    .overrideTypes<Pick<Profile, 'id' | 'full_name' | 'role'>[], { merge: false }>()
  if (error) throw error
  return data ?? []
}

// ---------------------------------------------------------------------------
// Comentários, histórico, anexos
// ---------------------------------------------------------------------------

export async function listComments(ticketId: string): Promise<TicketComment[]> {
  // A RLS já remove notas internas para solicitantes; nenhum filtro de cliente é necessário.
  const { data, error } = await supabase
    .from('ticket_comments')
    .select('id, ticket_id, author_id, kind, body, created_at, author:profiles(id, full_name, role)')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })
    .overrideTypes<TicketComment[], { merge: false }>()
  if (error) throw error
  return data ?? []
}

export async function addComment(ticketId: string, authorId: string, kind: CommentKind, body: string): Promise<void> {
  const { error } = await supabase
    .from('ticket_comments')
    .insert({ ticket_id: ticketId, author_id: authorId, kind, body })
  if (error) throw error
}

export async function listHistory(ticketId: string): Promise<TicketHistoryEvent[]> {
  const { data, error } = await supabase
    .from('ticket_history')
    .select('id, ticket_id, actor_id, event_type, old_value, new_value, created_at, actor:profiles(full_name)')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })
    .overrideTypes<TicketHistoryEvent[], { merge: false }>()
  if (error) throw error
  return data ?? []
}

export async function listAttachments(ticketId: string): Promise<TicketAttachment[]> {
  const { data, error } = await supabase
    .from('ticket_attachments')
    .select('id, ticket_id, uploader_id, file_name, storage_path, mime_type, size_bytes, created_at, uploader:profiles(full_name)')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })
    .overrideTypes<TicketAttachment[], { merge: false }>()
  if (error) throw error
  return data ?? []
}

// Envia o arquivo ao Storage e registra os metadados; desfaz o upload se o registro falhar.
export async function uploadAttachment(ticketId: string, uploaderId: string, file: File): Promise<void> {
  const path = `${ticketId}/${crypto.randomUUID()}-${safeStorageName(file.name)}`
  const { error: uploadError } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })
  if (uploadError) throw uploadError

  const { error: insertError } = await supabase.from('ticket_attachments').insert({
    ticket_id: ticketId,
    uploader_id: uploaderId,
    file_name: file.name.slice(0, 255),
    storage_path: path,
    mime_type: file.type,
    size_bytes: file.size,
  })
  if (insertError) {
    await supabase.storage.from(ATTACHMENTS_BUCKET).remove([path])
    throw insertError
  }
}

export interface UploadOutcome {
  uploaded: number
  failed: { name: string; error: unknown }[]
}

export async function uploadAttachments(ticketId: string, uploaderId: string, files: File[]): Promise<UploadOutcome> {
  const outcome: UploadOutcome = { uploaded: 0, failed: [] }
  for (const file of files) {
    try {
      await uploadAttachment(ticketId, uploaderId, file)
      outcome.uploaded += 1
    } catch (error) {
      outcome.failed.push({ name: file.name, error })
    }
  }
  return outcome
}

// URL assinada de curta duração: o bucket é privado.
export async function getAttachmentUrl(storagePath: string, fileName: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(storagePath, 60, { download: fileName })
  if (error) throw error
  return data.signedUrl
}

function isMissingStorageObject(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { status?: number; statusCode?: string; message?: string }
  return candidate.status === 404 || candidate.statusCode === '404' || /object not found/i.test(candidate.message ?? '')
}

export async function deleteAttachment(attachment: Pick<TicketAttachment, 'id' | 'storage_path' | 'mime_type'>): Promise<void> {
  const bucket = supabase.storage.from(ATTACHMENTS_BUCKET)
  await deleteAttachmentSafely({
    readObject: async () => {
      const { data, error } = await bucket.download(attachment.storage_path)
      if (error) throw error
      if (!data) throw new Error('O arquivo do anexo não foi retornado pelo Storage.')
      return data
    },
    removeObject: async () => {
      const { error } = await bucket.remove([attachment.storage_path])
      if (error) throw error
    },
    deleteRecord: async () => {
      const { error } = await supabase.from('ticket_attachments').delete().eq('id', attachment.id)
      if (error) throw error
    },
    restoreObject: async (snapshot) => {
      const { error } = await bucket.upload(attachment.storage_path, snapshot, {
        upsert: true,
        contentType: attachment.mime_type,
      })
      if (error) throw error
    },
    isObjectMissing: isMissingStorageObject,
  })
}
