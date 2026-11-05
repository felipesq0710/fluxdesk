import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { toast } from 'sonner'
import TicketDetailPage from '@/pages/tickets/TicketDetailPage'
import { getAppSettings } from '@/services/settings'
import { TICKET_ID, makeAttachment, makeComment, makeHistory, makeTicket } from '@/test/fixtures'
import { resetTicketServiceMock, ticketServiceMock } from '@/test/ticketServiceMock'
import { authAs, renderWithProviders } from '@/test/utils'
import type { UserRole } from '@/types/domain'

vi.mock('@/services/tickets', async () => (await import('@/test/ticketServiceMock')).ticketServiceMock)
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() }, Toaster: () => null }))

function renderDetail(role: UserRole, route = `/chamados/${TICKET_ID}`) {
  return renderWithProviders(
    <Routes>
      <Route path="/chamados/:id" element={<TicketDetailPage />} />
      <Route path="/chamados" element={<p>lista de chamados</p>} />
    </Routes>,
    { auth: authAs(role), route },
  )
}

beforeEach(() => {
  resetTicketServiceMock()
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.error).mockClear()
})

describe('detalhe do chamado', () => {
  it('apresenta informações principais, conversa, histórico e anexos', async () => {
    ticketServiceMock.getTicket.mockResolvedValue(makeTicket({ status: 'in_progress', assignee_id: 'tech-1', assignee: { id: 'tech-1', full_name: 'Tiago Técnico' } }))
    ticketServiceMock.listComments.mockResolvedValue([makeComment()])
    ticketServiceMock.listHistory.mockResolvedValue([makeHistory(), makeHistory({ id: 'h-2', event_type: 'priority_changed', old_value: 'low', new_value: 'high', actor: { full_name: 'Tiago Técnico' } })])
    ticketServiceMock.listAttachments.mockResolvedValue([makeAttachment()])
    renderDetail('requester')

    expect(await screen.findByRole('heading', { name: 'Impressora offline', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('FLX-000001')).toBeInTheDocument()
    expect(screen.getAllByText('Em atendimento').length).toBeGreaterThan(0)
    expect(screen.getByText('A impressora do setor financeiro não responde.')).toBeInTheDocument()

    expect(await screen.findByText('Estamos verificando.')).toBeInTheDocument()
    expect(await screen.findByText('Prioridade: Baixa → Alta')).toBeInTheDocument()
    expect(await screen.findByText('print.png')).toBeInTheDocument()
    const details = screen.getByRole('heading', { name: 'Detalhes' }).closest('section')!
    expect(within(details).getByText('Tiago Técnico')).toBeInTheDocument()
  })

  it('chamado inexistente, sem permissão ou com id inválido mostra "não encontrado" sem consultar', async () => {
    ticketServiceMock.getTicket.mockResolvedValue(null)
    const { unmount } = renderDetail('requester')
    expect(await screen.findByText('Chamado não encontrado')).toBeInTheDocument()
    unmount()

    ticketServiceMock.getTicket.mockClear()
    renderDetail('requester', '/chamados/nao-e-uuid')
    expect(await screen.findByText('Chamado não encontrado')).toBeInTheDocument()
    expect(ticketServiceMock.getTicket).not.toHaveBeenCalled()
  })

  it('erro ao carregar permite tentar novamente', async () => {
    ticketServiceMock.getTicket.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    renderDetail('requester')
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha de conexão')
    ticketServiceMock.getTicket.mockResolvedValue(makeTicket())
    await userEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))
    expect(await screen.findByRole('heading', { name: 'Impressora offline', level: 1 })).toBeInTheDocument()
  })
})

describe('comentários públicos × notas internas', () => {
  it('solicitante só envia mensagem pública e não vê o seletor de nota interna', async () => {
    ticketServiceMock.getTicket.mockResolvedValue(makeTicket({ assignee_id: 'tech-1', status: 'in_progress' }))
    renderDetail('requester')

    await screen.findByRole('heading', { name: 'Impressora offline', level: 1 })
    expect(screen.queryByLabelText('Nota interna')).not.toBeInTheDocument()
    expect(screen.queryByText('Tipo de mensagem')).not.toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Mensagem'), 'Continua offline.')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar mensagem' }))
    await waitFor(() => expect(ticketServiceMock.addComment).toHaveBeenCalledWith(TICKET_ID, 'user-1', 'public', 'Continua offline.'))
  })

  it('técnico atribuído registra nota interna, claramente identificada', async () => {
    ticketServiceMock.getTicket.mockResolvedValue(makeTicket({ assignee_id: 'user-1', status: 'in_progress' }))
    ticketServiceMock.listComments.mockResolvedValue([makeComment({ id: 'n-1', kind: 'internal', body: 'Reiniciar o spooler remoto.' })])
    renderDetail('technician')

    expect(await screen.findByText('Reiniciar o spooler remoto.')).toBeInTheDocument()
    expect(screen.getByText(/Nota interna · visível apenas à equipe/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: /Nota interna/ }))
    expect(screen.getByText(/O solicitante não é notificado/)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Nota interna', { selector: 'textarea' }), 'Peça trocada.')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar nota interna' }))
    await waitFor(() => expect(ticketServiceMock.addComment).toHaveBeenCalledWith(TICKET_ID, 'user-1', 'internal', 'Peça trocada.'))
  })

  it('valida mensagem vazia sem chamar o serviço', async () => {
    ticketServiceMock.getTicket.mockResolvedValue(makeTicket())
    renderDetail('requester')
    await screen.findByRole('heading', { name: 'Impressora offline', level: 1 })
    await userEvent.click(screen.getByRole('button', { name: 'Enviar mensagem' }))
    expect(await screen.findByText('Escreva uma mensagem.')).toBeInTheDocument()
    expect(ticketServiceMock.addComment).not.toHaveBeenCalled()
  })

  it('técnico sem o chamado é orientado a assumi-lo e não vê o formulário', async () => {
    ticketServiceMock.getTicket.mockResolvedValue(makeTicket({ requester_id: 'outro' }))
    renderDetail('technician')
    expect(await screen.findByText('Assuma o chamado para registrar mensagens e notas.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Enviar mensagem' })).not.toBeInTheDocument()
  })

  it('chamado encerrado bloqueia mensagens e anexos', async () => {
    ticketServiceMock.getTicket.mockResolvedValue(makeTicket({ status: 'closed', assignee_id: 'tech-1' }))
    renderDetail('requester')
    expect(await screen.findByText(/está encerrado e não aceita novas mensagens/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Adicionar anexos')).not.toBeInTheDocument()
  })

  it('mostra erro traduzido quando o envio falha', async () => {
    ticketServiceMock.getTicket.mockResolvedValue(makeTicket())
    ticketServiceMock.addComment.mockRejectedValue({ code: '42501', message: 'new row violates row-level security policy' })
    renderDetail('requester')
    await screen.findByRole('heading', { name: 'Impressora offline', level: 1 })
    await userEvent.type(screen.getByLabelText('Mensagem'), 'Olá')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar mensagem' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Você não tem permissão para realizar esta ação.')
  })

  it('o conteúdo da mensagem é exibido como texto, nunca como HTML', async () => {
    ticketServiceMock.getTicket.mockResolvedValue(makeTicket())
    ticketServiceMock.listComments.mockResolvedValue([makeComment({ body: '<img src=x onerror=alert(1)> <b>oi</b>' })])
    const { container } = renderDetail('requester')
    expect(await screen.findByText('<img src=x onerror=alert(1)> <b>oi</b>')).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
  })
})

describe('ações por perfil', () => {
  it('técnico assume o chamado', async () => {
    ticketServiceMock.getTicket.mockResolvedValue(makeTicket({ requester_id: 'outro' }))
    renderDetail('technician')
    await userEvent.click(await screen.findByRole('button', { name: 'Assumir chamado' }))
    await waitFor(() => expect(ticketServiceMock.updateTicket).toHaveBeenCalledWith(TICKET_ID, { assignee_id: 'user-1' }))
    expect(toast.success).toHaveBeenCalledWith('Você assumiu o chamado.')
  })

  it('técnico altera status e prioridade do próprio chamado', async () => {
    ticketServiceMock.getTicket.mockResolvedValue(makeTicket({ assignee_id: 'user-1', status: 'in_progress', requester_id: 'outro' }))
    renderDetail('technician')
    await userEvent.selectOptions(await screen.findByLabelText('Status'), 'waiting_requester')
    await waitFor(() => expect(ticketServiceMock.updateTicket).toHaveBeenCalledWith(TICKET_ID, { status: 'waiting_requester' }))

    await userEvent.selectOptions(screen.getByLabelText('Prioridade'), 'critical')
    await waitFor(() => expect(ticketServiceMock.updateTicket).toHaveBeenCalledWith(TICKET_ID, { priority: 'critical' }))
  })

  it('liberar chamado devolve à fila com status "Aberto"', async () => {
    ticketServiceMock.getTicket.mockResolvedValue(makeTicket({ assignee_id: 'user-1', status: 'in_progress', requester_id: 'outro' }))
    renderDetail('technician')
    await userEvent.click(await screen.findByRole('button', { name: 'Liberar chamado' }))
    await waitFor(() => expect(ticketServiceMock.updateTicket).toHaveBeenCalledWith(TICKET_ID, { assignee_id: null, status: 'open' }))
  })

  it('técnico não vê ações em chamado de outro técnico', async () => {
    ticketServiceMock.getTicket.mockResolvedValue(makeTicket({ assignee_id: 'tech-9', status: 'in_progress', requester_id: 'outro' }))
    renderDetail('technician')
    expect(await screen.findByText('Você não tem ações disponíveis para este chamado.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument()
  })

  it('encerrar exige confirmação; cancelar não altera nada', async () => {
    ticketServiceMock.getTicket.mockResolvedValue(makeTicket({ assignee_id: 'tech-1', status: 'in_progress', requester_id: 'outro' }))
    renderDetail('admin')
    await userEvent.selectOptions(await screen.findByLabelText('Status'), 'closed')

    const dialog = await screen.findByRole('alertdialog', { name: 'Encerrar chamado?' })
    expect(ticketServiceMock.updateTicket).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(ticketServiceMock.updateTicket).not.toHaveBeenCalled()

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'closed')
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Encerrar chamado' }))
    await waitFor(() => expect(ticketServiceMock.updateTicket).toHaveBeenCalledWith(TICKET_ID, { status: 'closed' }))
  })

  it('administrador precisa atribuir responsável antes de iniciar o atendimento', async () => {
    ticketServiceMock.getTicket.mockResolvedValue(makeTicket({ requester_id: 'outro' }))
    ticketServiceMock.listStaff.mockResolvedValue([{ id: 'tech-1', full_name: 'Tiago Técnico', role: 'technician' }])
    renderDetail('admin')
    const status = await screen.findByLabelText('Status')
    expect(within(status).getByRole('option', { name: 'Em atendimento' })).toBeDisabled()
    expect(screen.getByText(/Atribua um responsável para liberar o atendimento/)).toBeInTheDocument()

    await userEvent.selectOptions(await screen.findByLabelText('Responsável'), 'tech-1')
    await waitFor(() => expect(ticketServiceMock.updateTicket).toHaveBeenCalledWith(TICKET_ID, { assignee_id: 'tech-1' }))
  })

  it('solicitante confirma a resolução (com confirmação) ou reabre', async () => {
    ticketServiceMock.getTicket.mockResolvedValue(makeTicket({ status: 'resolved', assignee_id: 'tech-1' }))
    renderDetail('requester')
    await userEvent.click(await screen.findByRole('button', { name: 'Reabrir chamado' }))
    await waitFor(() => expect(ticketServiceMock.updateTicket).toHaveBeenCalledWith(TICKET_ID, { status: 'open' }))

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar resolução' }))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Confirmar e encerrar' }))
    await waitFor(() => expect(ticketServiceMock.updateTicket).toHaveBeenCalledWith(TICKET_ID, { status: 'closed' }))
  })

  it('fora do prazo configurado, o solicitante não pode reabrir o chamado resolvido', async () => {
    vi.mocked(getAppSettings).mockResolvedValue({ allow_requester_priority: true, requester_reopen_days: 3, updated_at: '' })
    ticketServiceMock.getTicket.mockResolvedValue(makeTicket({ status: 'resolved', assignee_id: 'tech-1', resolved_at: '2026-01-01T00:00:00Z' }))
    renderDetail('requester')
    expect(await screen.findByText(/O prazo de 3 dia\(s\) para reabrir este chamado terminou/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reabrir chamado' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar resolução' })).toBeInTheDocument()
    vi.mocked(getAppSettings).mockResolvedValue({ allow_requester_priority: true, requester_reopen_days: null, updated_at: '' })
  })

  it('solicitante não tem controles de status, prioridade ou responsável', async () => {
    ticketServiceMock.getTicket.mockResolvedValue(makeTicket({ status: 'in_progress', assignee_id: 'tech-1' }))
    renderDetail('requester')
    await screen.findByRole('heading', { name: 'Impressora offline', level: 1 })
    for (const label of ['Status', 'Prioridade', 'Responsável']) expect(screen.queryByLabelText(label)).not.toBeInTheDocument()
    expect(screen.getByText('Nenhuma ação necessária de sua parte no momento.')).toBeInTheDocument()
  })

  it('solicitante é avisado quando o chamado aguarda sua resposta', async () => {
    ticketServiceMock.getTicket.mockResolvedValue(makeTicket({ status: 'waiting_requester', assignee_id: 'tech-1' }))
    renderDetail('requester')
    expect(await screen.findByText('A equipe aguarda sua resposta')).toBeInTheDocument()
  })

  it('falha de permissão no banco aparece como mensagem clara', async () => {
    ticketServiceMock.getTicket.mockResolvedValue(makeTicket({ requester_id: 'outro' }))
    ticketServiceMock.updateTicket.mockRejectedValue({ code: '42501', message: 'Este chamado está atribuído a outro técnico.' })
    renderDetail('technician')
    await userEvent.click(await screen.findByRole('button', { name: 'Assumir chamado' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Este chamado está atribuído a outro técnico.'))
  })
})

describe('edição do chamado', () => {
  it('solicitante edita enquanto aberto e sem responsável; envia só o que mudou', async () => {
    ticketServiceMock.getTicket.mockResolvedValue(makeTicket())
    renderDetail('requester')
    await userEvent.click(await screen.findByRole('button', { name: 'Editar chamado' }))
    const title = screen.getByLabelText(/Título/)
    await userEvent.clear(title)
    await userEvent.type(title, 'Impressora do financeiro')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(ticketServiceMock.updateTicket).toHaveBeenCalledWith(TICKET_ID, { title: 'Impressora do financeiro' }))
  })

  it('não oferece edição quando já há responsável', async () => {
    ticketServiceMock.getTicket.mockResolvedValue(makeTicket({ assignee_id: 'tech-1', status: 'in_progress' }))
    renderDetail('requester')
    await screen.findByRole('heading', { name: 'Impressora offline', level: 1 })
    expect(screen.queryByRole('button', { name: 'Editar chamado' })).not.toBeInTheDocument()
  })

  it('valida os campos na edição', async () => {
    ticketServiceMock.getTicket.mockResolvedValue(makeTicket())
    renderDetail('requester')
    await userEvent.click(await screen.findByRole('button', { name: 'Editar chamado' }))
    await userEvent.clear(screen.getByLabelText(/Título/))
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByText('O título deve ter ao menos 3 caracteres.')).toBeInTheDocument()
    expect(ticketServiceMock.updateTicket).not.toHaveBeenCalled()
  })
})

describe('anexos', () => {
  it('só mostra "Remover" nos anexos do próprio usuário (administrador remove qualquer um)', async () => {
    const attachments = [makeAttachment(), makeAttachment({ id: 'a-2', uploader_id: 'tech-1', file_name: 'log.txt', mime_type: 'text/plain' })]
    ticketServiceMock.getTicket.mockResolvedValue(makeTicket({ assignee_id: 'tech-1', status: 'in_progress' }))
    ticketServiceMock.listAttachments.mockResolvedValue(attachments)
    const { unmount } = renderDetail('requester')
    await screen.findByText('log.txt')
    expect(screen.getByRole('button', { name: 'Remover print.png' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remover log.txt' })).not.toBeInTheDocument()
    unmount()

    renderDetail('admin')
    await screen.findByText('log.txt')
    expect(screen.getByRole('button', { name: 'Remover log.txt' })).toBeInTheDocument()
  })

  it('remoção exige confirmação', async () => {
    ticketServiceMock.getTicket.mockResolvedValue(makeTicket())
    ticketServiceMock.listAttachments.mockResolvedValue([makeAttachment()])
    ticketServiceMock.deleteAttachment.mockResolvedValue(undefined)
    renderDetail('requester')
    await userEvent.click(await screen.findByRole('button', { name: 'Remover print.png' }))
    expect(ticketServiceMock.deleteAttachment).not.toHaveBeenCalled()
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remover' }))
    await waitFor(() => expect(ticketServiceMock.deleteAttachment).toHaveBeenCalledWith(expect.objectContaining({ id: 'a-1' })))
  })

  it('envia arquivos selecionados e informa falhas parciais', async () => {
    ticketServiceMock.getTicket.mockResolvedValue(makeTicket())
    ticketServiceMock.uploadAttachments.mockResolvedValue({ uploaded: 1, failed: [{ name: 'b.png', error: new Error('x') }] })
    renderDetail('requester')
    await screen.findByLabelText('Adicionar anexos')
    const user = userEvent.setup({ applyAccept: false })
    await user.upload(screen.getByLabelText('Adicionar anexos'), [
      new File(['a'], 'a.png', { type: 'image/png' }),
      new File(['b'], 'b.png', { type: 'image/png' }),
    ])
    await user.click(screen.getByRole('button', { name: 'Enviar 2 arquivos' }))
    await waitFor(() => expect(ticketServiceMock.uploadAttachments).toHaveBeenCalledWith(TICKET_ID, 'user-1', expect.any(Array)))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Não foi possível enviar: b.png.'))
    // Apenas o arquivo que falhou permanece na seleção.
    expect(screen.getByRole('button', { name: 'Remover b.png' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remover a.png' })).not.toBeInTheDocument()
  })

  it('captura uma falha inesperada no upload, preserva os arquivos para nova tentativa e encerra o loading', async () => {
    ticketServiceMock.getTicket.mockResolvedValue(makeTicket())
    ticketServiceMock.uploadAttachments.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    renderDetail('requester')
    await screen.findByLabelText('Adicionar anexos')
    const user = userEvent.setup({ applyAccept: false })
    await user.upload(screen.getByLabelText('Adicionar anexos'), new File(['x'], 'print.png', { type: 'image/png' }))
    await user.click(screen.getByRole('button', { name: 'Enviar arquivo' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Falha de conexão. Verifique sua internet e tente novamente.'))
    expect(screen.getByRole('button', { name: 'Enviar arquivo' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Remover print.png' })).toBeInTheDocument()
  })
})
