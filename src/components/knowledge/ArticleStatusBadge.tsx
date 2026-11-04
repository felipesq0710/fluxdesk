import { cn } from '@/lib/cn'
import { ARTICLE_STATUS_LABEL } from '@/lib/articleRules'
import type { ArticleStatus } from '@/types/domain'

export function ArticleStatusBadge({ status }: { status: ArticleStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        status === 'published' ? 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
      )}
    >
      {ARTICLE_STATUS_LABEL[status]}
    </span>
  )
}
