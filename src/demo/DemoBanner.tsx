import { DEMO_ROLE_KEY } from '@/demo/store'

const OPTIONS = [
  ['admin', 'Administrador'],
  ['technician', 'Técnico'],
  ['requester', 'Solicitante'],
  ['', 'Sair'],
] as const

export function DemoBanner() {
  let current = ''
  try {
    current = sessionStorage.getItem(DEMO_ROLE_KEY) ?? ''
  } catch {
    // sem armazenamento
  }
  function change(value: string) {
    try {
      if (value) sessionStorage.setItem(DEMO_ROLE_KEY, value)
      else sessionStorage.removeItem(DEMO_ROLE_KEY)
    } catch {
      // sem armazenamento
    }
    window.location.assign(value ? '/' : '/entrar')
  }
  // Nas telas de acesso o próprio formulário já oferece os perfis de demonstração.
  if (/^\/(entrar|cadastro|recuperar-senha|redefinir)/.test(window.location.pathname)) return null
  return (
    <div role="region" aria-label="Modo demonstração" className="relative z-10 flex items-center justify-between gap-3 bg-graphite-900 px-4 py-1.5 text-xs text-white lg:pl-[16rem] lg:pr-8">
      <span className="min-w-0 truncate font-medium">
        <span className="sm:hidden">Demo · dados fictícios</span>
        <span className="max-sm:hidden">Demonstração · dados fictícios, sem conexão com banco de dados</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <label htmlFor="demo-role" className="text-white/70">
          Ver como
        </label>
        <select id="demo-role" value={current} onChange={(e) => change(e.target.value)} className="rounded-md bg-white/10 px-2 py-1 text-xs text-white">
          {!current && <option value="">Visitante</option>}
          {OPTIONS.map(([v, label]) => (
            <option key={label} value={v} className="text-black">
              {label}
            </option>
          ))}
        </select>
      </span>
    </div>
  )
}
