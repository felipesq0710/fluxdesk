import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import CategoriesPage from '@/pages/admin/CategoriesPage'
import UsersPage from '@/pages/admin/UsersPage'
import { resetTicketServiceMock, ticketServiceMock } from '@/test/ticketServiceMock'
import { authAs, makeProfile, renderWithProviders } from '@/test/utils'

const profiles = vi.hoisted(() => ({
  listUsers: vi.fn(),
  fetchUserStats: vi.fn(),
  updateUserRole: vi.fn(),
  setUserActive: vi.fn(),
  fetchProfile: vi.fn(),
}))
const cats = vi.hoisted(() => ({ fetchCategoryCounts: vi.fn(), createCategory: vi.fn(), updateCategory: vi.fn(), setCategoryActive: vi.fn() }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }))

vi.mock('@/services/tickets', async () => (await import('@/test/ticketServiceMock')).ticketServiceMock)
vi.mock('@/services/profiles', () => ({ ...profiles, USER_PAGE_SIZE: 15 }))
vi.mock('@/services/categories', () => cats)
vi.mock('sonner', () => ({ toast, Toaster: () => null }))

const ana = makeProfile({ id: 'u-ana', full_name: 'Ana Técnica', email: 'ana@x.com', role: 'technician' })
const me = makeProfile({ id: 'user-1', full_name: 'Admin Logado', email: 'adm@x.com', role: 'admin' })

beforeEach(() => {
  vi.clearAllMocks()
  resetTicketServiceMock()
  profiles.listUsers.mockResolvedValue({ items: [me, ana], total: 2, page: 1, pageSize: 15 })
  profiles.fetchUserStats.mockResolvedValue({ 'u-ana': { user_id: 'u-ana', requested: 1, assigned: 5, assigned_open: 3 } })
  profiles.updateUserRole.mockResolvedValue(undefined)
  profiles.setUserActive.mockResolvedValue(undefined)
  cats.fetchCategoryCounts.mockResolvedValue({ 'cat-1': { total: 9, active: 4 } })
  cats.createCategory.mockResolvedValue(undefined)
  cats.updateCategory.mockResolvedValue(undefined)
  cats.setCategoryActive.mockResolvedValue(undefined)
  ticketServiceMock.listCategories.mockResolvedValue([
    { id: 'cat-1', name: 'Software', description: 'Apps', is_active: true, created_at: '', updated_at: '' },
    { id: 'cat-2', name: 'Legado', description: null, is_active: false, created_at: '', updated_at: '' },
  ])
})

const rowOf = async (name: string) => (await screen.findByRole('rowheader', { name: new RegExp(name) })).closest('tr')!
const renderUsers = () =>
  renderWithProviders(<Routes><Route path="/usuarios" element={<UsersPage />} /></Routes>, { auth: authAs('admin'), route: '/usuarios' })
const renderCats = () =>
  renderWithProviders(<Routes><Route path="/categorias" element={<CategoriesPage />} /></Routes>, { auth: authAs('admin'), route: '/categorias' })

describe('Usuários', () => {
  it('lista usuários com contagens reais e bloqueia ações sobre a própria conta', async () => {
    renderUsers()
    const row = await rowOf('Ana Técnica')
    expect(within(row).getByText('5 (3)')).toBeInTheDocument()
    const mine = await rowOf('Admin Logado')
    expect(within(mine).getByRole('combobox')).toBeDisabled()
    expect(within(mine).getByRole('button', { name: /Desativar/ })).toBeDisabled()
  })

  it('alterar perfil exige confirmação', async () => {
    renderUsers()
    const row = await rowOf('Ana Técnica')
    await userEvent.selectOptions(within(row).getByRole('combobox'), 'admin')
    expect(profiles.updateUserRole).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Alterar perfil' }))
    await waitFor(() => expect(profiles.updateUserRole).toHaveBeenCalledWith('u-ana', 'admin'))
    expect(toast.success).toHaveBeenCalled()
  })

  it('cancelar a confirmação não altera nada', async () => {
    renderUsers()
    const row = await rowOf('Ana Técnica')
    await userEvent.selectOptions(within(row).getByRole('combobox'), 'requester')
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(profiles.updateUserRole).not.toHaveBeenCalled()
  })

  it('desativar avisa sobre chamados em aberto atribuídos', async () => {
    renderUsers()
    const row = await rowOf('Ana Técnica')
    await userEvent.click(within(row).getByRole('button', { name: /Desativar/ }))
    expect(screen.getByText(/3 chamados em aberto atribuídos/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Desativar' }))
    await waitFor(() => expect(profiles.setUserActive).toHaveBeenCalledWith('u-ana', false))
  })

  it('mostra a mensagem do banco quando a regra recusa (último administrador)', async () => {
    profiles.setUserActive.mockRejectedValue({ message: 'É necessário manter ao menos um administrador ativo.', code: '23514' })
    renderUsers()
    const row = await rowOf('Ana Técnica')
    await userEvent.click(within(row).getByRole('button', { name: /Desativar/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Desativar' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('É necessário manter ao menos um administrador ativo.'))
  })

  it('filtra por perfil', async () => {
    renderUsers()
    await rowOf('Ana Técnica')
    await userEvent.selectOptions(screen.getByLabelText('Perfil'), 'technician')
    await waitFor(() => expect(profiles.listUsers.mock.calls.at(-1)?.[0]).toMatchObject({ role: 'technician', page: 1 }))
  })
})

describe('Categorias', () => {
  it('lista com contagens e situação', async () => {
    renderCats()
    const row = await rowOf('Software')
    expect(within(row).getByText('9')).toBeInTheDocument()
    expect(within(row).getByText('Ativa')).toBeInTheDocument()
    expect(within(await rowOf('Legado')).getByText('Inativa')).toBeInTheDocument()
  })

  it('cria categoria validando o nome', async () => {
    renderCats()
    await userEvent.click(await screen.findByRole('button', { name: /Nova categoria/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Criar categoria' }))
    await screen.findByText(/nome precisa ter ao menos 2/)
    await userEvent.type(screen.getByLabelText(/Nome/), 'Acessos')
    await userEvent.click(screen.getByRole('button', { name: 'Criar categoria' }))
    await waitFor(() => expect(cats.createCategory).toHaveBeenCalledWith({ name: 'Acessos', description: null }))
  })

  it('nome duplicado mostra mensagem específica', async () => {
    cats.createCategory.mockRejectedValue({ code: '23505', message: 'duplicate' })
    renderCats()
    await userEvent.click(await screen.findByRole('button', { name: /Nova categoria/ }))
    await userEvent.type(screen.getByLabelText(/Nome/), 'Software')
    await userEvent.click(screen.getByRole('button', { name: 'Criar categoria' }))
    await screen.findByText('Já existe uma categoria com este nome.')
  })

  it('edita categoria existente', async () => {
    renderCats()
    await userEvent.click(await screen.findByRole('button', { name: /Editar\s*Software/ }))
    const name = screen.getByLabelText(/Nome/)
    expect(name).toHaveValue('Software')
    await userEvent.clear(name)
    await userEvent.type(name, 'Aplicativos')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(cats.updateCategory).toHaveBeenCalledWith('cat-1', { name: 'Aplicativos', description: 'Apps' }))
  })

  it('desativar avisa sobre chamados em aberto e mostra a regra da última categoria ativa', async () => {
    cats.setCategoryActive.mockRejectedValue({ code: '23514', message: 'É necessário manter ao menos uma categoria ativa.' })
    renderCats()
    await userEvent.click(await screen.findByRole('button', { name: /Desativar\s*Software/ }))
    expect(screen.getByText(/4 chamados em aberto/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Desativar' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('É necessário manter ao menos uma categoria ativa.'))
  })

  it('reativar não pede aviso de chamados', async () => {
    renderCats()
    await userEvent.click(await screen.findByRole('button', { name: /Reativar\s*Legado/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Reativar' }))
    await waitFor(() => expect(cats.setCategoryActive).toHaveBeenCalledWith('cat-2', true))
  })
})
