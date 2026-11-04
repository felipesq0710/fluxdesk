import { useId, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { TimelineBucket, Trend } from '@/lib/report'

const CREATED = 'var(--chart-1)'
const RESOLVED = 'var(--chart-2)'
const AXIS = { fontSize: 12, fill: 'var(--chart-axis)' }

function DarkTip({ active, payload, label }: { active?: boolean; payload?: { name?: string; value?: number; color?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-pop border border-line bg-surface-raised px-3 py-2 text-xs shadow-pop">
      <p className="mb-1 font-medium text-fg">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-fg-muted">
          <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-semibold tabular-nums text-fg">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

export function TrendChip({ trend, label }: { trend: Trend | null | undefined; label: string }) {
  if (!trend) return null
  if (trend.pct === null) {
    return <span className="text-xs text-fg-muted">{trend.direction === 'flat' ? 'Sem chamados no período anterior' : 'Sem base de comparação: o período anterior não teve chamados'}</span>
  }
  const Icon = trend.direction === 'up' ? ArrowUpRight : trend.direction === 'down' ? ArrowDownRight : Minus
  const text = trend.direction === 'flat' ? 'Estável' : `${trend.pct > 0 ? '+' : '−'}${Math.abs(trend.pct)}%`
  return (
    <span className="inline-flex items-center gap-2 text-xs text-fg-muted">
      <span className="inline-flex items-center gap-0.5 rounded-full bg-sand px-2 py-0.5 font-semibold tabular-nums text-graphite-900 ring-1 ring-inset ring-sand-400/50">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {text}
      </span>
      {label} ({trend.previous})
    </span>
  )
}

// Painel principal do Dashboard: volume do período, tendência frente ao período anterior
// e evolução de criados × resolvidos. Todos os valores vêm da consulta real do usuário.
export function OverviewPanel({
  total,
  resolved,
  totalTrend,
  resolvedTrend,
  comparisonLabel,
  periodLabel,
  buckets,
}: {
  total: number
  resolved: number
  totalTrend: Trend | null | undefined
  resolvedTrend: Trend | null | undefined
  comparisonLabel: string
  periodLabel: string
  buckets: TimelineBucket[]
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const id = useId()
  const sparse = buckets.length > 14 ? Math.ceil(buckets.length / 8) - 1 : 0
  const few = buckets.length <= 8
  const title = 'Criados e resolvidos ao longo do tempo'

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="card relative h-full overflow-hidden bg-gradient-to-br from-brand-50 via-surface to-surface p-5 text-fg dark:bg-graphite-900 dark:bg-none sm:p-6"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-brand/[0.14] blur-3xl dark:bg-brand/25" />

      <div className="relative flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
        <div>
          <h2 id={`${id}-title`} className="text-sm font-medium text-fg-muted">
            Total de chamados
          </h2>
          <p className="numeral mt-2 text-display" style={{ fontVariationSettings: "'opsz' 72" }}>
            {total}
          </p>
          <div className="mt-2.5">
            <TrendChip trend={totalTrend} label={comparisonLabel} />
          </div>
          <p className="mt-1.5 text-xs text-fg-muted dark:text-fg-subtle">Criados em {periodLabel.toLowerCase()}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-fg-muted">Resolvidos</p>
          <p className="numeral mt-2 text-[2rem] leading-none">{resolved}</p>
          <div className="mt-2.5">
            <TrendChip trend={resolvedTrend} label={comparisonLabel} />
          </div>
          <p className="mt-1.5 text-xs text-fg-muted dark:text-fg-subtle">Inclui encerrados</p>
        </div>
      </div>

      <div className="relative mt-6">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <ul className="flex gap-4 text-xs text-fg-muted" aria-label="Legenda">
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-0.5 w-4 rounded" style={{ background: CREATED }} /> Criados
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-0.5 w-4 rounded" style={{ background: RESOLVED }} /> Resolvidos
            </li>
          </ul>
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

        {buckets.length === 0 ? (
          <p className="py-12 text-center text-sm text-fg-muted">Sem dados no período.</p>
        ) : view === 'chart' ? (
          <div style={{ height: 232 }} role="img" aria-label={`${title}. Use a visualização em tabela para ver os valores.`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={buckets} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                <XAxis dataKey="label" tick={AXIS} stroke="var(--chart-grid)" tickLine={false} interval={sparse} />
                <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
                <Tooltip content={<DarkTip />} cursor={{ stroke: 'var(--chart-grid)' }} />
                <Line type="monotone" dataKey="created" name="Criados" stroke={CREATED} strokeWidth={2} dot={few ? { r: 3, strokeWidth: 0, fill: CREATED } : false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'rgb(var(--surface))' }} isAnimationActive={false} />
                <Line type="monotone" dataKey="resolved" name="Resolvidos" stroke={RESOLVED} strokeWidth={2} dot={few ? { r: 3, strokeWidth: 0, fill: RESOLVED } : false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'rgb(var(--surface))' }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="max-h-60 overflow-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">{title}</caption>
              <thead>
                <tr className="border-b border-line text-left text-xs text-fg-muted">
                  <th scope="col" className="py-2 pr-3 font-medium">Período</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Criados</th>
                  <th scope="col" className="py-2 text-right font-medium">Resolvidos</th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((b) => (
                  <tr key={b.start} className="border-b border-line/60 last:border-0">
                    <th scope="row" className="py-2 pr-3 text-left font-normal">{b.label}</th>
                    <td className="py-2 pr-3 text-right tabular-nums">{b.created}</td>
                    <td className="py-2 text-right tabular-nums">{b.resolved}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
