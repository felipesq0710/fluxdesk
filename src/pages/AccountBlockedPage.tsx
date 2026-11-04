import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserX } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { useAuth } from '@/hooks/useAuth'

// Conta desativada ou sem perfil: o acesso aos dados é bloqueado pelo banco.
export default function AccountBlockedPage({ inactive }: { inactive: boolean }) {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  async function handleSignOut() {
    setBusy(true)
    try {
      await signOut()
    } finally {
      navigate('/entrar', { replace: true })
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-muted p-6">
      <section className="card w-full max-w-md p-8 text-center" aria-labelledby="blocked-title">
        <Logo className="mb-6 justify-center" />
        <UserX className="mx-auto mb-3 h-9 w-9 text-warning" aria-hidden="true" />
        <h1 id="blocked-title" className="text-lg font-semibold text-fg">
          {inactive ? 'Conta desativada' : 'Perfil não encontrado'}
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          {inactive
            ? 'Seu acesso ao Fluxdesk foi desativado. Entre em contato com um administrador para reativá-lo.'
            : 'Não encontramos o perfil associado à sua conta. Tente entrar novamente ou contate um administrador.'}
        </p>
        <button type="button" className="btn-primary mt-6" onClick={handleSignOut} disabled={busy}>
          Sair
        </button>
      </section>
    </main>
  )
}
