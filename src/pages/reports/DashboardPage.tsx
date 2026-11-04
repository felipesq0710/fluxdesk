import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, ClipboardList, Plus, Ticket } from 'lucide-react'
import { PriorityBars } from '@/components/tickets/badges'
import { ReportFiltersBar } from '@/components/reports/ReportFiltersBar'
import { ReportStatus, ReportView } from '@/components/reports/ReportView'
import { PriorityBadge, StatusBadge } from '@/components/tickets/badges'
import { useProfile } from '@/hooks/useAuth'
import { useReport } from '@/hooks/useReport'
import { useReportFilters } from '@/hooks/useReportFilters'
import { useCategories, useTicketCount, useTickets } from '@/hooks/useTickets'
import { ATTENTION_LABEL, daysSince, rankAttention, type AttentionReason } from '@/lib/attention'
import { formatRelative } from '@/lib/format'
import { isStaff } from '@/lib/permissions'
import { DEFAULT_REPORT_FILTERS, previousFilters } from '@/lib/report'
import { DEFAULT_FILTERS, type TicketFilters } from '@/lib/ticketFilters'

const RECENT: TicketFilters = { ...DEFAULT_FILTERS, sort: 'updated_at', dir: 'desc' }
const RECENT_LIMIT = 6

function RecentActivity({ userId }: { userId: string }) {
  const tickets = useTickets(RECENT, userId, {})
  const items = (tickets.data?.items ?? []).slice(0, RECENT_LIMIT)
  return (
    <section className="card p-5" aria-labelledby="recent-title">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id="recent-title" className="section-title">Atividade recente</h2>
        <Link to="/chamados" className="link text-sm">Ver todos</Link>
      </div>
      {tickets.isPending ? (
        <p role="status" className="py-8 text-center text-sm text-fg-muted">Carregando…</p>
      ) : tickets.isError ? (
        <p className="py-8 text-center text-sm text-fg-muted">Não foi possível carregar a atividade recente.</p>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-fg-muted">Nenhum chamado atualizado ainda.</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((t) => (
            <li key={t.id}>
              <Link to={`/chamados/${t.id}`} className="-mx-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-control px-2 py-2.5 hover:bg-surface-muted">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">{t.title}</span>
                  <span className="block text-xs text-fg-muted">{t.code} · atualizado {formatRelative(t.updated_at)}</span>
                </span>
                <span className="flex items-center gap-3">
                  <PriorityBadge priority={t.priority} />
                  <StatusBadge status={t.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const ATTENTION_QUERY: TicketFilters = { ...DEFAULT_FILTERS, sort: 'updated_at', dir: 'asc' }
const ATTENTION_LIMIT = 5

function AttentionCount({ label, value, to }: { label: string; value: number | undefined; to: string }) {
  return (
    <Link to={to} className="group rounded-control px-3 py-2 hover:bg-surface-muted">
      <span className="numeral block text-2xl text-fg">{value ?? '—'}</span>
      <span className="block text-xs text-fg-muted group-hover:text-fg">{label}</span>
    </Link>
  )
}

function ReasonTag({ reason }: { reason: AttentionReason }) {
  const strong = reason === 'critical' || reason === 'waiting_you'
  return (
    <span
      className={
        strong
          ? 'rounded-full bg-sand px-2 py-0.5 text-xs font-medium text-graphite-900 ring-1 ring-inset ring-sand-400/50'
          : 'rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-fg-muted ring-1 ring-inset ring-line'
      }
    >
      {ATTENTION_LABEL[reason]}
    </span>
  )
}

function AttentionPanel({ userId, staff }: { userId: string; staff: boolean }) {
  const tickets = useTickets(ATTENTION_QUERY, userId, { activeOnly: true })
  const critical = useTicketCount(userId, { activeOnly: true, priority: 'critical' })
  const unassigned = useTicketCount(userId, { activeOnly: true, unassigned: true })
  const waiting = useTicketCount(userId, { status: 'waiting_requester' })
  const items = useMemo(() => rankAttention(tickets.data?.items ?? [], staff, ATTENTION_LIMIT), [tickets.data, staff])

  return (
    <section aria-labelledby="attention-title" className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line px-5 py-4">
        <div>
          <h2 id="attention-title" className="font-display text-lg font-semibold tracking-tight text-fg">
            {staff ? 'Exige atenção' : 'Aguardando você'}
          </h2>
          <p className="text-xs text-fg-muted">
            {staff ? 'Críticos, sem responsável ou sem atualização há 3 dias ou mais.' : 'Chamados que esperam uma resposta sua.'}
          </p>
        </div>
        {staff ? (
          <div className="-mx-1 flex gap-1">
            <AttentionCount label="Críticos ativos" value={critical.data} to="/chamados?priority=critical" />
            <AttentionCount label="Sem responsável" value={unassigned.data} to="/chamados?assignee=none" />
          </div>
        ) : (
          <div className="-mx-1">
            <AttentionCount label="Aguardando resposta" value={waiting.data} to="/chamados?status=waiting_requester" />
          </div>
        )}
      </div>
      {tickets.isPending ? (
        <p role="status" className="px-5 py-8 text-center text-sm text-fg-muted">Carregando…</p>
      ) : tickets.isError ? (
        <p className="px-5 py-8 text-center text-sm text-fg-muted">Não foi possível carregar os chamados que exigem atenção.</p>
      ) : items.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-fg-muted">
          {staff ? 'Nada urgente por aqui. Nenhum chamado crítico, parado ou sem responsável.' : 'Nenhum chamado aguardando resposta sua.'}
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map(({ ticket: t, reasons }) => {
            const idle = daysSince(t.updated_at)
            return (
              <li key={t.id}>
                <Link to={`/chamados/${t.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3 hover:bg-surface-muted">
                  <PriorityBars priority={t.priority} />
                  <span className="min-w-0 flex-1 basis-56">
                    <span className="block truncate text-sm font-medium text-fg">{t.title}</span>
                    <span className="block break-words text-xs text-fg-muted sm:truncate">
                      {t.code} · {t.assignee?.full_name ?? 'Sem responsável'}
                      {idle >= 1 ? ` · sem atualização há ${idle} ${idle === 1 ? 'dia' : 'dias'}` : ` · atualizado ${formatRelative(t.updated_at)}`}
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {reasons.map((r) => (
                      <ReasonTag key={r} reason={r} />
                    ))}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default function DashboardPage() {
  const profile = useProfile()
  const staff = isStaff(profile.role)
  // Técnicos começam vendo a própria carga; podem ampliar para "Todos".
  const defaults = useMemo(
    () => (profile.role === 'technician' ? { ...DEFAULT_REPORT_FILTERS, assignee: 'me' } : DEFAULT_REPORT_FILTERS),
    [profile.role],
  )
  const { filters, update, clear, dirty } = useReportFilters(defaults)
  const report = useReport(filters, profile.id)
  const prevFilters = useMemo(() => previousFilters(filters), [filters])
  const previous = useReport(prevFilters ?? filters, profile.id, { enabled: prevFilters !== null })
  const categories = useCategories(false)

  return (
    <div className="flex flex-col space-y-6">
      <div className="order-1 flex flex-wrap items-end justify-between gap-3 md:order-none">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-lead">
            {staff ? 'Visão geral dos chamados dentro do seu acesso.' : 'Resumo dos chamados que você abriu.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to={staff ? '/minha-fila' : '/chamados'} className="btn-secondary">
            {staff ? <ClipboardList className="h-4 w-4" aria-hidden="true" /> : <Ticket className="h-4 w-4" aria-hidden="true" />}
            {staff ? 'Minha fila' : 'Meus chamados'}
          </Link>
          <Link to="/conhecimento" className="btn-secondary">
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            Base de conhecimento
          </Link>
          <Link to="/chamados/novo" className="btn-primary">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Novo chamado
          </Link>
        </div>
      </div>

      <div className="order-4 md:order-none">
        <AttentionPanel userId={profile.id} staff={staff} />
      </div>

      <div className="order-2 md:order-none">
        <ReportFiltersBar
          filters={filters}
          onChange={update}
          onClear={clear}
          categories={categories.data ?? []}
          dirty={dirty}
        />
      </div>

      <div className="order-3 space-y-6 md:order-none">
        <ReportStatus isLoading={report.isLoading} isError={report.isError} onRetry={() => void report.refetch()} />
        {report.data && (
          <ReportView
            data={report.data}
            filters={filters}
            showAssignees={staff}
            previous={prevFilters ? (previous.data ?? null) : null}
            collapseAnalyses
            extra={<RecentActivity userId={profile.id} />}
          />
        )}
      </div>
    </div>
  )
}
