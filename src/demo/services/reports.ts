import { periodRange, type ReportData, type ReportFilters } from '@/lib/report'
import { dayStartISO, nextDayStartISO } from '@/lib/ticketFilters'
import { PRIORITIES, STATUSES } from '@/lib/ticketLabels'
import { currentActor, localDay, visibleTickets } from '@/demo/store'
import type { Ticket } from '@/types/domain'

export type { ExportRow } from '../../services/reports'
import type { ExportRow } from '../../services/reports'

export const EXPORT_BATCH = 1000
export const EXPORT_MAX_ROWS = 10_000

function filtered(filters: ReportFilters, userId: string): Ticket[] {
  const range = periodRange(filters)
  const assignee = filters.assignee === 'me' ? userId : filters.assignee || null
  return visibleTickets(currentActor().role, userId).filter(
    (t) =>
      (!range.from || t.created_at >= dayStartISO(range.from)) &&
      (!range.to || t.created_at < nextDayStartISO(range.to)) &&
      (!filters.category || t.category_id === filters.category) &&
      (!filters.priority || t.priority === filters.priority) &&
      (!filters.status || t.status === filters.status) &&
      (!assignee || t.assignee_id === assignee),
  )
}

const avg = (rows: Ticket[]) => {
  const done = rows.filter((t) => t.resolved_at)
  if (!done.length) return null
  const hours = done.reduce((s, t) => s + (Date.parse(t.resolved_at as string) - Date.parse(t.created_at)) / 3_600_000, 0) / done.length
  return Math.round(hours * 10) / 10
}

export async function fetchReport(filters: ReportFilters, userId: string): Promise<ReportData> {
  await new Promise((r) => setTimeout(r, 120))
  const rows = filtered(filters, userId)
  const count = (pred: (t: Ticket) => boolean) => rows.filter(pred).length
  const days = new Map<string, { created: number; resolved: number }>()
  const bump = (day: string, key: 'created' | 'resolved') => days.set(day, { created: 0, resolved: 0, ...days.get(day), [key]: (days.get(day)?.[key] ?? 0) + 1 })
  for (const t of rows) {
    bump(localDay(t.created_at), 'created')
    if (t.resolved_at) bump(localDay(t.resolved_at), 'resolved')
  }
  const names = new Map<string, Ticket[]>()
  for (const t of rows) if (t.assignee) names.set(t.assignee.full_name, [...(names.get(t.assignee.full_name) ?? []), t])
  const cats = new Map<string, number>()
  for (const t of rows) cats.set(t.category?.name ?? '—', (cats.get(t.category?.name ?? '—') ?? 0) + 1)
  return {
    totals: {
      total: rows.length,
      open: count((t) => t.status === 'open'),
      in_progress: count((t) => t.status === 'in_progress'),
      waiting: count((t) => t.status === 'waiting_requester' || t.status === 'waiting_third_party'),
      resolved: count((t) => t.status === 'resolved' || t.status === 'closed'),
      critical: count((t) => t.priority === 'critical' && t.status !== 'resolved' && t.status !== 'closed'),
      resolved_with_date: count((t) => t.resolved_at !== null),
      avg_resolution_hours: avg(rows),
    },
    by_status: STATUSES.map((key) => ({ key, count: count((t) => t.status === key) })).filter((r) => r.count > 0),
    by_priority: PRIORITIES.map((key) => ({ key, count: count((t) => t.priority === key) })).filter((r) => r.count > 0),
    by_category: [...cats].map(([key, c]) => ({ key, count: c })),
    by_assignee: [...names].map(([key, list]) => ({ key, count: list.length, resolved: list.filter((t) => t.resolved_at).length, avg_resolution_hours: avg(list) })).sort((a, b) => b.count - a.count),
    timeline: [...days].map(([day, v]) => ({ day, ...v })).sort((a, b) => a.day.localeCompare(b.day)),
  }
}

export async function fetchTicketsForExport(filters: ReportFilters, userId: string): Promise<{ rows: ExportRow[]; truncated: boolean }> {
  const rows = filtered(filters, userId).map((t) => ({ code: t.code, title: t.title, status: t.status, priority: t.priority, category: t.category?.name ?? '', requester: t.requester?.full_name ?? '', assignee: t.assignee?.full_name ?? '', created_at: t.created_at, updated_at: t.updated_at, resolved_at: t.resolved_at }))
  return { rows, truncated: false }
}
