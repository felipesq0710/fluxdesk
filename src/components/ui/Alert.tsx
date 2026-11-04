import type { ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'

type Variant = 'info' | 'success' | 'warning' | 'danger'

const STYLES: Record<Variant, { box: string; icon: typeof Info }> = {
  info: { box: 'border-brand/20 bg-brand-soft text-fg', icon: Info },
  success: { box: 'border-green-600/25 bg-green-50 text-fg dark:bg-green-500/10', icon: CircleCheck },
  warning: { box: 'border-sand-400/60 bg-sand-100 text-graphite-900 dark:border-sand/25 dark:bg-sand/10 dark:text-fg', icon: TriangleAlert },
  danger: { box: 'border-red-600/25 bg-red-50 text-fg dark:bg-red-500/10', icon: CircleAlert },
}

const ICON_COLOR: Record<Variant, string> = {
  info: 'text-brand-fg',
  success: 'text-green-700 dark:text-green-400',
  warning: 'text-sand-700 dark:text-sand',
  danger: 'text-red-700 dark:text-red-400',
}

export function Alert({
  variant = 'info',
  title,
  children,
  className,
}: {
  variant?: Variant
  title?: string
  children?: ReactNode
  className?: string
}) {
  const { box, icon: Icon } = STYLES[variant]
  return (
    <div
      role={variant === 'danger' || variant === 'warning' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-control border px-3.5 py-3 text-sm', box, className)}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', ICON_COLOR[variant])} aria-hidden="true" />
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5 opacity-80')}>{children}</div>}
      </div>
    </div>
  )
}
