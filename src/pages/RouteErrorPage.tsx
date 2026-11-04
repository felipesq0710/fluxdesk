import { useRouteError } from 'react-router-dom'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Logo } from '@/components/brand/Logo'

export default function RouteErrorPage() {
  const error = useRouteError()
  if (import.meta.env.DEV) console.error(error)

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface-muted p-6">
      <Logo />
      <div className="w-full max-w-md">
        <ErrorState
          title="Erro inesperado"
          message="Algo deu errado ao exibir esta página. Recarregue para tentar novamente."
          onRetry={() => window.location.reload()}
        />
      </div>
    </main>
  )
}
