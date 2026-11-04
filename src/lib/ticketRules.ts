import type { Ticket, TicketStatus, UserRole, CommentKind } from '@/types/domain'

// Espelho, na interface, das regras impostas pelos triggers do banco
// (supabase/migrations/…_functions_triggers.sql). O banco é a fonte de verdade:
// estas funções só decidem o que exibir.

const BASE_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open: ['in_progress', 'waiting_requester', 'waiting_third_party', 'resolved', 'closed'],
  in_progress: ['open', 'waiting_requester', 'waiting_third_party', 'resolved', 'closed'],
  waiting_requester: ['in_progress', 'waiting_third_party', 'resolved', 'closed'],
  waiting_third_party: ['in_progress', 'waiting_requester', 'resolved', 'closed'],
  resolved: ['open', 'in_progress', 'closed'],
  closed: ['open'],
}

const NEEDS_ASSIGNEE: TicketStatus[] = ['in_progress', 'waiting_requester', 'waiting_third_party', 'resolved']

export interface Actor {
  id: string
  role: UserRole
}

type TicketLike = Pick<Ticket, 'requester_id' | 'assignee_id' | 'status'>

function isOwner(t: TicketLike, a: Actor) {
  return a.role === 'requester' && t.requester_id === a.id
}

function techCanAct(t: TicketLike, a: Actor) {
  return a.role === 'technician' && (t.assignee_id === null || t.assignee_id === a.id)
}

export function statusTransitionsFor(t: TicketLike, a: Actor): TicketStatus[] {
  const base = BASE_TRANSITIONS[t.status]
  switch (a.role) {
    case 'admin':
      return base
    case 'technician':
      if (!techCanAct(t, a)) return []
      // Somente administradores reabrem chamados encerrados.
      return t.status === 'closed' ? [] : base
    case 'requester': {
      if (!isOwner(t, a)) return []
      if (t.status === 'waiting_requester') return ['in_progress']
      if (t.status === 'resolved') return ['closed', 'open']
      return []
    }
  }
}

export function transitionBlockedReason(t: TicketLike, target: TicketStatus, a: Actor): string | null {
  if (NEEDS_ASSIGNEE.includes(target) && t.assignee_id === null && a.role !== 'technician') {
    return 'Atribua um responsável antes de iniciar o atendimento.'
  }
  return null
}

export function canEditContent(t: TicketLike, a: Actor): boolean {
  if (a.role === 'admin') return true
  return isOwner(t, a) && t.status === 'open' && t.assignee_id === null
}

export function canChangeCategory(t: TicketLike, a: Actor): boolean {
  if (a.role === 'admin') return true
  if (a.role === 'technician') return techCanAct(t, a)
  return canEditContent(t, a)
}

export function canChangePriority(t: TicketLike, a: Actor): boolean {
  if (a.role === 'admin') return true
  return techCanAct(t, a)
}

export function canAssignOthers(a: Actor): boolean {
  return a.role === 'admin'
}

export function canClaim(t: TicketLike, a: Actor): boolean {
  return a.role === 'technician' && t.assignee_id === null && t.status !== 'closed'
}

// Liberar devolve o chamado à fila (status "Aberto"). Só é possível a partir de
// "Aberto" ou "Em atendimento": de "Aguardando…" o banco não permite voltar a "Aberto",
// e sem mudar o status o trigger reatribuiria o chamado ao próprio técnico.
export function canRelease(t: TicketLike, a: Actor): boolean {
  return a.role === 'technician' && t.assignee_id === a.id && (t.status === 'open' || t.status === 'in_progress')
}

export function canComment(t: TicketLike, a: Actor, kind: CommentKind): boolean {
  if (t.status === 'closed') return false
  if (a.role === 'admin') return true
  if (a.role === 'technician') return t.assignee_id === a.id
  return kind === 'public' && isOwner(t, a)
}

export function canAttach(t: TicketLike, a: Actor): boolean {
  return canComment(t, a, 'public')
}

export function canDeleteAttachment(uploaderId: string, a: Actor): boolean {
  return a.role === 'admin' || uploaderId === a.id
}

export function isAwaitingRequester(t: Pick<Ticket, 'status'>): boolean {
  return t.status === 'waiting_requester'
}

export function commentBlockedReason(t: TicketLike, a: Actor): string | null {
  if (t.status === 'closed') return 'Este chamado está encerrado e não aceita novas mensagens.'
  if (canComment(t, a, 'public') || canComment(t, a, 'internal')) return null
  if (a.role === 'technician') {
    return t.assignee_id === null
      ? 'Assuma o chamado para registrar mensagens e notas.'
      : 'Este chamado está atribuído a outro técnico.'
  }
  return 'Você não pode enviar mensagens neste chamado.'
}

export function isReopenWindowExpired(resolvedAt: string | null, days: number | null, now: Date = new Date()): boolean {
  if (days === null || resolvedAt === null) return false
  return now.getTime() > new Date(resolvedAt).getTime() + days * 86_400_000
}
