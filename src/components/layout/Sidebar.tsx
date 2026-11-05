import { Link, NavLink } from 'react-router-dom'
import {
  Bell,
  BookOpen,
  ChartColumn,
  LayoutDashboard,
  ListTodo,
  Settings,
  Tags,
  Ticket,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { AccountMenu } from '@/components/layout/AccountMenu'
import { useUnreadCount } from '@/hooks/useNotifications'
import { cn } from '@/lib/cn'
import { navItemsFor, type NavKey } from '@/lib/permissions'
import type { UserRole } from '@/types/domain'

const ICONS: Record<NavKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  tickets: Ticket,
  queue: ListTodo,
  knowledge: BookOpen,
  notifications: Bell,
  reports: ChartColumn,
  users: Users,
  categories: Tags,
  settings: Settings,
}

const GROUPS: { label: string; items: NavKey[] }[] = [
  { label: 'Atendimento', items: ['dashboard', 'tickets', 'queue', 'notifications', 'knowledge'] },
  { label: 'Gestão', items: ['reports', 'users', 'categories'] },
  { label: 'Sistema', items: ['settings'] },
]

export function Sidebar({ role, onNavigate, showAccount = true }: { role: UserRole; onNavigate?: () => void; showAccount?: boolean }) {
  const items = navItemsFor(role)
  const unread = useUnreadCount().data ?? 0
  const groups = GROUPS.map((group) => ({
    ...group,
    items: group.items.map((key) => items.find((item) => item.key === key)).filter((item) => item !== undefined),
  })).filter((group) => group.items.length > 0)

  return (
    <div className="flex h-full flex-col bg-canvas text-fg-muted">
      <div className="flex min-h-[4.75rem] shrink-0 items-center border-b border-line px-5">
        <Link
          to="/"
          onClick={onNavigate}
          aria-label="Fluxdesk — ir para o início"
          className="rounded-control transition-opacity hover:opacity-80"
        >
          <Logo showSlogan />
        </Link>
      </div>

      <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto px-3 pb-5 pt-5">
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.label}>
              <h2 className="mb-2 px-3 text-xs font-medium leading-5 text-fg-subtle">{group.label}</h2>
              <ul className="space-y-1">
                {group.items.map((item) => {
                const Icon = ICONS[item.key]
                const count = item.key === 'notifications' ? unread : 0
                return (
                  <li key={item.key}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          'group relative flex min-h-10 items-center gap-3 rounded-control px-3 py-2 text-sm font-medium transition-colors duration-120',
                          isActive
                            ? 'bg-brand-soft text-fg'
                            : 'hover:bg-surface-muted hover:text-fg',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && <span aria-hidden="true" className="absolute left-0 top-2.5 h-5 w-0.5 rounded-full bg-brand-action" />}
                          <Icon className={cn('h-[1.0625rem] w-[1.0625rem] shrink-0 transition-colors', isActive ? 'text-brand-action' : 'text-fg-subtle group-hover:text-fg')} aria-hidden="true" />
                          <span className="truncate">{item.label}</span>
                          {count > 0 && (
                            <span
                              aria-hidden="true"
                              className="ml-auto flex h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-full bg-brand-action px-1 text-2xs font-semibold leading-none text-white"
                            >
                              {count > 99 ? '99+' : count}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                )
              })}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      {showAccount && <div className="shrink-0 border-t border-line p-3"><AccountMenu onNavigate={onNavigate} /></div>}
    </div>
  )
}
