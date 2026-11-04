import { useId, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function ChartCard({
  title,
  description,
  chart,
  table,
  className,
}: {
  title: string
  description?: string
  chart: ReactNode
  table: ReactNode
  className?: string
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const id = useId()
  return (
    <section className={cn('card p-5', className)} aria-labelledby={`${id}-title`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id={`${id}-title`} className="section-title">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-xs text-fg-muted">{description}</p>}
        </div>
        <div role="group" aria-label={`Visualização de ${title}`} className="flex rounded-control bg-surface-muted p-0.5">
          {(['chart', 'table'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                view === v ? 'bg-surface text-fg shadow-xs ring-1 ring-line' : 'text-fg-muted hover:text-fg',
              )}
            >
              {v === 'chart' ? 'Gráfico' : 'Tabela'}
            </button>
          ))}
        </div>
      </div>
      {view === 'chart' ? chart : table}
    </section>
  )
}

export function DataTable({
  caption,
  headers,
  rows,
}: {
  caption: string
  headers: string[]
  rows: (string | number)[][]
}) {
  return (
    <div className="max-h-72 overflow-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-left text-xs text-fg-muted">
            {headers.map((h, i) => (
              <th key={h} scope="col" className={cn('py-2 pr-3 font-medium', i > 0 && 'text-right')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-b border-line/60 last:border-0">
              {row.map((cell, i) =>
                i === 0 ? (
                  <th key={i} scope="row" className="py-2 pr-3 text-left font-normal text-fg">
                    {cell}
                  </th>
                ) : (
                  <td key={i} className="py-2 pr-3 text-right tabular-nums text-fg">
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
