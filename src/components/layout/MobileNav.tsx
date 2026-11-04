import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import { Sidebar } from '@/components/layout/Sidebar'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import type { UserRole } from '@/types/domain'

export function MobileNav({ open, onClose, role }: { open: boolean; onClose: () => void; role: UserRole }) {
  const panelRef = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()

  useFocusTrap(open, panelRef, onClose)

  useEffect(() => {
    onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Impede a rolagem do fundo enquanto o menu está aberto.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <div className="absolute inset-0 animate-fade-in bg-graphite-950/60 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navegação"
        className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] animate-slide-in flex-col shadow-pop"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar menu"
          className="btn-icon absolute right-3 top-3.5 z-10 rounded-control text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg dark:hover:bg-white/10 dark:hover:text-white"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        <Sidebar role={role} onNavigate={onClose} />
      </div>
    </div>
  )
}
