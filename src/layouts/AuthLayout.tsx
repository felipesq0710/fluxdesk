import type { ReactNode } from 'react'
import { BRAND_SLOGAN, Logo } from '@/components/brand/Logo'

function FlowIllustration() {
  const stages = [
    { x: 40, label: 'Aberto', fill: 'none', stroke: '#8CA6FF' },
    { x: 210, label: 'Em andamento', fill: '#5B7CFF', stroke: '#5B7CFF' },
    { x: 380, label: 'Resolvido', fill: '#FFD8B8', stroke: '#FFD8B8' },
  ]
  return (
    <svg viewBox="0 0 460 150" role="img" aria-label="Fluxo de um chamado: aberto, em andamento e resolvido" className="w-full max-w-md">
      <path d="M52 62 C 120 62, 130 62, 210 62" stroke="#3A4150" strokeWidth="2" fill="none" />
      <path d="M210 62 C 290 62, 300 62, 380 62" stroke="#3A4150" strokeWidth="2" fill="none" />
      <path d="M52 62 C 120 62, 130 62, 210 62" stroke="url(#flow-a)" strokeWidth="2.5" strokeLinecap="round" fill="none" strokeDasharray="4 8" />
      <path d="M210 62 C 290 62, 300 62, 380 62" stroke="url(#flow-b)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <defs>
        <linearGradient id="flow-a" x1="0" x2="1">
          <stop offset="0" stopColor="#8CA6FF" />
          <stop offset="1" stopColor="#5B7CFF" />
        </linearGradient>
        <linearGradient id="flow-b" x1="0" x2="1">
          <stop offset="0" stopColor="#5B7CFF" />
          <stop offset="1" stopColor="#FFD8B8" />
        </linearGradient>
      </defs>
      {stages.map((s) => (
        <g key={s.label}>
          <circle cx={s.x + 12} cy={62} r={12} fill="#14161B" />
          <circle cx={s.x + 12} cy={62} r={9} fill={s.fill} stroke={s.stroke} strokeWidth="2.5" />
          <text x={s.x + 12} y={100} textAnchor="middle" fontSize="13" fontWeight="500" fill="#B4BAC6">
            {s.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

export default function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="grid min-h-screen bg-surface lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-graphite-900 p-12 text-white lg:flex xl:p-16">
        <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand/30 blur-3xl" />
        <Logo inverse className="relative" />
        <div className="relative">
          <h2 className="max-w-md font-display text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.03em]" style={{ fontVariationSettings: "'opsz' 72" }}>
            {BRAND_SLOGAN}
          </h2>
          <p className="mt-4 max-w-sm text-[0.9375rem] leading-relaxed text-graphite-300">
            Receba, distribua e acompanhe solicitações de suporte em um só lugar, com histórico completo e notas internas que o solicitante nunca vê.
          </p>
          <div className="mt-10">
            <FlowIllustration />
          </div>
        </div>
        <p className="relative text-xs text-graphite-400">Fluxdesk — Help Desk e gerenciamento de chamados</p>
      </aside>

      <main className="flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-[24rem]">
          <Logo className="mb-10 lg:hidden" />
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-fg-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 border-t border-line pt-6 text-center text-sm text-fg-muted">{footer}</div>}
        </div>
      </main>
    </div>
  )
}
