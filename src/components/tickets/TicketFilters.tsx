import { useEffect, useRef, useState } from 'react'
import { ListFilter, Search, X } from 'lucide-react'
import { SelectField } from '@/components/ui/SelectField'
import { hasActiveFilters, type TicketFilters as Filters } from '@/lib/ticketFilters'
import { PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL } from '@/lib/ticketLabels'
import type { Category } from '@/types/domain'

export interface StaffOption {
  id: string
  full_name: string
}

export function TicketFilters({
  filters,
  onChange,
  onClear,
  categories,
  staff,
  hideAssignee = false,
  hideStatus = false,
  hidePriority = false,
}: {
  filters: Filters
  onChange: (patch: Partial<Filters>) => void
  onClear: () => void
  categories: Category[]
  staff?: StaffOption[]
  hideAssignee?: boolean
  hideStatus?: boolean
  hidePriority?: boolean
}) {
  const [text, setText] = useState(filters.search)
  const [expanded, setExpanded] = useState(false)
  const lastSent = useRef(filters.search)

  // Busca com debounce: evita uma consulta por tecla digitada.
  useEffect(() => {
    const value = text.trim()
    if (value === filters.search) return
    const timer = window.setTimeout(() => {
      lastSent.current = value
      onChange({ search: value })
    }, 350)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  // Sincroniza mudanças externas (botão Voltar, limpar filtros) sem atropelar a digitação.
  useEffect(() => {
    if (filters.search !== lastSent.current) {
      lastSent.current = filters.search
      setText(filters.search)
    }
  }, [filters.search])

  const active = hasActiveFilters(filters)
  const showAssignee = !hideAssignee && staff !== undefined

  return (
    <section aria-label="Filtros de chamados" className="border-b border-line p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="ticket-search" className="field-label">
            Buscar
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
            <input
              id="ticket-search"
              type="search"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Número ou título (ex.: FLX-000012)"
              maxLength={100}
              className="field-input pl-9"
              autoComplete="off"
            />
          </div>
        </div>

        <button
          type="button"
          className="btn-secondary md:hidden"
          aria-expanded={expanded}
          aria-controls="ticket-filter-panel"
          onClick={() => setExpanded((v) => !v)}
        >
          <ListFilter className="h-4 w-4" aria-hidden="true" />
          Filtros{active ? ' (ativos)' : ''}
        </button>
      </div>

      <div
        id="ticket-filter-panel"
        className={`${expanded ? 'grid' : 'hidden'} mt-3 grid-cols-1 gap-3 sm:grid-cols-2 md:grid md:grid-cols-3 xl:grid-cols-6`}
      >
        {!hideStatus && (
          <SelectField
            label="Status"
            value={filters.status}
            onChange={(e) => onChange({ status: e.target.value as Filters['status'] })}
          >
            <option value="">Todos</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </SelectField>
        )}
        {!hidePriority && (
          <SelectField
            label="Prioridade"
            value={filters.priority}
            onChange={(e) => onChange({ priority: e.target.value as Filters['priority'] })}
          >
            <option value="">Todas</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </SelectField>
        )}
        <SelectField label="Categoria" value={filters.category} onChange={(e) => onChange({ category: e.target.value })}>
          <option value="">Todas</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.is_active ? '' : ' (inativa)'}
            </option>
          ))}
        </SelectField>
        {showAssignee && (
          <SelectField label="Responsável" value={filters.assignee} onChange={(e) => onChange({ assignee: e.target.value })}>
            <option value="">Todos</option>
            <option value="me">Atribuídos a mim</option>
            <option value="none">Sem responsável</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </SelectField>
        )}
        <div>
          <label htmlFor="ticket-from" className="field-label">
            Aberto de
          </label>
          <input
            id="ticket-from"
            type="date"
            className="field-input"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(e) => onChange({ from: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="ticket-to" className="field-label">
            Aberto até
          </label>
          <input
            id="ticket-to"
            type="date"
            className="field-input"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(e) => onChange({ to: e.target.value })}
          />
        </div>
      </div>

      {active && (
        <div className="mt-3">
          <button
            type="button"
            className="btn-ghost !min-h-0 px-2 py-1 text-sm"
            onClick={() => {
              setText('')
              lastSent.current = ''
              onClear()
            }}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Limpar filtros
          </button>
        </div>
      )}
    </section>
  )
}
