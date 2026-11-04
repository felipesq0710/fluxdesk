import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { TicketListView } from '@/components/tickets/TicketListView'
import { useProfile } from '@/hooks/useAuth'
import { useTicketCount } from '@/hooks/useTickets'
import { cn } from '@/lib/cn'
import { QUEUE_TABS, parseQueueTab, recentSince, scopeForTab, type QueueTab } from '@/lib/queueTabs'

const PRESERVE = ['tab']

function TabLink({ tab, active, userId, since }: { tab: QueueTab; active: boolean; userId: string; since: string }) {
  const count = useTicketCount(userId, scopeForTab(tab.key, userId, since))
  return (
    <Link
      to={`?tab=${tab.key}`}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex min-h-[2.5rem] items-center gap-2 whitespace-nowrap rounded-control px-3 py-2 text-sm font-medium',
        active ? 'bg-brand-soft text-brand-fg ring-1 ring-inset ring-brand/20' : 'text-fg-muted hover:bg-surface-muted hover:text-fg',
      )}
    >
      {tab.label}
      {count.data !== undefined && (
        <span
          className={cn('rounded-full px-2 py-0.5 text-xs', active ? 'bg-brand text-white' : 'bg-surface-muted text-fg')}
          aria-label={`${count.data} chamado${count.data === 1 ? '' : 's'}`}
        >
          {count.data}
        </span>
      )}
    </Link>
  )
}

export default function QueuePage() {
  const profile = useProfile()
  const [params] = useSearchParams()
  const tabKey = parseQueueTab(params.get('tab'))
  const tab = QUEUE_TABS.find((t) => t.key === tabKey) ?? QUEUE_TABS[0]!
  const since = useMemo(() => recentSince(), [])
  const scope = useMemo(() => scopeForTab(tabKey, profile.id, since), [tabKey, profile.id, since])

  return (
    <TicketListView
      key={tabKey}
      sections={
        <nav aria-label="Seções da fila" className="-mt-2 mb-4 flex gap-1 overflow-x-auto pb-1">
          {QUEUE_TABS.map((t) => (
            <TabLink key={t.key} tab={t} active={t.key === tabKey} userId={profile.id} since={since} />
          ))}
        </nav>
      }
      title="Minha fila"
      description={tab.description}
      scope={scope}
      hideAssignee
      hideStatus={tab.hideStatus}
      hidePriority={tab.hidePriority}
      preserveParams={PRESERVE}
      showNewButton={false}
      emptyTitle={tab.empty.title}
      emptyDescription={tab.empty.description}
    />
  )
}
