import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { toast } from 'sonner'
import NewTicketPage from '@/pages/tickets/NewTicketPage'
import { getAppSettings } from '@/services/settings'
import { CATEGORY_ID, TICKET_ID } from '@/test/fixtures'
import { resetTicketServiceMock, ticketServiceMock } from '@/test/ticketServiceMock'
import { authAs, renderWithProviders } from '@/test/utils'

vi.mock('@/services/tickets', async () => (await import('@/test/ticketServiceMock')).ticketServiceMock)
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() }, Toaster: () => null }))

function renderNew() {
  return renderWithProviders(
    <Routes>
      <Route path="/chamados/novo" element={<NewTicketPage />} />
      <Route path="/chamados/:id" element={<p>detalhe do chamado</p>} />
    </Routes>,
    { auth: authAs('requester'), route: '/chamados/novo' },
  )
}

async function fillValid() {
  await userEvent.type(screen.getByLabelText(/Título/), 'Impressora offline')
  await userEvent.selectOptions(await screen.findByLabelText(/Categoria/), CATEGORY_ID)
  await userEvent.type(screen.getByLabelText(/Descrição/), 'A impressora do setor não responde.')
}

beforeEach(() => {
  resetTicketServiceMock()
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.warning).mockClear()
  ticketServiceMock.createTicket.mockResolvedValue({ id: TICKET_ID, code: 'FLX-000001' })
})

describe('abertura de chamado', () => {
  it('mostra erros por campo e não cria nada com formulário vazio', async () => {
    renderNew()
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir chamado' }))
    expect(await screen.findByText('O título deve ter ao menos 3 caracteres.')).toBeInTheDocument()
    expect(screen.getByText('Selecione uma categoria.')).toBeInTheDocument()
    expect(screen.getByText('Descreva o problema com ao menos 10 caracteres.')).toBeInTheDocument()
    expect(ticketServiceMock.createTicket).not.toHaveBeenCalled()
  })

  it('marca campos obrigatórios e liga as mensagens de erro aos campos (acessibilidade)', async () => {
    renderNew()
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir chamado' }))
    const title = screen.getByLabelText(/Título/)
    await waitFor(() => expect(title).toHaveAttribute('aria-invalid', 'true'))
    expect(title).toHaveAttribute('aria-required', 'true')
    expect(title.getAttribute('aria-describedby')).toBeTruthy()
  })

  it('cria o chamado com o solicitante autenticado e navega para o detalhe', async () => {
    renderNew()
    await fillValid()
    await userEvent.selectOptions(screen.getByLabelText(/Prioridade/), 'critical')
    await userEvent.click(screen.getByRole('button', { name: 'Abrir chamado' }))

    await waitFor(() =>
      expect(ticketServiceMock.createTicket).toHaveBeenCalledWith(
        { title: 'Impressora offline', description: 'A impressora do setor não responde.', categoryId: CATEGORY_ID, priority: 'critical' },
        'user-1',
      ),
    )
    expect(await screen.findByText('detalhe do chamado')).toBeInTheDocument()
    expect(toast.success).toHaveBeenCalledWith('Chamado FLX-000001 aberto com sucesso.')
    expect(ticketServiceMock.uploadAttachments).not.toHaveBeenCalled()
  })

  it('envia anexos após criar o chamado', async () => {
    ticketServiceMock.uploadAttachments.mockResolvedValue({ uploaded: 1, failed: [] })
    renderNew()
    await fillValid()
    const user = userEvent.setup({ applyAccept: false })
    await user.upload(screen.getByLabelText('Anexos'), new File(['x'], 'print.png', { type: 'image/png' }))
    await user.click(screen.getByRole('button', { name: 'Abrir chamado' }))
    await waitFor(() => expect(ticketServiceMock.uploadAttachments).toHaveBeenCalledWith(TICKET_ID, 'user-1', [expect.objectContaining({ name: 'print.png' })]))
    expect(await screen.findByText('detalhe do chamado')).toBeInTheDocument()
  })

  it('chamado é criado mesmo se um anexo falhar, e o usuário é avisado', async () => {
    ticketServiceMock.uploadAttachments.mockResolvedValue({ uploaded: 0, failed: [{ name: 'print.png', error: new Error('x') }] })
    renderNew()
    await fillValid()
    const user = userEvent.setup({ applyAccept: false })
    await user.upload(screen.getByLabelText('Anexos'), new File(['x'], 'print.png', { type: 'image/png' }))
    await user.click(screen.getByRole('button', { name: 'Abrir chamado' }))
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('print.png')))
    expect(await screen.findByText('detalhe do chamado')).toBeInTheDocument()
  })

  it('captura uma rejeição inesperada do upload sem tentar criar o chamado de novo', async () => {
    ticketServiceMock.uploadAttachments.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    renderNew()
    await fillValid()
    const user = userEvent.setup({ applyAccept: false })
    await user.upload(screen.getByLabelText('Anexos'), new File(['x'], 'print.png', { type: 'image/png' }))
    await user.click(screen.getByRole('button', { name: 'Abrir chamado' }))

    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('Falha de conexão')))
    expect(ticketServiceMock.createTicket).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('detalhe do chamado')).toBeInTheDocument()
  })

  it('exibe o erro do banco e permanece no formulário', async () => {
    ticketServiceMock.createTicket.mockRejectedValue({ code: '23514', message: 'Categoria inválida ou inativa.' })
    renderNew()
    await fillValid()
    await userEvent.click(screen.getByRole('button', { name: 'Abrir chamado' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Categoria inválida ou inativa.')
    expect(screen.queryByText('detalhe do chamado')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Título/)).toHaveValue('Impressora offline')
  })

  it('sem categorias ativas, avisa e impede o envio', async () => {
    ticketServiceMock.listCategories.mockResolvedValue([])
    renderNew()
    expect(await screen.findByText('Nenhuma categoria disponível')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir chamado' })).toBeDisabled()
  })

  it('falha ao carregar categorias permite tentar de novo', async () => {
    ticketServiceMock.listCategories.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    renderNew()
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha de conexão')
    await userEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))
    expect(await screen.findByLabelText(/Categoria/)).toBeInTheDocument()
  })

  it('com a prioridade controlada pela equipe, o solicitante não a escolhe e o chamado segue como "Média"', async () => {
    vi.mocked(getAppSettings).mockResolvedValue({ allow_requester_priority: false, requester_reopen_days: null, updated_at: '' })
    renderNew()
    await userEvent.type(screen.getByLabelText(/Título/), 'Impressora offline')
    await userEvent.selectOptions(await screen.findByLabelText(/Categoria/), CATEGORY_ID)
    await userEvent.type(screen.getByLabelText(/Descrição/), 'A impressora do setor não responde.')
    await waitFor(() => expect(screen.queryByLabelText(/Prioridade/)).not.toBeInTheDocument())
    expect(screen.getByText(/definida pela equipe de suporte/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Abrir chamado' }))
    await waitFor(() => expect(ticketServiceMock.createTicket).toHaveBeenCalledWith(expect.objectContaining({ priority: 'medium' }), 'user-1'))
    vi.mocked(getAppSettings).mockResolvedValue({ allow_requester_priority: true, requester_reopen_days: null, updated_at: '' })
  })
})
