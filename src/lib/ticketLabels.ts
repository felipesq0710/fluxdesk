import type { HistoryEventType, TicketHistoryEvent, TicketPriority, TicketStatus } from '@/types/domain'

export const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Aberto',
  in_progress: 'Em atendimento',
  waiting_requester: 'Aguardando solicitante',
  waiting_third_party: 'Aguardando terceiros',
  resolved: 'Resolvido',
  closed: 'Encerrado',
}

export const STATUSES: TicketStatus[] = [
  'open',
  'in_progress',
  'waiting_requester',
  'waiting_third_party',
  'resolved',
  'closed',
]

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
}

export const PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'critical']

export const ACTIVE_STATUSES: TicketStatus[] = ['open', 'in_progress', 'waiting_requester', 'waiting_third_party']

export const EVENT_LABEL: Record<HistoryEventType, string> = {
  created: 'Chamado criado',
  status_changed: 'Status alterado',
  resolved: 'Chamado resolvido',
  closed: 'Chamado encerrado',
  reopened: 'Chamado reaberto',
  priority_changed: 'Prioridade alterada',
  assignee_changed: 'Responsável alterado',
  category_changed: 'Categoria alterada',
  edited: 'Conteúdo editado',
}

function priorityText(value: string | null): string {
  if (!value) return '—'
  return PRIORITY_LABEL[value as TicketPriority] ?? value
}

export function describeHistoryEvent(event: Pick<TicketHistoryEvent, 'event_type' | 'old_value' | 'new_value'>): string {
  const { event_type: type, old_value: from, new_value: to } = event
  switch (type) {
    case 'created':
      return `Chamado criado com status ${to ?? STATUS_LABEL.open}`
    case 'priority_changed':
      return `Prioridade: ${priorityText(from)} → ${priorityText(to)}`
    case 'assignee_changed':
      if (!from && to) return `Atribuído a ${to}`
      if (from && !to) return `Liberado por ${from} (sem responsável)`
      return `Responsável: ${from ?? '—'} → ${to ?? '—'}`
    case 'category_changed':
      return `Categoria: ${from ?? '—'} → ${to ?? '—'}`
    case 'edited':
      return 'Título ou descrição foram editados'
    case 'resolved':
    case 'closed':
    case 'reopened':
    case 'status_changed':
      return `${EVENT_LABEL[type]}: ${from ?? '—'} → ${to ?? '—'}`
    default:
      return EVENT_LABEL[type]
  }
}
