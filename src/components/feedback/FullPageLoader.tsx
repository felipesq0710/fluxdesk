import { Logo } from '@/components/brand/Logo'
import { Spinner } from '@/components/ui/Spinner'

export function FullPageLoader({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas">
      <Logo />
      <div className="flex items-center gap-2 text-sm text-fg-muted">
        <Spinner />
        <span>{label}</span>
      </div>
    </div>
  )
}
