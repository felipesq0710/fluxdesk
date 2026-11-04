import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReportView } from '@/components/reports/ReportView'
import { DEFAULT_REPORT_FILTERS } from '@/lib/report'
import { makeReport } from '@/test/reportFixtures'

const renderView = (data = makeReport(), showAssignees = true) =>
  render(<ReportView data={data} filters={{ ...DEFAULT_REPORT_FILTERS, period: 'all' }} showAssignees={showAssignees} />)

describe('ReportView', () => {
  it('mostra os indicadores com os valores reais do relatório', () => {
    renderView()
    expect(screen.getByText('Total de chamados').nextElementSibling).toHaveTextContent('10')
    const queue = screen.getByRole('region', { name: 'Situação da fila' })
    expect(within(queue).getByText('Críticos ativos').closest('div')).toHaveTextContent('1')
    expect(screen.getByText(/1 d 3 h/)).toBeInTheDocument() // 26,5 h
  })

  it('não apresenta média com poucos chamados resolvidos', () => {
    renderView(makeReport({ totals: { ...makeReport().totals, resolved_with_date: 2, avg_resolution_hours: 5 } }))
    expect(screen.getByText(/Dados insuficientes/)).toBeInTheDocument()
    expect(screen.queryByText(/com base em/)).not.toBeInTheDocument()
  })

  it('completa status e prioridades sem chamados com zero, na ordem do negócio', async () => {
    renderView()
    const card = screen.getByRole('region', { name: 'Por status' })
    await userEvent.click(within(card).getByRole('button', { name: 'Tabela' }))
    const rows = within(card).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(6)
    expect(rows[0]).toHaveTextContent('Aberto')
    expect(rows[0]).toHaveTextContent('3')
    expect(rows[5]).toHaveTextContent('0')
  })

  it('a visão em tabela expõe os mesmos números do gráfico', async () => {
    renderView()
    const card = screen.getByRole('region', { name: 'Por categoria' })
    await userEvent.click(within(card).getByRole('button', { name: 'Tabela' }))
    expect(within(card).getByRole('row', { name: /Software\s*7/ })).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Tabela' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('tabela por responsável aparece só para a equipe', () => {
    const { unmount } = renderView(makeReport(), true)
    expect(screen.getByText('Ana Técnica')).toBeInTheDocument()
    unmount()
    renderView(makeReport(), false)
    expect(screen.queryByText('Ana Técnica')).not.toBeInTheDocument()
  })

  it('exibe mensagem quando não há chamados', () => {
    renderView(makeReport({ by_priority: [], by_status: [] }))
    expect(screen.getAllByText('Sem chamados no período.').length).toBeGreaterThanOrEqual(2)
  })
})
