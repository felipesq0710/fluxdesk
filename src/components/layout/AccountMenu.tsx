import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronsUpDown, LogOut, Moon, Settings, Sun } from 'lucide-react'
import { toast } from 'sonner'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuth, useProfile } from '@/hooks/useAuth'
import { ROLE_LABEL } from '@/lib/constants'
import { authErrorMessage } from '@/lib/errors'
import { Avatar } from '@/components/ui/Avatar'

const ITEM =
  'flex min-h-10 w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-sm text-fg transition-colors duration-120 hover:bg-surface-muted'

export function AccountMenu({ onNavigate, placement = 'above' }: { onNavigate?: () => void; placement?: 'above' | 'below' }) {
  const profile = useProfile()
  const { signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  async function handleSignOut() {
    setOpen(false)
    try {
      await signOut()
      navigate('/entrar', { replace: true })
    } catch (error) {
      toast.error(authErrorMessage(error))
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-control p-2 text-left transition-colors duration-120 hover:bg-surface-muted"
      >
        <Avatar name={profile.full_name} profileId={profile.id} size="md" />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[0.84375rem] font-medium text-fg">{profile.full_name}</span>
          <span className="block truncate text-xs text-fg-muted">{ROLE_LABEL[profile.role]}</span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-fg-subtle" aria-hidden="true" />
        <span className="sr-only">Menu da conta de {profile.full_name}</span>
      </button>

      {open && (
        <div className={placement === 'below'
          ? 'absolute right-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] animate-pop-in rounded-pop border border-line bg-surface-raised p-1.5 text-fg shadow-pop'
          : 'absolute inset-x-0 bottom-full z-30 mb-2 animate-pop-in rounded-pop border border-line bg-surface-raised p-1.5 text-fg shadow-pop'}>
          <div className="border-b border-line px-2.5 pb-2 pt-1.5">
            <p className="truncate text-sm font-medium text-fg">{profile.full_name}</p>
            <p className="truncate text-xs text-fg-muted">{profile.email}</p>
            <p className="mt-1.5 inline-block rounded-md bg-brand-soft px-1.5 py-0.5 text-xs font-medium text-brand-fg">{ROLE_LABEL[profile.role]}</p>
          </div>
          <div className="pt-1">
            <Link
              to="/configuracoes"
              onClick={() => {
                setOpen(false)
                onNavigate?.()
              }}
              className={ITEM}
            >
              <Settings className="h-4 w-4 text-fg-muted" aria-hidden="true" />
              Configurações
            </Link>
            <button type="button" onClick={toggleTheme} className={ITEM}>
              {theme === 'dark' ? <Sun className="h-4 w-4 text-fg-muted" aria-hidden="true" /> : <Moon className="h-4 w-4 text-fg-muted" aria-hidden="true" />}
              {theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
            </button>
            <button type="button" onClick={handleSignOut} className={`${ITEM} text-red-700 dark:text-red-400`}>
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sair
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
