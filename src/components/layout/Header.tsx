import { Link, useLocation } from 'react-router-dom'
import { Bell, ChevronRight, Menu } from 'lucide-react'
import { LogoMark } from '@/components/brand/Logo'
import { AccountMenu } from '@/components/layout/AccountMenu'
import { useUnreadCount } from '@/hooks/useNotifications'
import { useProfile } from '@/hooks/useAuth'
import { navItemsFor, type NavKey } from '@/lib/permissions'

const SECTION_LABELS: Record<NavKey, string> = {
  dashboard: 'Atendimento',
  tickets: 'Atendimento',
  queue: 'Atendimento',
  notifications: 'Atendimento',
  knowledge: 'Atendimento',
  reports: 'Gestão',
  users: 'Gestão',
  categories: 'Gestão',
  settings: 'Sistema',
}

export function Header({ onOpenMenu }: { onOpenMenu: () => void }) {
  const unread = useUnreadCount().data ?? 0
  const { pathname } = useLocation()
  const profile = useProfile()
  const currentPage = navItemsFor(profile.role).find((item) =>
    item.to === '/' ? pathname === '/' : pathname === item.to || pathname.startsWith(`${item.to}/`),
  )

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas">
      <div className="flex h-14 items-center gap-3 px-3 sm:px-5 lg:hidden">
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
          {unread > 0 && <NotificationCount count={unread} />}
        </Link>
      </div>

      <div className="hidden h-14 items-center justify-between px-6 lg:flex 2xl:px-8">
        <div role="group" aria-label="Localização atual" className="flex min-w-0 items-center gap-2 text-sm">
          <span className="truncate text-fg-subtle">{currentPage ? SECTION_LABELS[currentPage.key] : 'Fluxdesk'}</span>
          {currentPage && (
            <>
              <ChevronRight className="h-4 w-4 shrink-0 text-fg-subtle" aria-hidden="true" />
              <span className="truncate font-medium text-fg">{currentPage.label}</span>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="ml-1 border-l border-line pl-3">
            <AccountMenu placement="below" />
          </div>
        </div>
      </div>
    </header>
  )
}

function NotificationCount({ count }: { count: number }) {
  return (
    <span aria-hidden="true" className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-action px-1 text-[0.625rem] font-semibold leading-none text-white">
      {count > 99 ? '99+' : count}
    </span>
  )
}
