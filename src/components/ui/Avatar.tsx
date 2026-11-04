import { UserRound } from 'lucide-react'
import { cn } from '@/lib/cn'

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? '?'
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

export function Avatar({ name, size = 'sm', className }: { name?: string | null; size?: 'sm' | 'md'; className?: string }) {
  const box = size === 'sm' ? 'h-6 w-6 text-2xs' : 'h-8 w-8 text-xs'
  if (!name) {
    return (
      <span aria-hidden="true" className={cn('flex shrink-0 items-center justify-center rounded-full border border-dashed border-line-strong text-fg-subtle', box, className)}>
        <UserRound className="h-3 w-3" />
      </span>
    )
  }
  return (
    <span aria-hidden="true" className={cn('flex shrink-0 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand-fg', box, className)}>
      {initials(name)}
    </span>
  )
}
