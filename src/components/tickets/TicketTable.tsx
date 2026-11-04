import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, ArrowUpDown, Hand, Hourglass } from 'lucide-react'
import { PriorityBadge, StatusBadge } from '@/components/tickets/badges'
import { Avatar } from '@/components/ui/Avatar'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { toast } from 'sonner'
import { useUpdateTicket } from '@/hooks/useTickets'
import { daysSince, isActive, STALE_DAYS } from '@/lib/attention'
import { dbErrorMessage } from '@/lib/errors'
import { formatDateTime, formatRelative } from '@/lib/format'
import { canClaim } from '@/lib/ticketRules'
import type { SortDir, TicketSortKey } from '@/lib/ticketFilters'
import type { Ticket, UserRole } from '@/types/domain'

interface Props {
  tickets: Ticket[]
  sort: TicketSortKey
  dir: SortDir
  onSort: (key: TicketSortKey) => void
  actor: { id: string; role: UserRole }
}

const SORT_OPTIONS: { key: TicketSortKey; label: string }[] = [
  { key: 'updated_at', label: 'Atualização' },
  { key: 'created_at', label: 'Abertura' },
  { key: 'number', label: 'Número' },
  { key: 'title', label: 'Título' },
  { key: 'priority', label: 'Prioridade' },
  { key: 'status', label: 'Status' },
]

function SortHeader({
  label,
  column,
  sort,
  dir,
  onSort,
  className = '',
}: {
  label: string
  column: TicketSortKey
  sort: TicketSortKey
  dir: SortDir
  onSort: (key: TicketSortKey) => void
  className?: string
}) {
  const active = sort === column
  const Icon = !active ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th scope="col" aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`-mx-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-left transition-colors hover:bg-surface-muted hover:text-fg ${active ? 'text-fg' : ''}`}
        aria-label={`Ordenar por ${label}`}
      >
        {label}
        <Icon className={`h-3.5 w-3.5 ${active ? 'text-brand-fg' : 'opacity-50'}`} aria-hidden="true" />
      </button>
    </th>
  )
}

function SortBar({ sort, dir, onSort }: Pick<Props, 'sort' | 'dir' | 'onSort'>) {
  return (
    <div className="flex items-center justify-end gap-2 border-b border-line px-4 py-2">
      <label htmlFor="ticket-sort" className="text-xs text-fg-muted">
        Ordenar por
      </label>
      <select
        id="ticket-sort"
        value={sort}
        onChange={(e) => {
          onSort(e.target.value as TicketSortKey)
        }}
        className="field-input !min-h-0 w-auto py-1 pl-2.5 text-xs"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn-ghost btn-icon"
        onClick={() => onSort(sort)}
        aria-label={dir === 'asc' ? 'Ordem crescente. Inverter ordem' : 'Ordem decrescente. Inverter ordem'}
      >
        {dir === 'asc' ? <ArrowUp className="h-4 w-4" aria-hidden="true" /> : <ArrowDown className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
  )
}

function ClaimButton({ ticket, actorId }: { ticket: Ticket; actorId: string }) {
  const update = useUpdateTicket(ticket.id)
  async function claim() {
    try {
      await update.mutateAsync({ assignee_id: actorId })
      toast.success(`Você assumiu o chamado ${ticket.code}.`)
    } catch (error) {
      toast.error(dbErrorMessage(error))
    }
  }
  return (
    <button type="button" className="btn-secondary btn-sm" onClick={claim} disabled={update.isPending}>
      <Hand className="h-3.5 w-3.5" aria-hidden="true" />
      Assumir
    </button>
  )
}

function Freshness({ ticket, align = 'left' }: { ticket: Ticket; align?: 'left' | 'right' }) {
  const idle = daysSince(ticket.updated_at)
  const stale = isActive(ticket) && idle >= STALE_DAYS
  return (
    <span className={`flex flex-col gap-0.5 ${align === 'right' ? 'items-end text-right' : ''}`} title={formatDateTime(ticket.updated_at)}>
      <span className="text-[0.8125rem] text-fg-muted">{formatRelative(ticket.updated_at)}</span>
      {stale && (
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-sand px-2 py-0.5 text-xs font-medium text-graphite-900 ring-1 ring-inset ring-sand-400/50">
          <Hourglass className="h-3 w-3" aria-hidden="true" />
          Parado há {idle} dias
        </span>
      )}
    </span>
  )
}

const CRITICAL_MARK = 'shadow-[inset_3px_0_0_0_rgb(220_38_38)]'

function Assignee({ ticket, actor }: { ticket: Ticket; actor: Props['actor'] }) {
  const name = ticket.assignee?.full_name
  return (
    <div className="flex items-center gap-2">
      <Avatar name={name} />
      {name ? <span className="truncate text-[0.8125rem] text-fg">{name}</span> : <span className="text-[0.8125rem] text-fg-muted">Sem responsável</span>}
      {canClaim(ticket, actor) && <ClaimButton ticket={ticket} actorId={actor.id} />}
    </div>
  )
}

export function TicketTable({ tickets, sort, dir, onSort, actor }: Props) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  if (!isDesktop) {
    return (
      <>
        <SortBar sort={sort} dir={dir} onSort={onSort} />
        <ul className="divide-y divide-line">
          {tickets.map((t) => (
            <li key={t.id} className={`space-y-2 px-4 py-3.5 ${t.priority === 'critical' && isActive(t) ? CRITICAL_MARK : ''}`}>
              <div className="flex items-center justify-between gap-3 text-xs text-fg-muted">
                <PriorityBadge priority={t.priority} />
                <span className="font-medium tabular-nums">{t.code}</span>
              </div>
              <Link to={`/chamados/${t.id}`} className="block text-[0.9375rem] font-medium leading-snug text-fg hover:text-brand-fg">
                {t.title}
              </Link>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
                <StatusBadge status={t.status} />
                <span>
                  {t.category?.name ?? 'Sem categoria'}
                  {actor.role !== 'requester' && ` · ${t.requester?.full_name ?? '—'}`}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3 pt-0.5">
                <Assignee ticket={t} actor={actor} />
                <Freshness ticket={t} align="right" />
              </div>
            </li>
          ))}
        </ul>
      </>
    )
  }

  const TH = 'whitespace-nowrap'
  return (
    <div>
      <SortBar sort={sort} dir={dir} onSort={onSort} />
      <table className="data-table">
        <caption className="sr-only">Lista de chamados</caption>
        <thead>
          <tr className="border-b border-line">
            <SortHeader label="Número" column="number" sort={sort} dir={dir} onSort={onSort} className={`${TH} hidden xl:table-cell`} />
            <SortHeader label="Título" column="title" sort={sort} dir={dir} onSort={onSort} />
            <SortHeader label="Status" column="status" sort={sort} dir={dir} onSort={onSort} className={TH} />
            <SortHeader label="Prioridade" column="priority" sort={sort} dir={dir} onSort={onSort} className={TH} />
            <th scope="col" className={TH}>Responsável</th>
            <SortHeader label="Abertura" column="created_at" sort={sort} dir={dir} onSort={onSort} className={`${TH} hidden xl:table-cell`} />
            <SortHeader label="Atualização" column="updated_at" sort={sort} dir={dir} onSort={onSort} className={TH} />
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => (
            <tr key={t.id} className={t.priority === 'critical' && isActive(t) ? CRITICAL_MARK : undefined}>
              <td className="hidden whitespace-nowrap text-[0.8125rem] font-medium tabular-nums text-fg-muted xl:table-cell">{t.code}</td>
              <td className="max-w-0 w-full">
                <Link to={`/chamados/${t.id}`} className="block truncate font-medium text-fg hover:text-brand-fg" title={t.title}>
                  {t.title}
                </Link>
                <span className="mt-0.5 block truncate text-xs text-fg-muted">
                  <span className="xl:hidden">{t.code} · </span>
                  {t.category?.name ?? 'Sem categoria'} · {t.requester?.full_name ?? '—'}
                </span>
              </td>
              <td className="whitespace-nowrap">
                <StatusBadge status={t.status} />
              </td>
              <td className="whitespace-nowrap">
                <PriorityBadge priority={t.priority} />
              </td>
              <td className="whitespace-nowrap">
                <Assignee ticket={t} actor={actor} />
              </td>
              <td className="hidden whitespace-nowrap text-[0.8125rem] text-fg-muted xl:table-cell">{formatDateTime(t.created_at)}</td>
              <td className="whitespace-nowrap">
                <Freshness ticket={t} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
