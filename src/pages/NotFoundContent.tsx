import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'

export default function NotFoundContent() {
  return (
    <div className="card mx-auto mt-10 flex max-w-lg flex-col items-center gap-3 px-6 py-12 text-center">
      <Compass className="h-9 w-9 text-brand dark:text-brand-300" aria-hidden="true" />
      <h1 className="text-lg font-semibold text-fg">Página não encontrada</h1>
      <p className="text-sm text-fg-muted">O endereço acessado não existe ou foi movido.</p>
      <Link to="/" className="btn-primary mt-2">
        Ir para o início
      </Link>
    </div>
  )
}
