import type { Ticket } from '@/types/domain'

// O banco não possui campo de prazo/SLA. "Parado" é derivado apenas da última
// atualização real do chamado, nunca de uma data inventada.
export const STALE_DAYS = 3
const DAY_MS = 86_400_000

export type AttentionReason = 'critical' | 'unassigned' | 'stale' | 'waiting_you'

export const ATTENTION_LABEL: Record<AttentionReason, string> = {
  critical: 'Crítico',
  unassigned: 'Sem responsável',
  stale: 'Parado',
  waiting_you: 'Aguardando você',
}

const WEIGHT: Record<AttentionReason, number> = { critical: 8, waiting_you: 6, unassigned: 4, stale: 2 }

export function daysSince(iso: string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS))
}

export function isActive(t: Pick<Ticket, 'status'>): boolean {
  return t.status === 'open' || t.status === 'in_progress' || t.status === 'waiting_requester' || t.status === 'waiting_third_party'
}

export function attentionReasons(t: Ticket, staff: boolean, now: Date = new Date()): AttentionReason[] {
  if (!isActive(t)) return []
  const out: AttentionReason[] = []
  if (staff) {
    if (t.priority === 'critical') out.push('critical')
    if (!t.assignee_id) out.push('unassigned')
    if (daysSince(t.updated_at, now) >= STALE_DAYS) out.push('stale')
  } else if (t.status === 'waiting_requester') {
    out.push('waiting_you')
  }
  return out
}

export interface AttentionItem {
  ticket: Ticket
  reasons: AttentionReason[]
  score: number
}

export function rankAttention(tickets: Ticket[], staff: boolean, limit: number, now: Date = new Date()): AttentionItem[] {
  return tickets
    .map((ticket) => {
      const reasons = attentionReasons(ticket, staff, now)
      const score = reasons.reduce((s, r) => s + WEIGHT[r], 0)
      return { ticket, reasons, score }
    })
    .filter((i) => i.score > 0)
    .sort((a, b) => b.score - a.score || a.ticket.updated_at.localeCompare(b.ticket.updated_at))
    .slice(0, limit)
}
