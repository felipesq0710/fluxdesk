import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@/contexts/ThemeContext'
import AppLayout from '@/layouts/AppLayout'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
import CategoriesPage from '@/pages/admin/CategoriesPage'
import DashboardPage from '@/pages/reports/DashboardPage'
import KnowledgePage from '@/pages/knowledge/KnowledgePage'
import NewTicketPage from '@/pages/tickets/NewTicketPage'
import TicketsPage from '@/pages/tickets/TicketsPage'
import SettingsPage from '@/pages/SettingsPage'
import ArticleEditorPage from '@/pages/knowledge/ArticleEditorPage'
import UsersPage from '@/pages/admin/UsersPage'
import { makeTicket } from '@/test/fixtures'
import { resetTicketServiceMock, ticketServiceMock } from '@/test/ticketServiceMock'
import { authAs, makeAuth, makeProfile, renderWithProviders } from '@/test/utils'

vi.mock('@/services/tickets', async () => (await import('@/test/ticketServiceMock')).ticketServiceMock)
vi.mock('@/services/notifications', () => ({
  listNotifications: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 20 })),
  countUnread: vi.fn(async () => 2),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
}))
vi.mock('@/services/reports', () => ({ fetchReport: vi.fn(async () => (await import('@/test/reportFixtures')).makeReport()), fetchTicketsForExport: vi.fn(), EXPORT_MAX_ROWS: 10_000 }))
vi.mock('@/services/articles', () => ({
  listArticles: vi.fn(async () => ({
    items: [{ id: 'a1', title: 'Guia', category_id: null, author_id: 'x', status: 'published', tags: ['vpn'], created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', published_at: null, author: { full_name: 'Ana' }, category: null }],
    total: 1, page: 1, pageSize: 12,
  })),
}))
vi.mock('@/services/profiles', () => ({
  USER_PAGE_SIZE: 15,
  fetchProfile: vi.fn(),
  listUsers: vi.fn(async () => ({ items: [makeProfile({ id: 'u2', full_name: 'Ana', email: 'a@x.com' })], total: 1, page: 1, pageSize: 15 })),
  fetchUserStats: vi.fn(async () => ({})),
}))
vi.mock('@/services/categories', () => ({ fetchCategoryCounts: vi.fn(async () => ({})) }))

// O jsdom não calcula cores nem layout: contraste é verificado nas paletas, não aqui.
const AXE_OPTIONS = { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } }

async function expectNoViolations(container: HTMLElement) {
  const results = await axe(container, AXE_OPTIONS)
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`)).toEqual([])
}

beforeEach(() => {
  resetTicketServiceMock()
  ticketServiceMock.listTickets.mockResolvedValue({ items: [makeTicket()], total: 1, page: 1, pageSize: 20 })
})

describe('Acessibilidade (axe)', () => {
  it.each([
    ['login', <LoginPage key="l" />],
    ['cadastro', <RegisterPage key="r" />],
    ['recuperar senha', <ForgotPasswordPage key="f" />],
  ])('tela pública: %s', async (_name, ui) => {
    const { container } = renderWithProviders(ui, { auth: makeAuth() })
    await expectNoViolations(container)
  })

  const pages: [string, string, React.ReactElement, 'requester' | 'admin', string][] = [
    ['dashboard', '/', <DashboardPage key="d" />, 'admin', 'Total de chamados'],
    ['lista de chamados', '/chamados', <TicketsPage key="t" />, 'requester', 'table'],
    ['novo chamado', '/chamados/novo', <NewTicketPage key="n" />, 'requester', 'Novo chamado'],
    ['base de conhecimento', '/conhecimento', <KnowledgePage key="k" />, 'requester', 'Guia'],
    ['configurações (admin)', '/configuracoes', <SettingsPage key="s" />, 'admin', 'heading'],
    ['editor de artigo', '/conhecimento/novo', <ArticleEditorPage key="e" />, 'admin', 'heading'],
    ['usuários', '/usuarios', <UsersPage key="u" />, 'admin', 'rowheader'],
    ['categorias', '/categorias', <CategoriesPage key="c" />, 'admin', 'rowheader'],
  ]

  it.each(pages)('%s', async (_name, route, element, role, ready) => {
    const { container } = renderWithProviders(
      <ThemeProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path={route} element={element} />
          </Route>
        </Routes>
      </ThemeProvider>,
      { auth: authAs(role), route },
    )
    if (ready === 'table') await screen.findByRole('table')
    else if (ready === 'heading') await screen.findByRole('heading', { level: 1 })
    else if (ready === 'rowheader') await screen.findAllByRole('rowheader')
    else await screen.findByText(ready)
    await expectNoViolations(container)
  })
})
