import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import QueuePage from '@/pages/tickets/QueuePage'
import { makeTicket } from '@/test/fixtures'
import { resetTicketServiceMock, ticketServiceMock } from '@/test/ticketServiceMock'
import { authAs, renderWithProviders } from '@/test/utils'

vi.mock('@/services/tickets', async () => (await import('@/test/ticketServiceMock')).ticketServiceMock)
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() }, Toaster: () => null }))

const page = (items = [makeTicket({ assignee_id: 'user-1' })]) => ({ items, total: items.length, page: 1, pageSize: 20 })
const lastScope = () => ticketServiceMock.listTickets.mock.calls.at(-1)?.[2]

function renderQueue(route = '/minha-fila') {
  return renderWithProviders(
    <Routes>
      <Route path="/minha-fila" element={<QueuePage />} />
    </Routes>,
    { auth: authAs('technician'), route },
  )
}

beforeEach(() => {
  resetTicketServiceMock()
  ticketServiceMock.listTickets.mockResolvedValue(page())
})

describe('Minha fila', () => {
  it('o título vem antes das abas de seções', async () => {
    renderQueue()
    await screen.findByRole('table')
    const heading = screen.getByRole('heading', { level: 1, name: 'Minha fila' })
    const tabs = screen.getByRole('navigation', { name: 'Seções da fila' })
    expect(heading.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('abre em "Atribuídos a mim" consultando só chamados do técnico em andamento', async () => {
    renderQueue()
    await screen.findByRole('table')
    expect(lastScope()).toEqual({ assignedTo: 'user-1', activeOnly: true })
    expect(screen.getByRole('link', { name: /Atribuídos a mim/ })).toHaveAttribute('aria-current', 'page')
  })

  it('mostra a contagem real de cada aba', async () => {
    ticketServiceMock.countTickets.mockImplementation(async (_uid: string, scope: { priority?: string }) => (scope.priority === 'critical' ? 4 : 1))
    renderQueue()
    const critical = await screen.findByRole('link', { name: /Críticos/ })
    await waitFor(() => expect(critical).toHaveTextContent('4'))
  })

  it.each([
    ['unassigned', { unassigned: true, activeOnly: true }],
    ['critical', { priority: 'critical', activeOnly: true }],
    ['waiting', { assignedTo: 'user-1', status: 'waiting_requester' }],
  ])('aba %s usa o escopo correto', async (tab, expected) => {
    renderQueue(`/minha-fila?tab=${tab}`)
    await screen.findByRole('table')
    expect(lastScope()).toEqual(expected)
  })

  it('aba "recentes" usa janela de atualização estável', async () => {
    renderQueue('/minha-fila?tab=recent')
    await screen.findByRole('table')
    expect(lastScope()).toMatchObject({ assignedTo: 'user-1', updatedSince: expect.any(String) })
  })

  it('não oferece filtro redundante com o preset da aba', async () => {
    const { unmount } = renderQueue('/minha-fila?tab=critical')
    await screen.findByRole('table')
    expect(screen.queryByLabelText('Prioridade')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Status')).toBeInTheDocument()
    unmount()

    renderQueue('/minha-fila?tab=waiting')
    await screen.findByRole('table')
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Prioridade')).toBeInTheDocument()
  })

  it('filtrar mantém a aba ativa', async () => {
    renderQueue('/minha-fila?tab=unassigned')
    await screen.findByRole('table')
    await userEvent.selectOptions(screen.getByLabelText('Prioridade'), 'high')
    await waitFor(() => expect(ticketServiceMock.listTickets.mock.calls.at(-1)?.[0]).toMatchObject({ priority: 'high' }))
    expect(lastScope()).toEqual({ unassigned: true, activeOnly: true })
    expect(screen.getByRole('link', { name: /Sem responsável/ })).toHaveAttribute('aria-current', 'page')
  })

  it('estado vazio específico da aba, sem convite para abrir chamado', async () => {
    ticketServiceMock.listTickets.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 })
    renderQueue('/minha-fila?tab=critical')
    expect(await screen.findByText('Nenhum chamado crítico')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Abrir chamado/ })).not.toBeInTheDocument()
  })

  it('trocar de aba leva à nova seleção', async () => {
    renderQueue()
    await screen.findByRole('table')
    await userEvent.click(screen.getByRole('link', { name: /Críticos/ }))
    await waitFor(() => expect(lastScope()).toEqual({ priority: 'critical', activeOnly: true }))
  })
})
