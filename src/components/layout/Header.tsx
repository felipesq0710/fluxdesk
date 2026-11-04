import { Link } from 'react-router-dom'
import { Bell, Menu } from 'lucide-react'
import { LogoMark } from '@/components/brand/Logo'
import { useUnreadCount } from '@/hooks/useNotifications'

export function Header({ onOpenMenu }: { onOpenMenu: () => void }) {
  const unread = useUnreadCount().data ?? 0
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-canvas/85 px-3 backdrop-blur-md sm:px-5 lg:hidden">
      <button type="button" onClick={onOpenMenu} className="btn-ghost btn-icon" aria-label="Abrir menu de navegação">
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>
      <Link to="/" className="flex items-center gap-2 rounded-control" aria-label="Fluxdesk — ir para o início">
        <LogoMark className="h-7 w-7" />
        <span className="font-display text-lg font-semibold tracking-tight text-fg">Fluxdesk</span>
      </Link>

      <Link
        to="/notificacoes"
        className="btn-ghost btn-icon relative ml-auto"
        aria-label={unread > 0 ? `Notificações, ${unread} não lida${unread > 1 ? 's' : ''}` : 'Notificações'}
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unread > 0 && (
          <span aria-hidden="true" className="absolute right-0.5 top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand px-1 text-2xs font-bold leading-none text-white dark:bg-sand dark:text-graphite-900">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Link>
    </header>
  )
}
