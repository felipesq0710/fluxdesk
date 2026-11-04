import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-muted p-6">
      <section className="card w-full max-w-md p-8 text-center" aria-labelledby="notfound-title">
        <Logo className="mb-6 justify-center" />
        <Compass className="mx-auto mb-3 h-9 w-9 text-brand dark:text-brand-300" aria-hidden="true" />
        <h1 id="notfound-title" className="text-lg font-semibold text-fg">
          Página não encontrada
        </h1>
        <p className="mt-2 text-sm text-fg-muted">O endereço acessado não existe ou foi movido.</p>
        <Link to="/" className="btn-primary mt-6">
          Ir para o início
        </Link>
      </section>
    </main>
  )
}
