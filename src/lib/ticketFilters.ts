import { PRIORITIES, STATUSES } from '@/lib/ticketLabels'
import type { TicketPriority, TicketStatus } from '@/types/domain'

export const PAGE_SIZE = 20

export const SORT_KEYS = ['number', 'title', 'priority', 'status', 'created_at', 'updated_at'] as const
export type TicketSortKey = (typeof SORT_KEYS)[number]
export type SortDir = 'asc' | 'desc'

export interface TicketFilters {
  search: string
  status: TicketStatus | ''
  priority: TicketPriority | ''
  category: string
  assignee: string
  from: string
  to: string
  sort: TicketSortKey
  dir: SortDir
  page: number
}

export const DEFAULT_FILTERS: TicketFilters = {
  search: '',
  status: '',
  priority: '',
  category: '',
  assignee: '',
  from: '',
  to: '',
  sort: 'created_at',
  dir: 'desc',
  page: 1,
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/

export function isValidDateString(value: string): boolean {
  if (!DATE.test(value)) return false
  const d = new Date(`${value}T00:00:00`)
  return !Number.isNaN(d.getTime()) && d.toISOString().length > 0 && toDateString(d) === value
}

function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseTicketFilters(params: URLSearchParams): TicketFilters {
  const status = params.get('status') ?? ''
  const priority = params.get('priority') ?? ''
  const category = params.get('category') ?? ''
  const assignee = params.get('assignee') ?? ''
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const sort = params.get('sort') ?? ''
  const dir = params.get('dir') ?? ''
  const page = Number.parseInt(params.get('page') ?? '', 10)

  return {
    search: (params.get('q') ?? '').slice(0, 100),
    status: (STATUSES as string[]).includes(status) ? (status as TicketStatus) : '',
    priority: (PRIORITIES as string[]).includes(priority) ? (priority as TicketPriority) : '',
    category: UUID.test(category) ? category : '',
    assignee: assignee === 'none' || assignee === 'me' || UUID.test(assignee) ? assignee : '',
    from: isValidDateString(from) ? from : '',
    to: isValidDateString(to) ? to : '',
    sort: (SORT_KEYS as readonly string[]).includes(sort) ? (sort as TicketSortKey) : DEFAULT_FILTERS.sort,
    dir: dir === 'asc' || dir === 'desc' ? dir : DEFAULT_FILTERS.dir,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  }
}

export function filtersToSearchParams(f: TicketFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.search.trim()) p.set('q', f.search.trim())
  if (f.status) p.set('status', f.status)
  if (f.priority) p.set('priority', f.priority)
  if (f.category) p.set('category', f.category)
  if (f.assignee) p.set('assignee', f.assignee)
  if (f.from) p.set('from', f.from)
  if (f.to) p.set('to', f.to)
  if (f.sort !== DEFAULT_FILTERS.sort) p.set('sort', f.sort)
  if (f.dir !== DEFAULT_FILTERS.dir) p.set('dir', f.dir)
  if (f.page > 1) p.set('page', String(f.page))
  return p
}

export function hasActiveFilters(f: TicketFilters): boolean {
  return Boolean(f.search.trim() || f.status || f.priority || f.category || f.assignee || f.from || f.to)
}

// Remove caracteres que têm significado na sintaxe de filtros do PostgREST ou do LIKE,
// evitando que a busca do usuário altere a consulta.
export function sanitizeSearch(term: string): string {
  return term
    .replace(/[%_,()*\\"'`;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
}

export function dayStartISO(date: string): string {
  return new Date(`${date}T00:00:00`).toISOString()
}

export function nextDayStartISO(date: string): string {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() + 1)
  return d.toISOString()
}
