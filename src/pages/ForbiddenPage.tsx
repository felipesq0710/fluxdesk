import { Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'

export default function ForbiddenPage() {
  return (
    <div className="card mx-auto mt-10 flex max-w-lg flex-col items-center gap-3 px-6 py-12 text-center">
      <ShieldAlert className="h-9 w-9 text-warning" aria-hidden="true" />
      <h1 className="text-lg font-semibold text-fg">Acesso não autorizado</h1>
      <p className="text-sm text-fg-muted">
        Seu perfil não tem permissão para acessar esta área. Se você acredita que isso é um engano, fale com um
        administrador.
      </p>
      <Link to="/" className="btn-primary mt-2">
        Voltar ao início
      </Link>
    </div>
  )
}
