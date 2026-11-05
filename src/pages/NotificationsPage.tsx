import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, BellOff, CheckCheck, CircleCheck, Lock, MessageSquare, RefreshCw, UserCheck, HelpCircle, Ticket } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Pagination } from '@/components/ui/Pagination'
import { Spinner } from '@/components/ui/Spinner'
import { useMarkAllRead, useMarkRead, useNotifications } from '@/hooks/useNotifications'
import { cn } from '@/lib/cn'
import { dbErrorMessage } from '@/lib/errors'
import { formatRelative, formatDateTime } from '@/lib/format'
import { NOTIFICATIONS_PAGE_SIZE } from '@/services/notifications'
import type { AppNotification, NotificationType } from '@/types/domain'
import type { LucideIcon } from 'lucide-react'

const ICONS: Record<NotificationType, LucideIcon> = {
  ticket_created: Ticket,
  ticket_assigned: UserCheck,
  status_changed: RefreshCw,
  comment_added: MessageSquare,
  info_requested: HelpCircle,
  ticket_resolved: CircleCheck,
  ticket_closed: Lock,
}

const ICON_TONES: Record<NotificationType, string> = {
  ticket_created: 'text-brand-fg',
  ticket_assigned: 'text-info-ink',
  status_changed: 'text-brand-fg',
  comment_added: 'text-fg-muted',
  info_requested: 'text-warning-ink',
  ticket_resolved: 'text-success-ink',
  ticket_closed: 'text-fg-subtle',
}

interface NotificationGroup {
  key: string
  label: string
  items: AppNotification[]
}

function localDayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` // taste-skill-ignore: zero padding keeps local date grouping keys stable.
}

function groupByDate(items: AppNotification[]): NotificationGroup[] {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const groups = new Map<string, NotificationGroup>()

  for (const item of items) {
    const date = new Date(item.created_at)
    const key = localDayKey(date)
    const label = key === localDayKey(today)
      ? 'Hoje'
      : key === localDayKey(yesterday)
        ? 'Ontem'
        : new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date)
    const group = groups.get(key) ?? { key, label: label.charAt(0).toLocaleUpperCase('pt-BR') + label.slice(1), items: [] }
    group.items.push(item)
    groups.set(key, group)
  }

  return [...groups.values()]
}

function ticketCode(notification: AppNotification) {
  const text = `${notification.title} ${notification.body ?? ''}`
  return text.match(/\bFLX-\d+\b/i)?.[0] ?? null
}

function Item({ n, onOpen }: { n: AppNotification; onOpen: (n: AppNotification) => void }) {
  const Icon = ICONS[n.type]
  const code = ticketCode(n)
  const content = (
    <>
      <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center', ICON_TONES[n.type])}>
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className={cn('block text-[0.9375rem] leading-5 text-fg', !n.is_read && 'font-semibold')}>
          {!n.is_read && <span className="sr-only">Não lida: </span>}
          {n.title}
        </span>
        {n.body && <span className="mt-1 block text-sm leading-5 text-fg-muted">{n.body}</span>}
        {code && <span className="mt-2 inline-flex rounded-md bg-surface-muted px-2 py-0.5 text-xs font-medium tabular-nums text-brand-fg">{code}</span>}
      </span>
      <span className="col-start-2 row-start-2 flex items-center justify-between gap-3 sm:col-start-3 sm:row-start-1 sm:items-start sm:justify-end">
        <time dateTime={n.created_at} title={formatDateTime(n.created_at)} className="text-xs tabular-nums text-fg-muted">
          {formatRelative(n.created_at)}
        </time>
        {!n.is_read && <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-brand" />}
      </span>
    </>
  )
  const cls = cn(
    'grid w-full grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 gap-y-2 px-4 py-4 text-left transition-colors hover:bg-surface-muted focus-visible:z-10 sm:grid-cols-[1.25rem_minmax(0,1fr)_auto] sm:gap-x-4 sm:px-5 sm:py-4',
    !n.is_read && 'border-l-[3px] border-brand bg-brand-soft/55 hover:bg-brand-soft/80',
  )
  return n.ticket_id ? (
    <Link to={`/chamados/${n.ticket_id}`} onClick={() => onOpen(n)} className={cls}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={() => onOpen(n)} className={cls}>
      {content}
    </button>
  )
}

export default function NotificationsPage() {
  const [page, setPage] = useState(1)
  const [onlyUnread, setOnlyUnread] = useState(false)
  const list = useNotifications(page, onlyUnread)
  const markRead = useMarkRead()
  const markAll = useMarkAllRead()

  function open(n: AppNotification) {
    if (!n.is_read) markRead.mutate(n.id, { onError: (e) => toast.error(dbErrorMessage(e)) })
  }

  async function readAll() {
    try {
      await markAll.mutateAsync()
      toast.success('Todas as notificações foram marcadas como lidas.')
    } catch (error) {
      toast.error(dbErrorMessage(error))
    }
  }

  const data = list.data
  const hasUnread = data?.items.some((n) => !n.is_read) ?? false

  return (
    <div className="space-y-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Notificações</h1>
          <p className="page-lead">Acompanhe o que aconteceu nos seus chamados.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => void readAll()} disabled={markAll.isPending || (!hasUnread && !onlyUnread)}>
          {markAll.isPending ? <Spinner /> : <CheckCheck className="h-4 w-4" aria-hidden="true" />}
          Marcar todas como lidas
        </button>
      </div>

      <div className="card overflow-hidden" aria-busy={list.isFetching}>
        <div role="group" aria-label="Filtro de notificações" className="flex flex-wrap gap-2 border-b border-line p-3 sm:px-5">
          {[
            { label: 'Todas', value: false },
            { label: 'Não lidas', value: true },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              aria-pressed={onlyUnread === opt.value}
              onClick={() => {
                setOnlyUnread(opt.value)
                setPage(1)
              }}
              className={cn('btn !min-h-0 px-3 py-1.5', onlyUnread === opt.value ? 'bg-brand text-white' : 'btn-ghost')}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {list.isPending && (
          <div role="status" className="flex items-center gap-2 p-6 text-sm text-fg-muted">
            <Spinner /> Carregando notificações…
          </div>
        )}
        {list.isError && !data && (
          <div className="p-4">
            <ErrorState title="Não foi possível carregar as notificações" message={dbErrorMessage(list.error)} onRetry={() => void list.refetch()} />
          </div>
        )}
        {data && data.total === 0 && (
          <EmptyState
            icon={onlyUnread ? BellOff : Bell}
            title={onlyUnread ? 'Nenhuma notificação não lida' : 'Nenhuma notificação ainda'}
            description={onlyUnread ? 'Você está em dia com tudo.' : 'Avisos sobre seus chamados aparecerão aqui.'}
          />
        )}
        {data && data.total > 0 && (
          <>
            <div className="space-y-5 p-3 sm:p-5">
              {groupByDate(data.items).map((group) => (
                <section key={group.key} aria-labelledby={`notification-date-${group.key}`}>
                  <h2 id={`notification-date-${group.key}`} className="mb-2 px-1 text-sm font-semibold text-fg-muted">{group.label}</h2>
                  <ul className="divide-y divide-line overflow-hidden rounded-control border border-line bg-surface-raised">
                    {group.items.map((n) => (
                      <li key={n.id}>
                        <Item n={n} onOpen={open} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            <div className="border-t border-line [&_button:disabled]:text-fg-muted [&_button:disabled]:opacity-100">
              <Pagination page={data.page} pageSize={NOTIFICATIONS_PAGE_SIZE} total={data.total} onPageChange={setPage} disabled={list.isFetching} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
