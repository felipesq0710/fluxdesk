import type { ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'

type Variant = 'info' | 'success' | 'warning' | 'danger'

const STYLES: Record<Variant, { box: string; icon: typeof Info }> = {
  info: { box: 'border-info/25 bg-info-soft text-fg', icon: Info },
  success: { box: 'border-success/25 bg-success-soft text-fg', icon: CircleCheck },
  warning: { box: 'border-warning/25 bg-warning-soft text-fg', icon: TriangleAlert },
  danger: { box: 'border-danger/25 bg-danger-soft text-fg', icon: CircleAlert },
}

const ICON_COLOR: Record<Variant, string> = {
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
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
        {children && <div className={cn(title && 'mt-0.5')}>{children}</div>}
      </div>
    </div>
  )
}
