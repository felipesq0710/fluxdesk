import { describe, expect, it } from 'vitest'
import {
  DEFAULT_REPORT_FILTERS,
  bucketTimeline,
  computeTrend,
  hasSufficientAverage,
  parseReportFilters,
  periodRange,
  previousFilters,
  previousRange,
  reportFiltersToParams,
  topWithOthers,
} from '@/lib/report'

const UUID = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e'

describe('parseReportFilters / reportFiltersToParams', () => {
  it('usa os padrões e descarta valores inválidos', () => {
    expect(parseReportFilters(new URLSearchParams())).toEqual(DEFAULT_REPORT_FILTERS)
    const f = parseReportFilters(new URLSearchParams('period=hack&priority=x&status=y&category=1;drop&assignee=todos&from=2026-99-99'))
    expect(f).toEqual(DEFAULT_REPORT_FILTERS)
  })

  it('é inversa para filtros válidos', () => {
    const original = { period: 'custom' as const, from: '2026-01-01', to: '2026-02-01', category: UUID, priority: 'high' as const, status: 'open' as const, assignee: 'me' }
    expect(parseReportFilters(reportFiltersToParams(original))).toEqual(original)
  })

  it('respeita padrão com responsável "me" e distingue "todos" explícito', () => {
    const defaults = { ...DEFAULT_REPORT_FILTERS, assignee: 'me' }
    expect(parseReportFilters(new URLSearchParams(), defaults).assignee).toBe('me')
    const all = { ...defaults, assignee: '' }
    const params = reportFiltersToParams(all, defaults)
    expect(params.has('assignee')).toBe(true)
    expect(parseReportFilters(params, defaults).assignee).toBe('')
  })

  it('datas personalizadas só são gravadas no período "custom"', () => {
    const p = reportFiltersToParams({ ...DEFAULT_REPORT_FILTERS, from: '2026-01-01', to: '2026-01-31' })
    expect(p.has('from')).toBe(false)
  })
})

describe('periodRange', () => {
  const now = new Date(2026, 9, 22, 15, 0, 0) // 22/10/2026 local
  it('janelas relativas incluem hoje', () => {
    expect(periodRange({ period: '7d', from: '', to: '' }, now)).toEqual({ from: '2026-10-16', to: '2026-10-22' })
    expect(periodRange({ period: '30d', from: '', to: '' }, now)).toEqual({ from: '2026-09-23', to: '2026-10-22' })
  })
  it('todo o período e personalizado', () => {
    expect(periodRange({ period: 'all', from: '2026-01-01', to: '' }, now)).toEqual({ from: '', to: '' })
    expect(periodRange({ period: 'custom', from: '2026-01-01', to: '2026-01-31' }, now)).toEqual({ from: '2026-01-01', to: '2026-01-31' })
  })
})

describe('hasSufficientAverage', () => {
  it('exige quantidade mínima de chamados resolvidos', () => {
    expect(hasSufficientAverage({ resolved_with_date: 2, avg_resolution_hours: 5 })).toBe(false)
    expect(hasSufficientAverage({ resolved_with_date: 3, avg_resolution_hours: 5 })).toBe(true)
    expect(hasSufficientAverage({ resolved_with_date: 10, avg_resolution_hours: null })).toBe(false)
  })
})

describe('bucketTimeline', () => {
  const today = new Date(2026, 9, 22)
  it('preenche dias sem movimento com zero', () => {
    const out = bucketTimeline(
      [{ day: '2026-10-01', created: 2, resolved: 0 }, { day: '2026-10-03', created: 1, resolved: 1 }],
      { from: '2026-10-01', to: '2026-10-04' },
      today,
    )
    expect(out.map((b) => [b.start, b.created, b.resolved])).toEqual([
      ['2026-10-01', 2, 0],
      ['2026-10-02', 0, 0],
      ['2026-10-03', 1, 1],
      ['2026-10-04', 0, 0],
    ])
    expect(out[0]?.label).toBe('01/10')
  })

  it('sem dados e sem período devolve vazio', () => {
    expect(bucketTimeline([], { from: '', to: '' }, today)).toEqual([])
  })

  it('sem limite inferior começa no primeiro ponto e termina hoje', () => {
    const out = bucketTimeline([{ day: '2026-10-20', created: 1, resolved: 0 }], { from: '', to: '' }, today)
    expect(out.map((b) => b.start)).toEqual(['2026-10-20', '2026-10-21', '2026-10-22'])
  })

  it('intervalos longos são agrupados por semana (segunda-feira) preservando os totais', () => {
    const points = [
      { day: '2026-01-05', created: 3, resolved: 1 }, // segunda
      { day: '2026-01-07', created: 2, resolved: 0 },
      { day: '2026-03-30', created: 4, resolved: 2 },
    ]
    const out = bucketTimeline(points, { from: '2026-01-01', to: '2026-04-30' }, today)
    expect(out.length).toBeLessThan(31)
    expect(out.length).toBeGreaterThan(10)
    const week = out.find((b) => b.start === '2026-01-05')
    expect(week).toMatchObject({ created: 5, resolved: 1 })
    expect(out.reduce((s, b) => s + b.created, 0)).toBe(9)
    expect(out.reduce((s, b) => s + b.resolved, 0)).toBe(3)
    for (const b of out) expect(new Date(`${b.start}T00:00:00Z`).getUTCDay()).toBe(1)
  })
})

describe('bucketTimeline: diário x semanal', () => {
  const today = new Date(2026, 9, 22)
  it('até 14 dias continua diário', () => {
    const out = bucketTimeline([{ day: '2026-10-05', created: 1, resolved: 0 }], { from: '2026-10-01', to: '2026-10-14' }, today)
    expect(out).toHaveLength(14)
  })
  it('15 dias ou mais viram semanas, preservando os totais', () => {
    const out = bucketTimeline(
      [{ day: '2026-10-05', created: 2, resolved: 0 }, { day: '2026-10-20', created: 1, resolved: 1 }],
      { from: '2026-09-23', to: '2026-10-22' },
      today,
    )
    expect(out.length).toBeLessThan(7)
    expect(out.every((b) => b.label.startsWith('Sem. '))).toBe(true)
    expect(out.reduce((s, b) => s + b.created, 0)).toBe(3)
    expect(out.reduce((s, b) => s + b.resolved, 0)).toBe(1)
  })
})

describe('topWithOthers', () => {
  it('mantém os maiores e agrega o restante', () => {
    const rows = ['a', 'b', 'c', 'd', 'e'].map((key, i) => ({ key, count: 10 - i }))
    expect(topWithOthers(rows, 3)).toEqual([
      { key: 'a', count: 10 },
      { key: 'b', count: 9 },
      { key: 'Outras', count: 8 + 7 + 6 },
    ])
    expect(topWithOthers(rows, 5)).toEqual(rows)
  })
})

describe('período anterior e tendência', () => {
  const now = new Date(2026, 9, 28) // 28/10/2026

  it('7 dias: o anterior termina no dia anterior ao início e tem a mesma duração', () => {
    expect(periodRange({ period: '7d', from: '', to: '' }, now)).toEqual({ from: '2026-10-22', to: '2026-10-28' })
    expect(previousRange({ period: '7d', from: '', to: '' }, now)).toEqual({ from: '2026-10-15', to: '2026-10-21' })
  })

  it('30 dias atravessa a virada de mês', () => {
    expect(previousRange({ period: '30d', from: '', to: '' }, now)).toEqual({ from: '2026-08-30', to: '2026-09-28' })
  })

  it('personalizado usa a duração informada; datas incompletas ou invertidas não têm comparação', () => {
    expect(previousRange({ period: 'custom', from: '2026-10-10', to: '2026-10-12' }, now)).toEqual({ from: '2026-10-07', to: '2026-10-09' })
    expect(previousRange({ period: 'custom', from: '2026-10-10', to: '' }, now)).toBeNull()
    expect(previousRange({ period: 'custom', from: '2026-10-12', to: '2026-10-10' }, now)).toBeNull()
    expect(previousRange({ period: 'all', from: '', to: '' }, now)).toBeNull()
  })

  it('previousFilters preserva os demais filtros e vira personalizado', () => {
    const f = { ...DEFAULT_REPORT_FILTERS, period: '7d' as const, category: 'c1', priority: 'high' as const, assignee: 'me' }
    expect(previousFilters(f, now)).toMatchObject({ period: 'custom', from: '2026-10-15', to: '2026-10-21', category: 'c1', priority: 'high', assignee: 'me' })
    expect(previousFilters({ ...f, period: 'all' }, now)).toBeNull()
  })

  it('tendência: percentual, sentido e ausência de base', () => {
    expect(computeTrend(15, 10)).toEqual({ pct: 50, direction: 'up', previous: 10 })
    expect(computeTrend(5, 10)).toEqual({ pct: -50, direction: 'down', previous: 10 })
    expect(computeTrend(10, 10)).toMatchObject({ pct: 0, direction: 'flat' })
    expect(computeTrend(4, 0)).toMatchObject({ pct: null, direction: 'up' })
    expect(computeTrend(0, 0)).toMatchObject({ pct: null, direction: 'flat' })
  })
})
