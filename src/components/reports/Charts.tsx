import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartCard, DataTable } from '@/components/reports/ChartCard'
import type { LabeledCount, TimelineBucket } from '@/lib/report'

const AXIS = { fontSize: 12, fill: 'var(--chart-axis)' }

interface TipProps {
  active?: boolean
  payload?: { name?: string; value?: number; color?: string }[]
  label?: string
}

function Tip({ active, payload, label }: TipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-pop border border-line bg-surface-raised px-3 py-2 text-xs shadow-pop">
      <p className="mb-1 font-medium text-fg">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-fg-muted">
          <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-medium tabular-nums text-fg">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

export function DistributionChart({
  title,
  description,
  rows,
  seriesName = 'Chamados',
}: {
  title: string
  description?: string
  rows: LabeledCount[]
  seriesName?: string
}) {
  const total = rows.reduce((s, r) => s + r.count, 0)
  const height = Math.max(120, rows.length * 34 + 16)
  return (
    <ChartCard
      title={title}
      description={description}
      chart={
        total === 0 ? (
          <p className="py-8 text-center text-sm text-fg-muted">Sem chamados no período.</p>
        ) : (
          <div style={{ height }} role="img" aria-label={`${title}: ${rows.map((r) => `${r.label} ${r.count}`).join(', ')}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 0 }} barCategoryGap={8}>
                <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
                <XAxis type="number" allowDecimals={false} tick={AXIS} stroke="var(--chart-grid)" />
                <YAxis type="category" dataKey="label" width={118} tick={AXIS} tickLine={false} axisLine={false} />
                <Tooltip content={<Tip />} cursor={{ fill: 'var(--chart-cursor)' }} />
                <Bar dataKey="count" name={seriesName} fill="var(--chart-neutral)" radius={[0, 3, 3, 0]} maxBarSize={14} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )
      }
      table={<DataTable caption={title} headers={[title.replace(/^Por /, ''), seriesName]} rows={rows.map((r) => [r.label, r.count])} />}
    />
  )
}

export function TimelineChart({ buckets }: { buckets: TimelineBucket[] }) {
  const title = 'Criados e resolvidos ao longo do tempo'
  const sparse = buckets.length > 14 ? Math.ceil(buckets.length / 8) - 1 : 0
  return (
    <ChartCard
      title={title}
      description="Resolvidos contam pela data de resolução."
      chart={
        buckets.length === 0 ? (
          <p className="py-8 text-center text-sm text-fg-muted">Sem dados no período.</p>
        ) : (
          <>
            <ul className="mb-2 flex gap-4 text-xs text-fg-muted" aria-label="Legenda">
              <li className="flex items-center gap-1.5">
                <span aria-hidden="true" className="h-0.5 w-4 rounded" style={{ background: 'var(--chart-1)' }} /> Criados
              </li>
              <li className="flex items-center gap-1.5">
                <span aria-hidden="true" className="h-0.5 w-4 rounded" style={{ background: 'var(--chart-2)' }} /> Resolvidos
              </li>
            </ul>
            <div style={{ height: 240 }} role="img" aria-label={`${title}. Use a visualização em tabela para ver os valores.`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={buckets} margin={{ top: 4, right: 12, bottom: 0, left: -12 }}>
                  <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                  <XAxis dataKey="label" tick={AXIS} stroke="var(--chart-grid)" interval={sparse} />
                  <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
                  <Tooltip content={<Tip />} />
                  <Line type="monotone" dataKey="created" name="Criados" stroke="var(--chart-1)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="resolved" name="Resolvidos" stroke="var(--chart-2)" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )
      }
      table={
        <DataTable caption={title} headers={['Período', 'Criados', 'Resolvidos']} rows={buckets.map((b) => [b.label, b.created, b.resolved])} />
      }
      className="lg:col-span-2"
    />
  )
}
