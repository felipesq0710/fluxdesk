import { Lock, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/cn'
import { ROLE_LABEL } from '@/lib/constants'
import { formatDateTime } from '@/lib/format'
import type { TicketComment } from '@/types/domain'

export function CommentThread({ comments, currentUserId }: { comments: TicketComment[]; currentUserId: string }) {
  if (comments.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-fg-muted">
        <MessageSquare className="h-6 w-6" aria-hidden="true" />
        Nenhuma mensagem ainda.
      </div>
    )
  }

  return (
    <ol className="space-y-4" aria-label="Conversa do atendimento">
      {comments.map((c) => {
        const internal = c.kind === 'internal'
        const mine = c.author_id === currentUserId
        const staff = c.author ? c.author.role !== 'requester' : false
        return (
          <li
            key={c.id}
            data-side={internal ? 'internal' : staff ? 'staff' : 'requester'}
            className={cn(
              'min-w-0 rounded-card border px-4 py-3.5',
              internal &&
                'border-dashed border-sand-400/70 bg-sand-100 dark:border-sand-400/35 dark:bg-sand-400/10',
              !internal &&
                staff &&
                'border-line bg-gradient-to-br from-brand-soft/60 to-surface sm:ml-10 dark:from-brand-soft/45 dark:to-surface',
              !internal &&
                !staff &&
                'border-line bg-gradient-to-br from-surface-muted/70 to-surface sm:mr-10 dark:from-surface-muted dark:to-surface',
            )}
          >
            <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
              <span className="font-medium text-fg">
                {c.author?.full_name ?? 'Usuário removido'}
                {mine && <span className="ml-1 font-normal text-fg-muted">(você)</span>}
              </span>
              {c.author && (
                <span className="text-xs text-fg-muted">
                  {ROLE_LABEL[c.author.role]}
                  {staff && !internal ? ' · resposta da equipe' : ''}
                </span>
              )}
              {internal && (
                <span className="inline-flex items-center gap-1 rounded-full bg-sand px-2 py-0.5 text-xs font-medium text-graphite-900">
                  <Lock className="h-3 w-3" aria-hidden="true" />
                  Nota interna · visível apenas à equipe
                </span>
              )}
              <time dateTime={c.created_at} className="ml-auto whitespace-nowrap text-xs text-fg-muted">
                {formatDateTime(c.created_at)}
              </time>
            </div>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-fg [overflow-wrap:anywhere]">{c.body}</p>
          </li>
        )
      })}
    </ol>
  )
}
