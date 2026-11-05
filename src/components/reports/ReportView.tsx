import { useMemo, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { DistributionChart } from '@/components/reports/Charts'
import { OverviewPanel } from '@/components/reports/OverviewPanel'
import { PriorityBars, StatusGlyph } from '@/components/tickets/badges'
import { DataTable } from '@/components/reports/ChartCard'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Spinner } from '@/components/ui/Spinner'
import { formatHours } from '@/lib/format'
import {
  MIN_RESOLVED_FOR_AVERAGE,
  bucketTimeline,
  completeCounts,
  computeTrend,
  hasSufficientAverage,
  PERIOD_LABEL,
  periodRange,
  topWithOthers,
  type ReportData,
  type ReportFilters,
} from '@/lib/report'
import { PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL } from '@/lib/ticketLabels'
import type { TicketPriority, TicketStatus } from '@/types/domain'

const QUEUE_ROWS: { key: 'open' | 'in_progress' | 'waiting' | 'resolved'; label: string; hint: string; status: TicketStatus }[] = [
  { key: 'open', label: 'Abertos', hint: 'Ainda sem atendimento', status: 'open' },
  { key: 'in_progress', label: 'Em andamento', hint: 'Em atendimento', status: 'in_progress' },
  { key: 'waiting', label: 'Aguardando', hint: 'Solicitante ou terceiros', status: 'waiting_requester' },
  { key: 'resolved', label: 'Resolvidos', hint: 'Inclui encerrados', status: 'resolved' },
]

function QueueCard({ totals, dashboard = false, composite = false }: { totals: ReportData['totals']; dashboard?: boolean; composite?: boolean }) {
  const enoughForAverage = hasSufficientAverage(totals)
  return (
    <section className={composite ? 'flex min-w-0 flex-col border-t border-line/70 p-4 sm:p-5 lg:border-l lg:border-t-0 lg:p-6' : dashboard ? 'card flex h-full flex-col p-4 sm:p-5' : 'card flex flex-col p-5'} aria-labelledby="queue-title">
      <h2 id="queue-title" className="section-title">Situação da fila</h2>
      <dl className={dashboard ? 'mt-2 divide-y divide-line' : 'mt-3 divide-y divide-line'}>
        {QUEUE_ROWS.map((r) => (
          <div key={r.key} className={dashboard ? 'flex items-center justify-between gap-3 py-2' : 'flex items-center justify-between gap-3 py-2.5'}>
            <dt className="flex items-center gap-2.5">
              <StatusGlyph status={r.status} />
              <span>
                <span className="block text-sm font-medium text-fg">{r.label}</span>
                <span className="block text-xs text-fg-muted">{r.hint}</span>
              </span>
            </dt>
            <dd className="numeral text-xl text-fg">{totals[r.key]}</dd>
          </div>
        ))}
        <div className={dashboard ? 'flex items-center justify-between gap-3 py-2' : 'flex items-center justify-between gap-3 py-2.5'}>
          <dt className="flex items-center gap-2.5">
            <PriorityBars priority="critical" />
            <span className="text-sm font-medium text-fg">Críticos ativos</span>
          </dt>
          <dd className="numeral text-xl text-fg">{totals.critical}</dd>
        </div>
      </dl>
      <div className={dashboard ? 'mt-2 border-t border-line pt-3' : 'mt-auto rounded-control bg-surface-muted p-3'}>
        <p className="text-xs font-medium text-fg-muted">Tempo médio de resolução</p>
        {enoughForAverage && totals.avg_resolution_hours !== null ? (
          <p className="numeral mt-1 text-xl text-fg">
            {formatHours(totals.avg_resolution_hours)}
            <span className="ml-2 font-sans text-xs font-normal text-fg-muted">com base em {totals.resolved_with_date} chamados</span>
          </p>
        ) : (
          <p className="mt-1 text-sm text-fg">
            Dados insuficientes
            <span className="mt-0.5 block text-xs text-fg-muted">
              São necessários ao menos {MIN_RESOLVED_FOR_AVERAGE} chamados resolvidos no filtro (há {totals.resolved_with_date}).
            </span>
          </p>
        )}
      </div>
    </section>
  )
}

export function ReportView({
  data,
  filters,
  showAssignees,
  previous,
  extra,
  collapseAnalyses = false,
  dashboardLayout = false,
  priorityPanel,
}: {
  data: ReportData
  filters: ReportFilters
  showAssignees: boolean
  previous?: ReportData | null
  extra?: ReactNode
  collapseAnalyses?: boolean
  dashboardLayout?: boolean
  priorityPanel?: ReactNode
}) {
  const { totals } = data
  const range = useMemo(() => periodRange(filters), [filters])
  const timeline = useMemo(() => bucketTimeline(data.timeline, range), [data.timeline, range])
  const byStatus = useMemo(
    () => completeCounts<TicketStatus>(data.by_status, STATUSES, STATUS_LABEL),
    [data.by_status],
  )
  const byPriority = useMemo(
    () => completeCounts<TicketPriority>(data.by_priority, PRIORITIES, PRIORITY_LABEL),
    [data.by_priority],
  )
  const byCategory = useMemo(
    () => topWithOthers([...data.by_category].sort((a, b) => b.count - a.count), 8).map((r) => ({ key: r.key, label: r.key, count: r.count })),
    [data.by_category],
  )
  const analysisChartHeight = Math.max(120, Math.max(byStatus.length, byPriority.length, byCategory.length) * 34 + 16)
  const totalTrend = previous ? computeTrend(totals.total, previous.totals.total) : null
  const resolvedTrend = previous ? computeTrend(totals.resolved, previous.totals.resolved) : null

  const analyses = (
      <div className="grid gap-5 lg:grid-cols-2">
        <DistributionChart title="Por status" rows={byStatus} palette="status" height={analysisChartHeight} />
        <DistributionChart title="Por prioridade" rows={byPriority} palette="priority" height={analysisChartHeight} />
        <DistributionChart title="Por categoria" description={data.by_category.length > 8 ? 'Categorias menores agrupadas em "Outras".' : undefined} rows={byCategory} palette="category" height={analysisChartHeight} />
        {showAssignees && (
          <section className="card p-5" aria-label="Por responsável">
            <h2 className="section-title mb-3">Por responsável</h2>
            <AssigneeTable data={data} />
          </section>
        )}
      </div>
  )

  if (dashboardLayout) {
    return (
      <div className="flex flex-col gap-5">
        <div className="order-1 lg:order-2">
          <OverviewPanel
            total={totals.total}
            resolved={totals.resolved}
            totalTrend={totalTrend}
            resolvedTrend={resolvedTrend}
            comparisonLabel="vs. período anterior"
            periodLabel={filters.period === 'all' ? 'todo o período' : PERIOD_LABEL[filters.period]}
            buckets={timeline}
            dashboard
          />
        </div>
        <div className="order-2 grid items-stretch gap-4 lg:order-1 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          {priorityPanel && <div className="flex min-w-0 [&>section]:h-full [&>section]:w-full">{priorityPanel}</div>}
          <QueueCard totals={totals} dashboard />
        </div>
        {extra && <div className="order-3">{extra}</div>}
        <div className="order-4">
          {collapseAnalyses ? <AnalysesSection>{analyses}</AnalysesSection> : analyses}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="reports-overview-panel card grid overflow-hidden lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="min-w-0">
          <OverviewPanel
            total={totals.total}
            resolved={totals.resolved}
            totalTrend={totalTrend}
            resolvedTrend={resolvedTrend}
            comparisonLabel="vs. período anterior"
            periodLabel={filters.period === 'all' ? 'todo o período' : PERIOD_LABEL[filters.period]}
            buckets={timeline}
            composite
          />
        </div>
        <QueueCard totals={totals} composite />
      </div>

      {extra}

      {collapseAnalyses ? <AnalysesSection>{analyses}</AnalysesSection> : analyses}
    </div>
  )
}

function AnalysesSection({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <section aria-labelledby="analyses-title" className="border-t border-line pt-4">
      <h2 id="analyses-title" className="text-sm font-medium text-fg">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="-ml-2 inline-flex items-center gap-2 rounded-control px-2 py-1.5 text-fg-muted hover:bg-surface-muted hover:text-fg"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? '' : '-rotate-90'}`} aria-hidden="true" />
          Análises por status, prioridade, categoria e responsável
        </button>
      </h2>
      {open && <div className="mt-4">{children}</div>}
    </section>
  )
}

function AssigneeTable({ data }: { data: ReportData }) {
  if (data.by_assignee.length === 0) return <p className="py-6 text-center text-sm text-fg-muted">Nenhum chamado atribuído no período.</p>
  return (
    <DataTable
      caption="Chamados por responsável"
      headers={['Responsável', 'Atribuídos', 'Resolvidos', 'Tempo médio']}
      cellPaddingClass="py-5"
      rows={data.by_assignee.map((a) => [
        a.key,
        a.count,
        a.resolved,
        a.resolved >= MIN_RESOLVED_FOR_AVERAGE && a.avg_resolution_hours !== null ? formatHours(a.avg_resolution_hours) : '—',
      ])}
    />
  )
}

export function ReportStatus({
  isLoading,
  isError,
  onRetry,
}: {
  isLoading: boolean
  isError: boolean
  onRetry: () => void
}) {
  if (isLoading)
    return (
      <div role="status" className="card flex items-center justify-center gap-2 py-16 text-sm text-fg-muted">
        <Spinner /> Carregando indicadores…
      </div>
    )
  if (isError) return <ErrorState title="Não foi possível carregar o relatório" onRetry={onRetry} />
  return null
}
