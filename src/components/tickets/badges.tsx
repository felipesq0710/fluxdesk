import { cn } from '@/lib/cn'
import { PRIORITY_LABEL, STATUS_LABEL } from '@/lib/ticketLabels'
import type { TicketPriority, TicketStatus } from '@/types/domain'

// Status e prioridade têm linguagens visuais distintas para serem lidos de relance:
// - status  = glifo de círculo (o formato indica o estágio do fluxo);
// - prioridade = barras ascendentes (quantas barras acesas indicam a urgência).
// Nenhum dos dois depende apenas de cor.

const PILL = 'rounded-full bg-surface-muted px-2.5 py-1 ring-1 ring-inset ring-line'

export function StatusGlyph({ status }: { status: TicketStatus }) {
  const common = { viewBox: '0 0 16 16', className: 'h-4 w-4 shrink-0', 'aria-hidden': true as const }
  switch (status) {
    case 'open':
      return (
        <svg {...common} className={cn(common.className, 'text-brand-fg')}>
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      )
    case 'in_progress':
      return (
        <svg {...common} className={cn(common.className, 'text-brand-fg')}>
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 3.5a4.5 4.5 0 0 1 0 9z" fill="currentColor" />
        </svg>
      )
    case 'waiting_requester':
      return (
        <svg {...common} className={cn(common.className, 'text-amber-600 dark:text-amber-400')}>
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 4.75V8l2.1 1.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'waiting_third_party':
      return (
        <svg {...common} className={cn(common.className, 'text-fg-subtle')}>
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.6 2" />
          <circle cx="8" cy="8" r="1.6" fill="currentColor" />
        </svg>
      )
    case 'resolved':
      return (
        <svg {...common} className={cn(common.className, 'text-green-600 dark:text-green-400')}>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path d="m5 8.2 2.2 2.2L11 6.4" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="dark:stroke-graphite-900" />
        </svg>
      )
    case 'closed':
      return (
        <svg {...common} className={cn(common.className, 'text-fg-subtle')}>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path d="m5.4 8 1.9 1.9L10.7 6.5" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="dark:stroke-graphite-900" />
        </svg>
      )
  }
}

export function StatusBadge({ status, pill = false, className }: { status: TicketStatus; pill?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-[0.8125rem] font-medium text-fg', pill && PILL, className)}>
      <StatusGlyph status={status} />
      {STATUS_LABEL[status]}
    </span>
  )
}

const PRIORITY_LEVEL: Record<TicketPriority, number> = { low: 1, medium: 2, high: 3, critical: 4 }
const PRIORITY_TONE: Record<TicketPriority, string> = {
  low: 'text-fg-subtle',
  medium: 'text-fg-muted',
  high: 'text-amber-600 dark:text-amber-400',
  critical: 'text-red-600 dark:text-red-400',
}

export function PriorityBars({ priority }: { priority: TicketPriority }) {
  const level = PRIORITY_LEVEL[priority]
  const heights = [5, 8, 11, 14]
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={cn('h-4 w-4 shrink-0', PRIORITY_TONE[priority])}>
      {heights.map((h, i) => (
        <rect key={i} x={1 + i * 4} y={15 - h} width="2.6" height={h} rx="1" fill="currentColor" opacity={i < level ? 1 : 0.22} />
      ))}
    </svg>
  )
}

export function PriorityBadge({ priority, pill = false, className }: { priority: TicketPriority; pill?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap text-[0.8125rem] font-medium',
        priority === 'critical' ? 'text-red-700 dark:text-red-400' : 'text-fg',
        pill && PILL,
        className,
      )}
    >
      <PriorityBars priority={priority} />
      {PRIORITY_LABEL[priority]}
    </span>
  )
}
