import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_REPORT_FILTERS } from '@/lib/report'
import { fetchReport, fetchTicketsForExport, EXPORT_BATCH } from '@/services/reports'

const db = vi.hoisted(() => ({ rpc: vi.fn(), ranges: [] as [number, number][], pages: [] as unknown[][], filters: [] as [string, unknown][] }))

vi.mock('@/lib/supabase', () => {
  const makeQuery = () => {
    const q: Record<string, unknown> = {}
    for (const m of ['gte', 'lt', 'eq', 'order']) q[m] = (...args: unknown[]) => (db.filters.push([m, args]), q)
    q.range = (from: number, to: number) => {
      db.ranges.push([from, to])
      return { overrideTypes: async () => ({ data: db.pages.shift() ?? [], error: null }) }
    }
    return q
  }
  return { supabase: { rpc: db.rpc, from: () => ({ select: makeQuery }) } }
})

const row = (n: number) => ({
  code: `FLX-${n}`, title: 't', status: 'open', priority: 'low', created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', resolved_at: null,
  requester: { full_name: 'R' }, assignee: null, category: { name: 'C' },
})
const batch = (size: number, start = 0) => Array.from({ length: size }, (_, i) => row(start + i))

beforeEach(() => {
  db.rpc.mockReset()
  db.ranges.length = 0
  db.pages.length = 0
  db.filters.length = 0
})

describe('fetchReport', () => {
  const valid = {
    totals: { total: 1, open: 1, in_progress: 0, waiting: 0, resolved: 0, critical: 0, resolved_with_date: 0, avg_resolution_hours: null },
    by_status: [], by_priority: [], by_category: [], by_assignee: [], timeline: [],
  }

  it('envia filtros convertidos e "me" vira o id do usuário', async () => {
    db.rpc.mockResolvedValue({ data: valid, error: null })
    await fetchReport({ ...DEFAULT_REPORT_FILTERS, period: 'all', assignee: 'me', priority: 'high' }, 'user-9')
    expect(db.rpc).toHaveBeenCalledWith('ticket_report', expect.objectContaining({ p_from: null, p_to: null, p_assignee: 'user-9', p_priority: 'high', p_category: null }))
  })

  it('rejeita resposta fora do contrato', async () => {
    db.rpc.mockResolvedValue({ data: { ...valid, totals: { total: 'x' } }, error: null })
    await expect(fetchReport(DEFAULT_REPORT_FILTERS, 'u')).rejects.toThrow()
  })

  it('propaga erro do banco', async () => {
    db.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    await expect(fetchReport(DEFAULT_REPORT_FILTERS, 'u')).rejects.toEqual({ message: 'boom' })
  })
})

describe('fetchTicketsForExport', () => {
  it('lote parcial encerra sem truncar e mapeia relações', async () => {
    db.pages.push(batch(3))
    const out = await fetchTicketsForExport({ ...DEFAULT_REPORT_FILTERS, period: 'all' }, 'u')
    expect(out.truncated).toBe(false)
    expect(out.rows).toHaveLength(3)
    expect(out.rows[0]).toMatchObject({ code: 'FLX-0', requester: 'R', assignee: '', category: 'C' })
    expect(db.ranges).toEqual([[0, EXPORT_BATCH - 1]])
  })

  it('pagina em lotes de 1000 até esgotar', async () => {
    db.pages.push(batch(EXPORT_BATCH), batch(10, EXPORT_BATCH))
    const out = await fetchTicketsForExport({ ...DEFAULT_REPORT_FILTERS, period: 'all' }, 'u')
    expect(out.rows).toHaveLength(EXPORT_BATCH + 10)
    expect(out.truncated).toBe(false)
    expect(db.ranges).toEqual([[0, 999], [1000, 1999]])
  })

  it('limita em 10.000 linhas e sinaliza truncamento', async () => {
    for (let i = 0; i < 12; i++) db.pages.push(batch(EXPORT_BATCH, i * EXPORT_BATCH))
    const out = await fetchTicketsForExport({ ...DEFAULT_REPORT_FILTERS, period: 'all' }, 'u')
    expect(out.rows).toHaveLength(10_000)
    expect(out.truncated).toBe(true)
    expect(db.ranges).toHaveLength(10)
  })

  it('aplica os filtros escolhidos à consulta', async () => {
    db.pages.push([])
    await fetchTicketsForExport({ ...DEFAULT_REPORT_FILTERS, period: 'all', status: 'resolved', assignee: 'me' }, 'user-9')
    const eqs = db.filters.filter(([m]) => m === 'eq').map(([, a]) => a)
    expect(eqs).toContainEqual(['status', 'resolved'])
    expect(eqs).toContainEqual(['assignee_id', 'user-9'])
  })
})
