import { useCallback, useMemo, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, SearchX, Ticket as TicketIcon } from 'lucide-react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { TicketFilters } from '@/components/tickets/TicketFilters'
import { TicketTable } from '@/components/tickets/TicketTable'
import { Pagination } from '@/components/ui/Pagination'
import { useProfile } from '@/hooks/useAuth'
import { useCategories, useStaff, useTickets } from '@/hooks/useTickets'
import { dbErrorMessage } from '@/lib/errors'
import { isStaff } from '@/lib/permissions'
import {
  DEFAULT_FILTERS,
  PAGE_SIZE,
  filtersToSearchParams,
  hasActiveFilters,
  parseTicketFilters,
  type TicketFilters as Filters,
  type TicketSortKey,
} from '@/lib/ticketFilters'
import type { TicketScope } from '@/services/tickets'

function ListSkeleton() {
  return (
    <div role="status" aria-label="Carregando chamados" className="divide-y divide-line">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <div className="h-4 w-20 animate-pulse rounded bg-surface-muted" />
          <div className="h-4 flex-1 animate-pulse rounded bg-surface-muted" />
          <div className="hidden h-5 w-16 animate-pulse rounded-full bg-surface-muted sm:block" />
          <div className="hidden h-5 w-24 animate-pulse rounded-full bg-surface-muted sm:block" />
        </div>
      ))}
    </div>
  )
}

export function TicketListView({
  title,
  description,
  scope,
  sections,
  hideAssignee = false,
  hideStatus = false,
  hidePriority = false,
  preserveParams = [],
  showNewButton = true,
  emptyTitle = 'Nenhum chamado por aqui',
  emptyDescription = 'Quando houver chamados, eles aparecerão nesta lista.',
}: {
  title: string
  description?: string
  scope?: TicketScope
  sections?: ReactNode
  hideAssignee?: boolean
  hideStatus?: boolean
  hidePriority?: boolean
  preserveParams?: string[]
  showNewButton?: boolean
  emptyTitle?: string
  emptyDescription?: string
}) {
  const profile = useProfile()
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => parseTicketFilters(searchParams), [searchParams])
  const staffView = isStaff(profile.role)

  const tickets = useTickets(filters, profile.id, scope)
  const categories = useCategories(false)
  const staff = useStaff(staffView && !hideAssignee)

  const withPreserved = useCallback(
    (params: URLSearchParams) => {
      for (const key of preserveParams) {
        const value = searchParams.get(key)
        if (value !== null) params.set(key, value)
      }
      return params
    },
    [preserveParams, searchParams],
  )

  const update = useCallback(
    (patch: Partial<Filters>) => {
      const next: Filters = { ...filters, ...patch }
      if (!('page' in patch)) next.page = 1
      setSearchParams(withPreserved(filtersToSearchParams(next)))
    },
    [filters, setSearchParams, withPreserved],
  )

  const onSort = useCallback(
    (key: TicketSortKey) => {
      if (filters.sort === key) update({ dir: filters.dir === 'asc' ? 'desc' : 'asc' })
      else update({ sort: key, dir: key === 'title' || key === 'number' ? 'asc' : 'desc' })
    },
    [filters.sort, filters.dir, update],
  )

  const clear = useCallback(
    () => setSearchParams(withPreserved(filtersToSearchParams({ ...DEFAULT_FILTERS, sort: filters.sort, dir: filters.dir }))),
    [filters.sort, filters.dir, setSearchParams, withPreserved],
  )

  const data = tickets.data
  const filtered = hasActiveFilters(filters)

  let content
  if (tickets.isPending) {
    content = <ListSkeleton />
  } else if (tickets.isError && !data) {
    content = (
      <div className="p-4">
        <ErrorState
          title="Não foi possível carregar os chamados"
          message={dbErrorMessage(tickets.error)}
          onRetry={() => void tickets.refetch()}
        />
      </div>
    )
  } else if (data && data.items.length === 0 && data.total > 0) {
    // Página fora do intervalo (ex.: URL antiga).
    content = (
      <EmptyState
        icon={SearchX}
        title="Esta página não existe mais"
        description="O número de resultados mudou desde a última visita."
        action={
          <button type="button" className="btn-primary" onClick={() => update({ page: 1 })}>
            Voltar à primeira página
          </button>
        }
      />
    )
  } else if (data && data.total === 0) {
    content = filtered ? (
      <EmptyState
        icon={SearchX}
        title="Nenhum chamado encontrado"
        description="Nenhum resultado corresponde aos filtros aplicados."
        action={
          <button type="button" className="btn-secondary" onClick={clear}>
            Limpar filtros
          </button>
        }
      />
    ) : (
      <EmptyState
        icon={TicketIcon}
        title={emptyTitle}
        description={emptyDescription}
        action={
          showNewButton ? (
            <Link to="/chamados/novo" className="btn-primary">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Abrir chamado
            </Link>
          ) : undefined
        }
      />
    )
  } else if (data) {
    content = (
      <>
        <TicketTable tickets={data.items} sort={filters.sort} dir={filters.dir} onSort={onSort} actor={{ id: profile.id, role: profile.role }} />
        <div className="border-t border-line">
          <Pagination page={data.page} pageSize={PAGE_SIZE} total={data.total} onPageChange={(page) => update({ page })} disabled={tickets.isFetching} />
        </div>
      </>
    )
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">{title}</h1>
          {description && <p className="page-lead">{description}</p>}
        </div>
        {showNewButton && (
          <Link to="/chamados/novo" className="btn-primary">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Novo chamado
          </Link>
        )}
      </div>

      {sections}

      <div className="card overflow-hidden" aria-busy={tickets.isFetching}>
        <TicketFilters
          filters={filters}
          onChange={update}
          onClear={clear}
          categories={categories.data ?? []}
          staff={staffView && !hideAssignee ? (staff.data ?? []) : undefined}
          hideAssignee={hideAssignee}
          hideStatus={hideStatus}
          hidePriority={hidePriority}
        />
        {tickets.isError && data && (
          <div className="border-b border-line p-3">
            <ErrorState title="Falha ao atualizar" message={dbErrorMessage(tickets.error)} onRetry={() => void tickets.refetch()} />
          </div>
        )}
        <div className={tickets.isFetching && !tickets.isPending ? 'opacity-70 transition-opacity' : undefined}>{content}</div>
      </div>
    </div>
  )
}
