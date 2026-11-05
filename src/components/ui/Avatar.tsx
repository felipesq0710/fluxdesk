import { UserRound } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/cn'
import { useProfileAvatar } from '@/hooks/useProfileAvatar'

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? '?'
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

export function Avatar({ name, profileId, imageUrl, size = 'sm', className }: { name?: string | null; profileId?: string; imageUrl?: string | null; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const avatarQuery = useProfileAvatar(imageUrl === undefined ? profileId : undefined)
  const url = imageUrl === undefined ? avatarQuery.data : imageUrl
  const box = size === 'sm' ? 'h-6 w-6 text-2xs' : size === 'md' ? 'h-8 w-8 text-xs' : 'h-16 w-16 text-xl'
  if (url && failedUrl !== url) {
    return <img src={url} alt="" aria-hidden="true" onError={() => setFailedUrl(url)} className={cn('shrink-0 rounded-full border border-line object-cover', box, className)} />
  }
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
