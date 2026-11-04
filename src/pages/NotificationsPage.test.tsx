import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { toast } from 'sonner'
import NotificationsPage from '@/pages/NotificationsPage'
import { authAs, renderWithProviders } from '@/test/utils'
import type { AppNotification } from '@/types/domain'

const api = vi.hoisted(() => ({
  NOTIFICATIONS_PAGE_SIZE: 20,
  listNotifications: vi.fn(),
  countUnread: vi.fn(),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
}))
vi.mock('@/services/notifications', () => api)
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() }, Toaster: () => null }))

const note = (over: Partial<AppNotification> = {}): AppNotification => ({
  id: 'n-1',
  recipient_id: 'user-1',
  ticket_id: '7a1c2b3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
  type: 'comment_added',
  title: 'Nova mensagem em FLX-000001',
  body: 'A equipe de suporte respondeu ao seu chamado.',
  is_read: false,
  created_at: new Date().toISOString(),
  ...over,
})

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/notificacoes" element={<NotificationsPage />} />
      <Route path="/chamados/:id" element={<p>detalhe do chamado</p>} />
    </Routes>,
    { auth: authAs('requester'), route: '/notificacoes' },
  )
}

beforeEach(() => {
  Object.values(api).forEach((f) => typeof f === 'function' && 'mockReset' in f && f.mockReset())
  api.markRead.mockResolvedValue(undefined)
  api.markAllRead.mockResolvedValue(undefined)
})

describe('página de notificações', () => {
  it('lista notificações destacando as não lidas (com texto para leitores de tela)', async () => {
    api.listNotifications.mockResolvedValue({ items: [note(), note({ id: 'n-2', is_read: true, title: 'Chamado FLX-000002 resolvido' })], total: 2, page: 1 })
    renderPage()
    expect(await screen.findByText(/Não lida:/)).toBeInTheDocument()
    expect(screen.getByText('Chamado FLX-000002 resolvido')).toBeInTheDocument()
  })

  it('ao abrir uma notificação, marca como lida e navega para o chamado', async () => {
    api.listNotifications.mockResolvedValue({ items: [note()], total: 1, page: 1 })
    renderPage()
    await userEvent.click(await screen.findByRole('link', { name: /Nova mensagem em FLX-000001/ }))
    await waitFor(() => expect(api.markRead).toHaveBeenCalledWith('n-1'))
    expect(await screen.findByText('detalhe do chamado')).toBeInTheDocument()
  })

  it('não remarca notificações já lidas', async () => {
    api.listNotifications.mockResolvedValue({ items: [note({ is_read: true })], total: 1, page: 1 })
    renderPage()
    await userEvent.click(await screen.findByRole('link'))
    expect(api.markRead).not.toHaveBeenCalled()
  })

  it('marcar todas como lidas', async () => {
    api.listNotifications.mockResolvedValue({ items: [note()], total: 1, page: 1 })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar todas como lidas' }))
    await waitFor(() => expect(api.markAllRead).toHaveBeenCalled())
    expect(toast.success).toHaveBeenCalled()
  })

  it('filtro "Não lidas" consulta somente não lidas e volta à página 1', async () => {
    api.listNotifications.mockResolvedValue({ items: [note()], total: 1, page: 1 })
    renderPage()
    await screen.findByText('Nova mensagem em FLX-000001')
    await userEvent.click(screen.getByRole('button', { name: 'Não lidas' }))
    await waitFor(() => expect(api.listNotifications).toHaveBeenLastCalledWith(1, true))
  })

  it('estado vazio e erro', async () => {
    api.listNotifications.mockResolvedValueOnce({ items: [], total: 0, page: 1 })
    const { unmount } = renderPage()
    expect(await screen.findByText('Nenhuma notificação ainda')).toBeInTheDocument()
    unmount()

    api.listNotifications.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha de conexão')
  })
})
