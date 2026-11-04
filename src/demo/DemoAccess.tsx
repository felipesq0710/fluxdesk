import { ShieldCheck, UserRound, Wrench } from 'lucide-react'
import type { DemoAccessProps } from '@/components/auth/DemoAccess'
import { DEMO_PASSWORD } from '@/demo/store'

const PROFILES = [
  { email: 'admin@demo.fluxdesk', label: 'Administrador', hint: 'Usuários, categorias, relatórios e configurações', icon: ShieldCheck },
  { email: 'tecnico@demo.fluxdesk', label: 'Técnico', hint: 'Fila de atendimento e notas internas', icon: Wrench },
  { email: 'solicitante@demo.fluxdesk', label: 'Solicitante', hint: 'Abre e acompanha os próprios chamados', icon: UserRound },
] as const

// Acesso de teste da demonstração: credenciais fictícias, válidas apenas neste modo e sem conexão com o Supabase.
// Fica abaixo do formulário, separado por um divisor, para não competir com o login.
export function DemoAccess({ onPick }: DemoAccessProps) {
  return (
    <section aria-labelledby="demo-access-title" className="mt-8">
      <div className="flex items-center gap-3 text-xs text-fg-muted">
        <span aria-hidden="true" className="h-px flex-1 bg-line" />
        <h2 id="demo-access-title" className="font-sans text-xs font-medium">
          Ou explore a demonstração
        </h2>
        <span aria-hidden="true" className="h-px flex-1 bg-line" />
      </div>
      <p className="mt-3 text-center text-xs text-fg-muted">
        Dados fictícios. Senha de todos os perfis: <code className="rounded bg-surface-muted px-1 py-0.5 font-mono text-fg">{DEMO_PASSWORD}</code>
      </p>
      <ul className="mt-3 space-y-1.5">
        {PROFILES.map(({ email, label, hint, icon: Icon }) => (
          <li key={email}>
            <button
              type="button"
              onClick={() => onPick(email, DEMO_PASSWORD)}
              className="flex w-full items-start gap-3 rounded-control border border-line px-3 py-2.5 text-left transition-colors hover:border-line-strong hover:bg-surface-muted"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-fg-muted" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-fg">Entrar como {label.toLowerCase()}</span>
                <span className="block text-xs text-fg-muted">{hint}</span>
                <span className="block break-all text-xs text-fg-subtle">{email}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
