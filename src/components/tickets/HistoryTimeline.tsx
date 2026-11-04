import { History } from 'lucide-react'
import { formatDateTime } from '@/lib/format'
import { describeHistoryEvent } from '@/lib/ticketLabels'
import type { TicketHistoryEvent } from '@/types/domain'

export function HistoryTimeline({ events }: { events: TicketHistoryEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-fg-muted">
        <History className="h-6 w-6" aria-hidden="true" />
        Nenhum evento registrado.
      </div>
    )
  }

  return (
    <ol className="relative space-y-4 border-l border-line pl-5" aria-label="Histórico de alterações">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span aria-hidden="true" className="absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-fg ring-4 ring-surface" />
          <p className="text-sm text-fg">{describeHistoryEvent(e)}</p>
          <p className="text-xs text-fg-muted">
            {e.actor?.full_name ?? 'Sistema'} ·{' '}
            <time dateTime={e.created_at}>{formatDateTime(e.created_at)}</time>
          </p>
        </li>
      ))}
    </ol>
  )
}
