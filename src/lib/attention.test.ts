import { describe, expect, it } from 'vitest'
import { attentionReasons, daysSince, rankAttention, STALE_DAYS } from '@/lib/attention'
import type { Ticket } from '@/types/domain'

const now = new Date('2026-10-22T12:00:00Z')
const base = {
  id: 'x', number: 1, code: 'FD-1', title: 't', description: '', requester_id: 'r', assignee_id: 'a', category_id: 'c',
  priority: 'medium', status: 'open', created_at: '2026-10-21T12:00:00Z', updated_at: '2026-10-22T08:00:00Z',
  resolved_at: null, closed_at: null, requester: null, assignee: null, category: null,
} as Ticket
const mk = (o: Partial<Ticket>): Ticket => ({ ...base, ...o })

describe('atenção', () => {
  it('conta dias completos desde a última atualização', () => {
    expect(daysSince('2026-10-19T12:00:00Z', now)).toBe(3)
    expect(daysSince('2026-10-22T11:00:00Z', now)).toBe(0)
  })
  it('equipe: crítico, sem responsável e parado', () => {
    expect(attentionReasons(mk({ priority: 'critical', assignee_id: null, updated_at: '2026-10-10T00:00:00Z' }), true, now)).toEqual(['critical', 'unassigned', 'stale'])
    expect(STALE_DAYS).toBe(3)
  })
  it('chamado em dia não exige atenção; resolvido nunca exige', () => {
    expect(attentionReasons(mk({}), true, now)).toEqual([])
    expect(attentionReasons(mk({ status: 'resolved', priority: 'critical' }), true, now)).toEqual([])
  })
  it('solicitante só é alertado quando o chamado aguarda resposta dele', () => {
    expect(attentionReasons(mk({ status: 'waiting_requester' }), false, now)).toEqual(['waiting_you'])
    expect(attentionReasons(mk({ priority: 'critical', assignee_id: null }), false, now)).toEqual([])
  })
  it('ordena por gravidade e limita a lista', () => {
    const list = [
      mk({ id: 'a', updated_at: '2026-10-10T00:00:00Z' }),
      mk({ id: 'b', priority: 'critical' }),
      mk({ id: 'c', assignee_id: null }),
      mk({ id: 'd' }),
    ]
    expect(rankAttention(list, true, 2, now).map((i) => i.ticket.id)).toEqual(['b', 'c'])
  })
})
