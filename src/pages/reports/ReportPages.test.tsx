import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import DashboardPage from '@/pages/reports/DashboardPage'
import ReportsPage from '@/pages/reports/ReportsPage'
import { makeReport } from '@/test/reportFixtures'
import { resetTicketServiceMock, ticketServiceMock } from '@/test/ticketServiceMock'
import { authAs, renderWithProviders } from '@/test/utils'

const reports = vi.hoisted(() => ({ fetchReport: vi.fn(), fetchTicketsForExport: vi.fn() }))
const csv = vi.hoisted(() => ({ downloadCsv: vi.fn() }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }))

vi.mock('@/services/tickets', async () => (await import('@/test/ticketServiceMock')).ticketServiceMock)
vi.mock('@/services/reports', () => ({ ...reports, EXPORT_MAX_ROWS: 10_000 }))
vi.mock('@/lib/csv', async (orig) => ({ ...(await orig<typeof import('@/lib/csv')>()), downloadCsv: csv.downloadCsv }))
vi.mock('sonner', () => ({ toast, Toaster: () => null }))

// A consulta do período atual é a que não usa o intervalo personalizado calculado para a tendência.
const currentCalls = () => reports.fetchReport.mock.calls.filter(([f]) => f.period !== 'custom' || f.from === '')
const lastFilters = () => currentCalls().at(-1)?.[0]
const previousCalls = () => reports.fetchReport.mock.calls.filter(([f]) => f.period === 'custom' && f.from !== '')

beforeEach(() => {
  vi.clearAllMocks()
  resetTicketServiceMock()
  reports.fetchReport.mockResolvedValue(makeReport())
  ticketServiceMock.listTickets.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 })
})

function renderDashboard(role: 'requester' | 'technician' | 'admin', route = '/') {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<DashboardPage />} />
    </Routes>,
    { auth: authAs(role), route },
  )
}

describe('Dashboard', () => {
  it('solicitante: período padrão de 30 dias, sem filtro de responsável nem tabela por responsável', async () => {
    renderDashboard('requester')
    await screen.findByText('Total de chamados')
    expect(lastFilters()).toMatchObject({ period: '30d', assignee: '' })
    expect(screen.queryByLabelText('Responsável')).not.toBeInTheDocument()
    expect(screen.queryByText('Ana Técnica')).not.toBeInTheDocument()
  })

  it('técnico começa filtrando os próprios chamados, mas pode ver todos', async () => {
    renderDashboard('technician')
    await screen.findByText('Total de chamados')
    expect(lastFilters()).toMatchObject({ assignee: 'me' })
    await userEvent.click(screen.getByRole('button', { name: /Análises por status/ }))
    expect(screen.getByText('Ana Técnica')).toBeInTheDocument()
  })

  it('compara com o período anterior de mesma duração usando dados reais do relatório', async () => {
    reports.fetchReport.mockImplementation(async (f: { period: string }) =>
      f.period === 'custom' ? makeReport({ totals: { ...makeReport().totals, total: 5 } }) : makeReport(),
    )
    renderDashboard('admin')
    await screen.findByText('Total de chamados')
    // makeReport().totals.total = 10 contra 5 no período anterior: +100%
    expect(await screen.findByText('+100%')).toBeInTheDocument()
    expect(previousCalls().length).toBeGreaterThan(0)
  })

  it('não compara quando o período é "todo o período"', async () => {
    renderDashboard('admin', '/?period=all')
    await screen.findByText('Total de chamados')
    expect(previousCalls()).toHaveLength(0)
    expect(screen.queryByText(/vs\. período anterior/)).not.toBeInTheDocument()
  })

  it('mostra atividade recente e atalhos conforme o perfil', async () => {
    renderDashboard('requester')
    expect(await screen.findByRole('heading', { name: 'Atividade recente' })).toBeInTheDocument()
    expect(await screen.findByText('Nenhum chamado atualizado ainda.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Meus chamados/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Minha fila/ })).not.toBeInTheDocument()
  })

  it('análises detalhadas ficam recolhidas até serem abertas', async () => {
    renderDashboard('admin')
    await screen.findByText('Total de chamados')
    const toggle = screen.getByRole('button', { name: /Análises por status/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('region', { name: 'Por status' })).not.toBeInTheDocument()
    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('region', { name: 'Por status' })).toBeInTheDocument()
  })

  it('equipe vê o painel "Exige atenção"; solicitante vê "Aguardando você"', async () => {
    renderDashboard('admin')
    expect(await screen.findByRole('heading', { name: 'Exige atenção' })).toBeInTheDocument()
    expect(screen.getByText('Críticos ativos', { selector: 'a span' })).toBeInTheDocument()
  })

  it('solicitante vê "Aguardando você" sem contadores de equipe', async () => {
    renderDashboard('requester')
    expect(await screen.findByRole('heading', { name: 'Aguardando você' })).toBeInTheDocument()
    expect(screen.queryByText('Sem responsável', { selector: 'a span' })).not.toBeInTheDocument()
  })

  it('trocar o período refaz a consulta', async () => {
    renderDashboard('admin')
    await screen.findByText('Total de chamados')
    await userEvent.selectOptions(screen.getByLabelText('Período'), '7d')
    await waitFor(() => expect(lastFilters()).toMatchObject({ period: '7d' }))
  })

  it('mostra erro com opção de tentar novamente', async () => {
    reports.fetchReport.mockRejectedValueOnce(new Error('falha'))
    renderDashboard('admin')
    await screen.findByRole('alert')
    await userEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }))
    await screen.findByText('Total de chamados')
  })
})

describe('Relatórios', () => {
  const renderReports = () =>
    renderWithProviders(
      <Routes>
        <Route path="/relatorios" element={<ReportsPage />} />
      </Routes>,
      { auth: authAs('admin'), route: '/relatorios' },
    )

  it('exporta CSV com os dados filtrados', async () => {
    reports.fetchTicketsForExport.mockResolvedValue({
      rows: [{ code: 'FLX-000001', title: '=SOMA(A1)', status: 'open', priority: 'high', category: 'Software', requester: 'Maria', assignee: '', created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-01T10:00:00Z', resolved_at: null }],
      truncated: false,
    })
    renderReports()
    await screen.findByText('Total de chamados')
    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }))
    await waitFor(() => expect(csv.downloadCsv).toHaveBeenCalled())
    const [name, content] = csv.downloadCsv.mock.calls[0] as [string, string]
    expect(name).toMatch(/^fluxdesk-chamados-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(content).toContain('FLX-000001;\'=SOMA(A1);Aberto;Alta;Software;Maria')
    expect(toast.success).toHaveBeenCalled()
  })

  it('avisa quando a exportação é truncada e quando não há dados', async () => {
    reports.fetchTicketsForExport.mockResolvedValueOnce({ rows: [], truncated: false })
    renderReports()
    await screen.findByText('Total de chamados')
    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }))
    await waitFor(() => expect(toast.info).toHaveBeenCalled())
    expect(csv.downloadCsv).not.toHaveBeenCalled()

    reports.fetchTicketsForExport.mockResolvedValueOnce({
      rows: [{ code: 'FLX-1', title: 't', status: 'open', priority: 'low', category: '', requester: '', assignee: '', created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-01T10:00:00Z', resolved_at: null }],
      truncated: true,
    })
    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }))
    await waitFor(() => expect(toast.warning).toHaveBeenCalled())
  })

  it('erro na exportação não derruba a página', async () => {
    reports.fetchTicketsForExport.mockRejectedValue(new Error('x'))
    renderReports()
    await screen.findByText('Total de chamados')
    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeEnabled()
  })
})
