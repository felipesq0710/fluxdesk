import { SelectField } from '@/components/ui/SelectField'
import { PERIODS, PERIOD_LABEL, type ReportFilters } from '@/lib/report'
import { PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL } from '@/lib/ticketLabels'
import type { Category } from '@/types/domain'

export function ReportFiltersBar({
  filters,
  onChange,
  onClear,
  categories,
  staff,
  dirty,
  dashboard = false,
}: {
  filters: ReportFilters
  onChange: (patch: Partial<ReportFilters>) => void
  onClear: () => void
  categories: Category[]
  staff?: { id: string; full_name: string }[]
  dirty: boolean
  dashboard?: boolean
}) {
  const custom = filters.period === 'custom'
  const invalidRange = custom && filters.from !== '' && filters.to !== '' && filters.from > filters.to
  return (
    <section aria-label="Filtros do relatório" className={dashboard ? 'card p-3 sm:p-4' : 'card p-4'}>
      {dashboard && (
        <div className="mb-3 flex items-center justify-between gap-3 xl:hidden">
          <h2 className="text-sm font-semibold text-fg">Filtros</h2>
          {dirty && (
            <button type="button" className="btn-ghost !min-h-0 px-2 py-1 text-xs" onClick={onClear}>
              Restaurar padrão
            </button>
          )}
        </div>
      )}
      <div className={dashboard ? 'grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 xl:grid-cols-4' : 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'}>
        <SelectField label="Período" value={filters.period} onChange={(e) => onChange({ period: e.target.value as ReportFilters['period'] })}>
          {PERIODS.map((p) => (
            <option key={p} value={p}>
              {PERIOD_LABEL[p]}
            </option>
          ))}
        </SelectField>
        {custom && (
          <>
            <div>
              <label htmlFor="rep-from" className="field-label">
                De
              </label>
              <input id="rep-from" type="date" className="field-input" value={filters.from} max={filters.to || undefined} onChange={(e) => onChange({ from: e.target.value })} />
            </div>
            <div>
              <label htmlFor="rep-to" className="field-label">
                Até
              </label>
              <input id="rep-to" type="date" className="field-input" value={filters.to} min={filters.from || undefined} onChange={(e) => onChange({ to: e.target.value })} />
            </div>
          </>
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
        <SelectField label="Prioridade" value={filters.priority} onChange={(e) => onChange({ priority: e.target.value as ReportFilters['priority'] })}>
          <option value="">Todas</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </SelectField>
        <SelectField label="Status" value={filters.status} onChange={(e) => onChange({ status: e.target.value as ReportFilters['status'] })}>
          <option value="">Todos</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </SelectField>
        {staff !== undefined && (
          <SelectField label="Responsável" value={filters.assignee} onChange={(e) => onChange({ assignee: e.target.value })}>
            <option value="">Todos</option>
            <option value="me">Atribuídos a mim</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </SelectField>
        )}
      </div>
      {invalidRange && (
        <p role="alert" className="field-error">
          A data inicial deve ser anterior à data final.
        </p>
      )}
      {dirty && !dashboard && (
        <div className="mt-3">
          <button type="button" className="btn-ghost !min-h-0 px-2 py-1 text-xs" onClick={onClear}>
            Restaurar filtros padrão
          </button>
        </div>
      )}
    </section>
  )
}
