import { PRIORITIES, STATUSES } from '@/lib/ticketLabels'
import { isValidDateString } from '@/lib/ticketFilters'
import type { TicketPriority, TicketStatus } from '@/types/domain'

export type Period = '7d' | '30d' | '90d' | 'all' | 'custom'
export const PERIODS: Period[] = ['7d', '30d', '90d', 'all', 'custom']

export const PERIOD_LABEL: Record<Period, string> = {
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  '90d': 'Últimos 90 dias',
  all: 'Todo o período',
  custom: 'Personalizado',
}

export const MIN_RESOLVED_FOR_AVERAGE = 3

export interface ReportFilters {
  period: Period
  from: string
  to: string
  category: string
  priority: TicketPriority | ''
  status: TicketStatus | ''
  assignee: string
}

export const DEFAULT_REPORT_FILTERS: ReportFilters = {
  period: '30d',
  from: '',
  to: '',
  category: '',
  priority: '',
  status: '',
  assignee: '',
}

export interface ReportTotals {
  total: number
  open: number
  in_progress: number
  waiting: number
  resolved: number
  critical: number
  resolved_with_date: number
  avg_resolution_hours: number | null
}

export interface CountRow {
  key: string
  count: number
}

export interface AssigneeRow extends CountRow {
  resolved: number
  avg_resolution_hours: number | null
}

export interface TimelinePoint {
  day: string
  created: number
  resolved: number
}

export interface ReportData {
  totals: ReportTotals
  by_status: CountRow[]
  by_priority: CountRow[]
  by_category: CountRow[]
  by_assignee: AssigneeRow[]
  timeline: TimelinePoint[]
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseReportFilters(params: URLSearchParams, defaults: ReportFilters = DEFAULT_REPORT_FILTERS): ReportFilters {
  const period = params.get('period') ?? ''
  const priority = params.get('priority') ?? ''
  const status = params.get('status') ?? ''
  const category = params.get('category') ?? ''
  const assignee = params.get('assignee') ?? ''
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const parsedPeriod = (PERIODS as string[]).includes(period) ? (period as Period) : defaults.period
  return {
    period: parsedPeriod,
    from: isValidDateString(from) ? from : '',
    to: isValidDateString(to) ? to : '',
    category: UUID.test(category) ? category : '',
    priority: (PRIORITIES as string[]).includes(priority) ? (priority as TicketPriority) : '',
    status: (STATUSES as string[]).includes(status) ? (status as TicketStatus) : '',
    assignee: assignee === 'me' || UUID.test(assignee) ? assignee : params.has('assignee') ? '' : defaults.assignee,
  }
}

export function reportFiltersToParams(f: ReportFilters, defaults: ReportFilters = DEFAULT_REPORT_FILTERS): URLSearchParams {
  const p = new URLSearchParams()
  if (f.period !== defaults.period) p.set('period', f.period)
  if (f.period === 'custom') {
    if (f.from) p.set('from', f.from)
    if (f.to) p.set('to', f.to)
  }
  if (f.category) p.set('category', f.category)
  if (f.priority) p.set('priority', f.priority)
  if (f.status) p.set('status', f.status)
  // O padrão do assignee pode ser 'me': diferenças são sempre gravadas (inclusive "todos").
  if (f.assignee !== defaults.assignee) p.set('assignee', f.assignee)
  return p
}

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function periodRange(filters: Pick<ReportFilters, 'period' | 'from' | 'to'>, now: Date = new Date()): { from: string; to: string } {
  switch (filters.period) {
    case 'all':
      return { from: '', to: '' }
    case 'custom':
      return { from: filters.from, to: filters.to }
    default: {
      const days = filters.period === '7d' ? 7 : filters.period === '30d' ? 30 : 90
      const start = new Date(now)
      start.setDate(start.getDate() - (days - 1))
      return { from: toDateString(start), to: toDateString(now) }
    }
  }
}

export function hasSufficientAverage(totals: Pick<ReportTotals, 'resolved_with_date' | 'avg_resolution_hours'>): boolean {
  return totals.avg_resolution_hours !== null && totals.resolved_with_date >= MIN_RESOLVED_FOR_AVERAGE
}

// ---------------------------------------------------------------------------
// Linha do tempo
// ---------------------------------------------------------------------------

export interface TimelineBucket {
  start: string
  label: string
  created: number
  resolved: number
}

const DAY = 86_400_000

function parseDay(day: string): Date {
  return new Date(`${day}T00:00:00Z`)
}
function dayString(d: Date): string {
  return d.toISOString().slice(0, 10)
}
function mondayOf(d: Date): Date {
  const dow = (d.getUTCDay() + 6) % 7 // segunda = 0
  return new Date(d.getTime() - dow * DAY)
}
function shortLabel(day: string): string {
  const [, m, d] = day.split('-')
  return `${d}/${m}`
}

// Acima de duas semanas a linha diária fica serrilhada com o volume típico de um help desk
// pequeno; a semana (segunda a domingo) é a unidade que mostra a tendência.
export const MAX_DAILY_POINTS = 14

// Preenche dias sem chamados com zero (para a linha não "pular" datas) e, em intervalos
// maiores que duas semanas, agrupa por semana (iniciando na segunda-feira).
export function bucketTimeline(points: TimelinePoint[], range: { from: string; to: string }, today: Date = new Date()): TimelineBucket[] {
  const sorted = [...points].sort((a, b) => a.day.localeCompare(b.day))
  const first = range.from || sorted[0]?.day
  const last = range.to || toDateString(today)
  if (!first) return []
  const start = parseDay(first)
  const end = parseDay(last < first ? first : last)
  const byDay = new Map(sorted.map((p) => [p.day, p]))

  const days: { day: string; created: number; resolved: number }[] = []
  for (let t = start.getTime(); t <= end.getTime(); t += DAY) {
    const key = dayString(new Date(t))
    const p = byDay.get(key)
    days.push({ day: key, created: p?.created ?? 0, resolved: p?.resolved ?? 0 })
  }

  if (days.length <= MAX_DAILY_POINTS) {
    return days.map((d) => ({ start: d.day, label: shortLabel(d.day), created: d.created, resolved: d.resolved }))
  }

  const weeks = new Map<string, TimelineBucket>()
  for (const d of days) {
    const key = dayString(mondayOf(parseDay(d.day)))
    const bucket = weeks.get(key) ?? { start: key, label: `Sem. ${shortLabel(key)}`, created: 0, resolved: 0 }
    bucket.created += d.created
    bucket.resolved += d.resolved
    weeks.set(key, bucket)
  }
  return [...weeks.values()]
}

export function topWithOthers(rows: CountRow[], limit: number, othersLabel = 'Outras'): CountRow[] {
  if (rows.length <= limit) return rows
  const sorted = [...rows].sort((a, b) => b.count - a.count)
  const head = sorted.slice(0, limit - 1)
  const rest = sorted.slice(limit - 1).reduce((sum, r) => sum + r.count, 0)
  return [...head, { key: othersLabel, count: rest }]
}

export interface LabeledCount {
  key: string
  label: string
  count: number
}

export function completeCounts<K extends string>(rows: CountRow[], order: K[], labels: Record<K, string>): LabeledCount[] {
  const map = new Map(rows.map((r) => [r.key, r.count]))
  return order.map((key) => ({ key, label: labels[key], count: map.get(key) ?? 0 }))
}

// ---------------------------------------------------------------------------
// Comparação com o período anterior (tendência)
// ---------------------------------------------------------------------------

const MS_DAY = 86_400_000

function localDate(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

// Período imediatamente anterior, com a mesma duração, para calcular tendências.
// Retorna null quando não há intervalo definido ("todo o período" ou datas incompletas/invertidas).
export function previousRange(
  filters: Pick<ReportFilters, 'period' | 'from' | 'to'>,
  now: Date = new Date(),
): { from: string; to: string } | null {
  const { from, to } = periodRange(filters, now)
  if (!from || !to || from > to) return null
  const start = localDate(from)
  const days = Math.round((localDate(to).getTime() - start.getTime()) / MS_DAY) + 1
  const prevEnd = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1)
  const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), prevEnd.getDate() - (days - 1))
  return { from: toDateString(prevStart), to: toDateString(prevEnd) }
}

export function previousFilters(filters: ReportFilters, now: Date = new Date()): ReportFilters | null {
  const range = previousRange(filters, now)
  return range ? { ...filters, period: 'custom', from: range.from, to: range.to } : null
}

export interface Trend {
  pct: number | null
  direction: 'up' | 'down' | 'flat'
  previous: number
}

export function computeTrend(current: number, previous: number): Trend {
  if (previous === 0) return { pct: null, direction: current === 0 ? 'flat' : 'up', previous }
  const pct = Math.round(((current - previous) / previous) * 100)
  return { pct, direction: pct === 0 ? 'flat' : pct > 0 ? 'up' : 'down', previous }
}
