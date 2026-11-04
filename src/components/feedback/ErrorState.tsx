import type { ReactNode } from 'react'
import { CircleAlert, RefreshCw } from 'lucide-react'

export function ErrorState({
  title = 'Algo deu errado',
  message = 'Não foi possível carregar as informações.',
  onRetry,
  action,
}: {
  title?: string
  message?: string
  onRetry?: () => void
  action?: ReactNode
}) {
  return (
    <div role="alert" className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"><CircleAlert className="h-6 w-6" /></span>
      <h2 className="text-base font-semibold text-fg">{title}</h2>
      <p className="max-w-md text-sm text-fg-muted">{message}</p>
      <div className="mt-1 flex flex-wrap justify-center gap-2">
        {onRetry && (
          <button type="button" className="btn-secondary" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Tentar novamente
          </button>
        )}
        {action}
      </div>
    </div>
  )
}
