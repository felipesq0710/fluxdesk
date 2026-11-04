import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import TicketsPage from '@/pages/tickets/TicketsPage'
import { makeTicket } from '@/test/fixtures'
import { resetTicketServiceMock, ticketServiceMock } from '@/test/ticketServiceMock'
import { authAs, renderWithProviders } from '@/test/utils'

vi.mock('@/services/tickets', async () => (await import('@/test/ticketServiceMock')).ticketServiceMock)
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() }, Toaster: () => null }))

const page = (items = [makeTicket()], total = items.length, pageNumber = 1) => ({ items, total, page: pageNumber, pageSize: 20 })

function renderList(role: Parameters<typeof authAs>[0] = 'requester', route = '/chamados') {
  return renderWithProviders(
    <Routes>
      <Route path="/chamados" element={<TicketsPage />} />
    </Routes>,
    { auth: authAs(role), route },
  )
}

const lastFilters = () => ticketServiceMock.listTickets.mock.calls.at(-1)?.[0]

beforeEach(() => resetTicketServiceMock())

describe('listagem de chamados', () => {
  it('mostra carregamento e depois os chamados com status e prioridade em texto', async () => {
    ticketServiceMock.listTickets.mockResolvedValue(page([makeTicket({ status: 'in_progress', priority: 'critical' })]))
    renderList()

    expect(screen.getByRole('status', { name: 'Carregando chamados' })).toBeInTheDocument()
    const table = await screen.findByRole('table', { name: 'Lista de chamados' })
    expect(within(table).getByText('FLX-000001')).toBeInTheDocument()
    expect(within(table).getByRole('link', { name: 'Impressora offline' })).toHaveAttribute('href', expect.stringMatching(/^\/chamados\//))
    expect(within(table).getByText('Em atendimento')).toBeInTheDocument()
    expect(within(table).getByText('Crítica')).toBeInTheDocument()
    expect(within(table).getByText('Sem responsável')).toBeInTheDocument()
  })

  it('sinaliza em texto o chamado ativo sem atualização há 3 dias ou mais', async () => {
    const old = new Date(Date.now() - 5 * 86_400_000).toISOString()
    ticketServiceMock.listTickets.mockResolvedValue(
      page([makeTicket({ id: 'a1', status: 'in_progress', updated_at: old }), makeTicket({ id: 'a2', status: 'resolved', updated_at: old })]),
    )
    renderList('admin')
    const table = await screen.findByRole('table', { name: 'Lista de chamados' })
    expect(within(table).getAllByText('Parado há 5 dias')).toHaveLength(1)
  })

  it('estado vazio sem filtros convida a abrir um chamado (solicitante)', async () => {
    ticketServiceMock.listTickets.mockResolvedValue(page([], 0))
    renderList('requester')
    expect(await screen.findByText('Você ainda não abriu chamados')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /chamado/i }).some((l) => l.getAttribute('href') === '/chamados/novo')).toBe(true)
  })

  it('estado vazio com filtros oferece limpar filtros', async () => {
    ticketServiceMock.listTickets.mockResolvedValue(page([], 0))
    renderList('admin', '/chamados?status=open')
    expect(await screen.findByText('Nenhum chamado encontrado')).toBeInTheDocument()

    ticketServiceMock.listTickets.mockClear()
    await userEvent.click(screen.getAllByRole('button', { name: 'Limpar filtros' })[0]!)
    await waitFor(() => expect(lastFilters()).toMatchObject({ status: '' }))
  })

  it('exibe erro com tentativa de novo carregamento', async () => {
    ticketServiceMock.listTickets.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    renderList()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Falha de conexão')

    ticketServiceMock.listTickets.mockResolvedValue(page())
    await userEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
  })

  it('envia ao serviço os filtros presentes na URL e ignora valores inválidos', async () => {
    ticketServiceMock.listTickets.mockResolvedValue(page())
    renderList('admin', '/chamados?status=open&priority=high&page=2&sort=hack&q=wifi')
    await screen.findByRole('table')
    expect(lastFilters()).toMatchObject({ status: 'open', priority: 'high', page: 2, sort: 'created_at', search: 'wifi' })
  })

  it('ordena ao clicar no cabeçalho', async () => {
    ticketServiceMock.listTickets.mockResolvedValue(page())
    renderList()
    await screen.findByRole('table')
    await userEvent.click(screen.getByRole('button', { name: 'Ordenar por Título' }))
    await waitFor(() => expect(lastFilters()).toMatchObject({ sort: 'title', dir: 'asc' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ordenar por Título' }))
    await waitFor(() => expect(lastFilters()).toMatchObject({ sort: 'title', dir: 'desc' }))
  })

  it('aplica busca com debounce e volta à página 1', async () => {
    ticketServiceMock.listTickets.mockResolvedValue(page())
    renderList('requester', '/chamados?page=3')
    await screen.findByRole('table')
    ticketServiceMock.listTickets.mockClear()

    await userEvent.type(screen.getByLabelText('Buscar'), 'FLX-12')
    expect(ticketServiceMock.listTickets).not.toHaveBeenCalled()
    await waitFor(() => expect(lastFilters()).toMatchObject({ search: 'FLX-12', page: 1 }), { timeout: 2000 })
  })

  it('pagina de verdade: avança e retrocede', async () => {
    ticketServiceMock.listTickets.mockImplementation(async (f: { page: number }) => page([makeTicket()], 45, f.page))
    renderList()
    expect(await screen.findByText('Página 1 de 3')).toBeInTheDocument()
    expect(screen.getByText('Exibindo 1–20 de 45')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Anterior/ })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: /Próxima/ }))
    expect(await screen.findByText('Página 2 de 3')).toBeInTheDocument()
    expect(lastFilters()).toMatchObject({ page: 2 })
  })

  it('página fora do intervalo oferece voltar à primeira', async () => {
    ticketServiceMock.listTickets.mockImplementation(async (f: { page: number }) => (f.page > 1 ? page([], 5, f.page) : page()))
    renderList('requester', '/chamados?page=9')
    expect(await screen.findByText('Esta página não existe mais')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Voltar à primeira página' }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
  })
})

describe('permissões na listagem', () => {
  it('técnico vê "Assumir" em chamado sem responsável e assume', async () => {
    ticketServiceMock.listTickets.mockResolvedValue(page([makeTicket({ requester_id: 'outro' })]))
    renderList('technician')
    await userEvent.click(await screen.findByRole('button', { name: /Assumir/ }))
    await waitFor(() => expect(ticketServiceMock.updateTicket).toHaveBeenCalledWith(expect.any(String), { assignee_id: 'user-1' }))
  })

  it('solicitante não vê "Assumir"', async () => {
    ticketServiceMock.listTickets.mockResolvedValue(page())
    renderList('requester')
    await screen.findByRole('table')
    expect(screen.queryByRole('button', { name: /Assumir/ })).not.toBeInTheDocument()
  })

  it('filtro por responsável só existe para a equipe', async () => {
    ticketServiceMock.listTickets.mockResolvedValue(page())
    const { unmount } = renderList('requester')
    await screen.findByRole('table')
    expect(screen.queryByLabelText('Responsável')).not.toBeInTheDocument()
    expect(ticketServiceMock.listStaff).not.toHaveBeenCalled()
    unmount()

    renderList('admin')
    expect(await screen.findByLabelText('Responsável')).toBeInTheDocument()
  })
})
