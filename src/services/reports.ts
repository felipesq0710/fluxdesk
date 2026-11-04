import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { dayStartISO, nextDayStartISO } from '@/lib/ticketFilters'
import { periodRange, type ReportData, type ReportFilters } from '@/lib/report'

const count = z.number().int().nonnegative()
const hours = z.number().nonnegative().nullable()

const reportSchema = z.object({
  totals: z.object({
    total: count,
    open: count,
    in_progress: count,
    waiting: count,
    resolved: count,
    critical: count,
    resolved_with_date: count,
    avg_resolution_hours: hours,
  }),
  by_status: z.array(z.object({ key: z.string(), count })),
  by_priority: z.array(z.object({ key: z.string(), count })),
  by_category: z.array(z.object({ key: z.string(), count })),
  by_assignee: z.array(z.object({ key: z.string(), count, resolved: count, avg_resolution_hours: hours })),
  timeline: z.array(z.object({ day: z.string(), created: count, resolved: count })),
})

function timeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo'
  } catch {
    return 'America/Sao_Paulo'
  }
}

function resolveAssignee(filters: ReportFilters, userId: string): string | null {
  if (filters.assignee === 'me') return userId
  return filters.assignee || null
}

// Agregações calculadas no banco pela função ticket_report (respeita a RLS de quem consulta).
export async function fetchReport(filters: ReportFilters, userId: string): Promise<ReportData> {
  const range = periodRange(filters)
  const { data, error } = await supabase.rpc('ticket_report', {
    p_from: range.from ? dayStartISO(range.from) : null,
    p_to: range.to ? nextDayStartISO(range.to) : null,
    p_category: filters.category || null,
    p_priority: filters.priority || null,
    p_status: filters.status || null,
    p_assignee: resolveAssignee(filters, userId),
    p_tz: timeZone(),
  })
  if (error) throw error
  return reportSchema.parse(data)
}

// ---------------------------------------------------------------------------
// Exportação
// ---------------------------------------------------------------------------

export interface ExportRow {
  code: string
  title: string
  status: string
  priority: string
  category: string
  requester: string
  assignee: string
  created_at: string
  updated_at: string
  resolved_at: string | null
}

interface RawExportRow {
  code: string
  title: string
  status: string
  priority: string
  created_at: string
  updated_at: string
  resolved_at: string | null
  requester: { full_name: string } | null
  assignee: { full_name: string } | null
  category: { name: string } | null
}

export const EXPORT_BATCH = 1000
export const EXPORT_MAX_ROWS = 10_000

// Busca os chamados do filtro atual em lotes (a RLS limita ao que o usuário pode ver).
export async function fetchTicketsForExport(filters: ReportFilters, userId: string): Promise<{ rows: ExportRow[]; truncated: boolean }> {
  const range = periodRange(filters)
  const rows: ExportRow[] = []
  let truncated = false

  for (let from = 0; from < EXPORT_MAX_ROWS; from += EXPORT_BATCH) {
    let query = supabase
      .from('tickets')
      .select(
        `code, title, status, priority, created_at, updated_at, resolved_at,
         requester:profiles!tickets_requester_id_fkey(full_name),
         assignee:profiles!tickets_assignee_id_fkey(full_name),
         category:categories(name)`,
      )
    if (range.from) query = query.gte('created_at', dayStartISO(range.from))
    if (range.to) query = query.lt('created_at', nextDayStartISO(range.to))
    if (filters.category) query = query.eq('category_id', filters.category)
    if (filters.priority) query = query.eq('priority', filters.priority)
    if (filters.status) query = query.eq('status', filters.status)
    const assignee = resolveAssignee(filters, userId)
    if (assignee) query = query.eq('assignee_id', assignee)

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + EXPORT_BATCH - 1)
      .overrideTypes<RawExportRow[], { merge: false }>()
    if (error) throw error
    const batch = data ?? []
    for (const r of batch) {
      rows.push({
        code: r.code,
        title: r.title,
        status: r.status,
        priority: r.priority,
        category: r.category?.name ?? '',
        requester: r.requester?.full_name ?? '',
        assignee: r.assignee?.full_name ?? '',
        created_at: r.created_at,
        updated_at: r.updated_at,
        resolved_at: r.resolved_at,
      })
    }
    if (batch.length < EXPORT_BATCH) return { rows, truncated }
    if (from + EXPORT_BATCH >= EXPORT_MAX_ROWS) truncated = true
  }
  return { rows, truncated }
}
