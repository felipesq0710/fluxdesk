import { cn } from '@/lib/cn'

export const BRAND_NAME = 'Fluxdesk'
export const BRAND_SLOGAN = 'Suporte organizado. Fluxo eficiente.'

// Símbolo: um "F" feito de linhas de fluxo. O braço superior é o chamado que entra,
// o do meio é o que está em atendimento e o ponto em pêssego é o chamado resolvido.
export function LogoMark({ className, inverse = false }: { className?: string; inverse?: boolean }) {
  const tile = inverse ? '#FFFFFF' : '#0038FF'
  const stroke = inverse ? '#0038FF' : '#FFFFFF'
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('h-8 w-8 shrink-0', className)}>
      <rect width="32" height="32" rx="9" fill={tile} />
      <path d="M10.5 24V9.5a1 1 0 0 1 1-1H23" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M10.5 16H18" stroke={stroke} strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="21.75" cy="22.25" r="3" fill="#FFD8B8" />
    </svg>
  )
}

export function Logo({
  className,
  showSlogan = false,
  inverse = false,
}: {
  className?: string
  showSlogan?: boolean
  inverse?: boolean
}) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoMark className="h-8 w-8" />
      <div className="leading-tight">
        <span
          className={cn('block font-display text-[1.1875rem] font-semibold tracking-tight', inverse ? 'text-white' : 'text-fg')}
          style={{ fontVariationSettings: "'opsz' 24" }}
        >
          {BRAND_NAME}
        </span>
        {showSlogan && <span className={cn('block text-xs', inverse ? 'text-graphite-300' : 'text-fg-muted')}>{BRAND_SLOGAN}</span>}
      </div>
    </div>
  )
}
