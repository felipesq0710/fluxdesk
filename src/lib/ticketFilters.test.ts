import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FILTERS,
  dayStartISO,
  filtersToSearchParams,
  hasActiveFilters,
  nextDayStartISO,
  parseTicketFilters,
  sanitizeSearch,
} from '@/lib/ticketFilters'

const UUID = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e'

describe('parseTicketFilters', () => {
  it('usa os padrões quando a URL está vazia', () => {
    expect(parseTicketFilters(new URLSearchParams())).toEqual(DEFAULT_FILTERS)
  })

  it('lê filtros válidos', () => {
    const f = parseTicketFilters(
      new URLSearchParams(`q=impressora&status=open&priority=high&category=${UUID}&assignee=me&from=2026-01-05&to=2026-02-10&sort=title&dir=asc&page=3`),
    )
    expect(f).toMatchObject({
      search: 'impressora',
      status: 'open',
      priority: 'high',
      category: UUID,
      assignee: 'me',
      from: '2026-01-05',
      to: '2026-02-10',
      sort: 'title',
      dir: 'asc',
      page: 3,
    })
  })

  it('descarta valores inválidos ou maliciosos', () => {
    const f = parseTicketFilters(
      new URLSearchParams('status=hack&priority=x&category=1%27%20or%201=1&assignee=todos&from=2026-13-40&sort=password&dir=up&page=-4'),
    )
    expect(f).toEqual(DEFAULT_FILTERS)
  })

  it('rejeita datas inexistentes como 31/02', () => {
    expect(parseTicketFilters(new URLSearchParams('from=2026-02-31')).from).toBe('')
  })

  it('limita o tamanho da busca', () => {
    expect(parseTicketFilters(new URLSearchParams({ q: 'a'.repeat(500) })).search).toHaveLength(100)
  })
})

describe('filtersToSearchParams', () => {
  it('omite valores padrão', () => {
    expect(filtersToSearchParams(DEFAULT_FILTERS).toString()).toBe('')
  })

  it('é inversa de parseTicketFilters', () => {
    const original = { ...DEFAULT_FILTERS, search: 'wifi', status: 'resolved' as const, assignee: 'none', sort: 'priority' as const, dir: 'asc' as const, page: 2 }
    expect(parseTicketFilters(filtersToSearchParams(original))).toEqual(original)
  })
})

describe('hasActiveFilters', () => {
  it('ignora ordenação e página', () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, sort: 'title', page: 4 })).toBe(false)
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, status: 'open' })).toBe(true)
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, search: '  ' })).toBe(false)
  })
})

describe('sanitizeSearch', () => {
  it('remove caracteres da sintaxe de filtros do PostgREST e do LIKE', () => {
    expect(sanitizeSearch('a,b)%_*(c')).toBe('a b c')
    expect(sanitizeSearch('title.ilike.%x%,status.eq.open')).not.toMatch(/[,%]/)
    expect(sanitizeSearch("  João's  \"rede\"  ")).toBe('João s rede')
  })
})

describe('limites de data', () => {
  it('o fim do intervalo é exclusivo (início do dia seguinte)', () => {
    const start = new Date(dayStartISO('2026-03-10')).getTime()
    const end = new Date(nextDayStartISO('2026-03-10')).getTime()
    expect(end - start).toBeGreaterThanOrEqual(23 * 3600_000)
    expect(end - start).toBeLessThanOrEqual(25 * 3600_000)
  })

  it('atravessa o fim do mês', () => {
    expect(new Date(nextDayStartISO('2026-01-31')).getDate()).toBe(1)
  })
})
