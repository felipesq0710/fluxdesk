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

function Item({ n, onOpen }: { n: AppNotification; onOpen: (n: AppNotification) => void }) {
  const Icon = ICONS[n.type]
  const content = (
    <>
      <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', n.is_read ? 'bg-surface-muted text-fg-muted' : 'bg-brand/10 text-brand dark:text-brand-300')}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm text-fg', !n.is_read && 'font-semibold')}>
          {!n.is_read && <span className="sr-only">Não lida: </span>}
          {n.title}
        </span>
        {n.body && <span className="mt-0.5 block text-sm text-fg-muted">{n.body}</span>}
        <time dateTime={n.created_at} title={formatDateTime(n.created_at)} className="mt-1 block text-xs text-fg-muted">
          {formatRelative(n.created_at)}
        </time>
      </span>
      {!n.is_read && <span aria-hidden="true" className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-brand" />}
    </>
  )
  const cls = 'flex w-full items-start gap-3 p-4 text-left hover:bg-surface-muted'
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
    <div className="max-w-5xl">
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
        <div role="group" aria-label="Filtro de notificações" className="flex gap-2 border-b border-line p-3">
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
              className={cn('btn !min-h-0 px-3 py-1.5', onlyUnread === opt.value ? 'bg-brand text-white' : 'btn-secondary')}
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
            <ul className="divide-y divide-line" aria-label="Notificações">
              {data.items.map((n) => (
                <li key={n.id}>
                  <Item n={n} onOpen={open} />
                </li>
              ))}
            </ul>
            <div className="border-t border-line">
              <Pagination page={data.page} pageSize={NOTIFICATIONS_PAGE_SIZE} total={data.total} onPageChange={setPage} disabled={list.isFetching} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
