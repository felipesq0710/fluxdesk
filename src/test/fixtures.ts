import type { Ticket, TicketAttachment, TicketComment, TicketHistoryEvent } from '@/types/domain'

export const CATEGORY_ID = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e'
export const TICKET_ID = '7a1c2b3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'
export const ME = 'user-1'

export function makeTicket(over: Partial<Ticket> = {}): Ticket {
  return {
    id: TICKET_ID,
    number: 1,
    code: 'FLX-000001',
    title: 'Impressora offline',
    description: 'A impressora do setor financeiro não responde.',
    requester_id: ME,
    assignee_id: null,
    category_id: CATEGORY_ID,
    priority: 'high',
    status: 'open',
    created_at: '2026-10-01T12:00:00Z',
    updated_at: '2026-10-02T12:00:00Z',
    resolved_at: null,
    closed_at: null,
    requester: { id: ME, full_name: 'Rita Requerente' },
    assignee: null,
    category: { id: CATEGORY_ID, name: 'Software' },
    ...over,
  }
}

export function makeComment(over: Partial<TicketComment> = {}): TicketComment {
  return {
    id: 'c-1',
    ticket_id: TICKET_ID,
    author_id: 'tech-1',
    kind: 'public',
    body: 'Estamos verificando.',
    created_at: '2026-10-02T13:00:00Z',
    author: { id: 'tech-1', full_name: 'Tiago Técnico', role: 'technician' },
    ...over,
  }
}

export function makeHistory(over: Partial<TicketHistoryEvent> = {}): TicketHistoryEvent {
  return {
    id: 'h-1',
    ticket_id: TICKET_ID,
    actor_id: ME,
    event_type: 'created',
    old_value: null,
    new_value: 'Aberto',
    created_at: '2026-10-01T12:00:00Z',
    actor: { full_name: 'Rita Requerente' },
    ...over,
  }
}

export function makeAttachment(over: Partial<TicketAttachment> = {}): TicketAttachment {
  return {
    id: 'a-1',
    ticket_id: TICKET_ID,
    uploader_id: ME,
    file_name: 'print.png',
    storage_path: `${TICKET_ID}/x-print.png`,
    mime_type: 'image/png',
    size_bytes: 2048,
    created_at: '2026-10-02T12:30:00Z',
    uploader: { full_name: 'Rita Requerente' },
    ...over,
  }
}
