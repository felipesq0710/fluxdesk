import { Fragment } from 'react'
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

const GROUPS: NavKey[][] = [
  ['dashboard', 'tickets', 'queue', 'notifications', 'knowledge'],
  ['reports', 'users', 'categories'],
  ['settings'],
]

export function Sidebar({ role, onNavigate }: { role: UserRole; onNavigate?: () => void }) {
  const items = navItemsFor(role)
  const unread = useUnreadCount().data ?? 0
  const groups = GROUPS.map((keys) => keys.map((k) => items.find((i) => i.key === k)).filter((i) => i !== undefined)).filter((g) => g.length > 0)

  return (
    <div className="flex h-full flex-col bg-surface text-fg-muted dark:bg-graphite-950 dark:text-graphite-300">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Link
          to="/"
          onClick={onNavigate}
          aria-label="Fluxdesk — ir para o início"
          className="rounded-control transition-opacity hover:opacity-80"
        >
          <Logo />
        </Link>
      </div>

      <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto px-3 pb-3 pt-2">
        {groups.map((group, gi) => (
          <Fragment key={gi}>
            {gi > 0 && <div role="presentation" className="mx-3 my-3 h-px bg-line dark:bg-white/[0.07]" />}
            <ul className="space-y-0.5">
              {group.map((item) => {
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
                          'group relative flex min-h-[2.25rem] items-center gap-3 rounded-control px-3 py-1.5 text-[0.84375rem] font-medium transition-colors duration-120 dark:focus-visible:outline-sand',
                          isActive
                            ? 'bg-surface-muted text-fg dark:bg-white/[0.09] dark:text-white'
                            : 'hover:bg-line/80 hover:text-fg dark:hover:bg-white/[0.06] dark:hover:text-white',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && <span aria-hidden="true" className="absolute -left-3 top-2 h-5 w-[3px] rounded-r-full bg-brand dark:bg-sand" />}
                          <Icon className={cn('h-[1.0625rem] w-[1.0625rem] shrink-0 transition-colors', isActive ? 'text-fg dark:text-sand' : 'text-fg-subtle group-hover:text-fg dark:text-graphite-400 dark:group-hover:text-graphite-200')} aria-hidden="true" />
                          <span className="truncate">{item.label}</span>
                          {count > 0 && (
                            <span
                              aria-hidden="true"
                              className="ml-auto flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-graphite-800 px-1 text-2xs font-bold leading-none text-white dark:bg-sand dark:text-graphite-900"
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
          </Fragment>
        ))}
      </nav>

      <div className="shrink-0 border-t border-line p-3 dark:border-white/[0.07]">
        <AccountMenu onNavigate={onNavigate} />
      </div>
    </div>
  )
}
