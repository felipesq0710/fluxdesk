import type { TicketScope } from '@/services/tickets'

export type QueueTabKey = 'mine' | 'unassigned' | 'critical' | 'waiting' | 'recent'

export interface QueueTab {
  key: QueueTabKey
  label: string
  description: string
  empty: { title: string; description: string }
  hideStatus?: boolean
  hidePriority?: boolean
}

export const QUEUE_TABS: QueueTab[] = [
  {
    key: 'mine',
    label: 'Atribuídos a mim',
    description: 'Chamados em andamento sob sua responsabilidade.',
    empty: { title: 'Sua fila está vazia', description: 'Assuma chamados sem responsável para começar.' },
  },
  {
    key: 'unassigned',
    label: 'Sem responsável',
    description: 'Chamados ainda não assumidos por ninguém.',
    empty: { title: 'Nenhum chamado sem responsável', description: 'Todos os chamados já têm alguém cuidando.' },
  },
  {
    key: 'critical',
    label: 'Críticos',
    description: 'Chamados de prioridade crítica ainda em andamento.',
    hidePriority: true,
    empty: { title: 'Nenhum chamado crítico', description: 'Nenhum chamado crítico em andamento no momento.' },
  },
  {
    key: 'waiting',
    label: 'Aguardando solicitante',
    description: 'Chamados seus que dependem de uma resposta do solicitante.',
    hideStatus: true,
    empty: { title: 'Nada aguardando solicitantes', description: 'Nenhum dos seus chamados espera resposta do solicitante.' },
  },
  {
    key: 'recent',
    label: 'Atualizados recentemente',
    description: 'Seus chamados com atividade nas últimas 48 horas.',
    empty: { title: 'Sem atualizações recentes', description: 'Seus chamados não tiveram atividade nas últimas 48 horas.' },
  },
]

export const RECENT_WINDOW_HOURS = 48

export function parseQueueTab(value: string | null): QueueTabKey {
  return QUEUE_TABS.some((t) => t.key === value) ? (value as QueueTabKey) : 'mine'
}

// `updatedSince` deve ser estável entre renderizações (arredondado à hora) para não invalidar o cache.
export function recentSince(now: number = Date.now()): string {
  const hour = 3_600_000
  return new Date(Math.floor((now - RECENT_WINDOW_HOURS * hour) / hour) * hour).toISOString()
}

export function scopeForTab(tab: QueueTabKey, userId: string, updatedSince: string): TicketScope {
  switch (tab) {
    case 'mine':
      return { assignedTo: userId, activeOnly: true }
    case 'unassigned':
      return { unassigned: true, activeOnly: true }
    case 'critical':
      return { priority: 'critical', activeOnly: true }
    case 'waiting':
      return { assignedTo: userId, status: 'waiting_requester' }
    case 'recent':
      return { assignedTo: userId, updatedSince }
  }
}
