import { TriangleAlert } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'

// Exibida quando as variáveis de ambiente do Supabase não foram configuradas.
export function ConfigMissing({ problems }: { problems: string[] }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <section className="card-padded w-full max-w-lg !p-8" aria-labelledby="config-title">
        <Logo className="mb-6" />
        <div className="mb-4 flex items-center gap-2 text-sand-700 dark:text-sand">
          <TriangleAlert className="h-5 w-5" aria-hidden="true" />
          <h1 id="config-title" className="text-lg font-semibold text-fg">
            Configuração do Supabase pendente
          </h1>
        </div>
        <p className="mb-3 text-sm text-fg-muted">
          O Fluxdesk não encontrou as variáveis de ambiente necessárias para se conectar ao Supabase.
        </p>
        <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-fg">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p className="text-sm text-fg-muted">
          Copie <code className="rounded bg-surface-muted px-1 py-0.5">.env.example</code> para{' '}
          <code className="rounded bg-surface-muted px-1 py-0.5">.env.local</code>, preencha com a URL e a chave
          anon do seu projeto e reinicie o servidor de desenvolvimento. Consulte o README para o passo a passo.
        </p>
      </section>
    </main>
  )
}
