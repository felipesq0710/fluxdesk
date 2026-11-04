import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import SettingsPage from '@/pages/SettingsPage'
import * as settingsService from '@/services/settings'
import { authAs } from '@/test/utils'
import type { UserRole } from '@/types/domain'
import type { AuthContextValue } from '@/contexts/AuthContext'

const profiles = vi.hoisted(() => ({ updateOwnName: vi.fn(), fetchProfile: vi.fn() }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }))
vi.mock('@/services/profiles', () => profiles)
vi.mock('sonner', () => ({ toast, Toaster: () => null }))

function renderSettings(role: UserRole, overrides: Partial<AuthContextValue> = {}) {
  const auth = authAs(role, overrides)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={auth}>
        <ThemeProvider>
          <MemoryRouter>
            <SettingsPage />
          </MemoryRouter>
        </ThemeProvider>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
  return auth
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  document.documentElement.classList.remove('dark')
  profiles.updateOwnName.mockResolvedValue(undefined)
  vi.mocked(settingsService.getAppSettings).mockResolvedValue({ allow_requester_priority: true, requester_reopen_days: null, updated_at: '' })
})

describe('Configurações', () => {
  it('tema: escolher escuro aplica a classe e persiste; "sistema" remove a preferência salva', async () => {
    renderSettings('requester')
    await userEvent.click(screen.getByRole('radio', { name: 'Escuro' }))
    expect(document.documentElement).toHaveClass('dark')
    expect(localStorage.getItem('fluxdesk-theme')).toBe('dark')
    await userEvent.click(screen.getByRole('radio', { name: 'Seguir o sistema' }))
    expect(localStorage.getItem('fluxdesk-theme')).toBeNull()
  })

  it('altera o nome e atualiza o perfil; botão só habilita com mudança', async () => {
    const auth = renderSettings('technician')
    const save = screen.getByRole('button', { name: 'Salvar nome' })
    expect(save).toBeDisabled()
    const name = screen.getByLabelText(/Nome completo/)
    await userEvent.clear(name)
    await userEvent.type(name, 'Novo Nome')
    await userEvent.click(save)
    await waitFor(() => expect(profiles.updateOwnName).toHaveBeenCalledWith('user-1', 'Novo Nome'))
    expect(auth.refetchProfile).toHaveBeenCalled()
  })

  it('não permite nome vazio', async () => {
    renderSettings('technician')
    await userEvent.clear(screen.getByLabelText(/Nome completo/))
    await userEvent.click(screen.getByRole('button', { name: 'Salvar nome' }))
    await screen.findByText('Informe seu nome completo.')
    expect(profiles.updateOwnName).not.toHaveBeenCalled()
  })

  it('senha: confere a senha atual antes de trocar', async () => {
    const signIn = vi.fn().mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    const auth = renderSettings('requester', { signIn })
    await userEvent.type(screen.getByLabelText(/Senha atual/), 'errada123')
    await userEvent.type(screen.getByLabelText(/^Nova senha/), 'novasenha1')
    await userEvent.type(screen.getByLabelText(/Confirmar nova senha/), 'novasenha1')
    await userEvent.click(screen.getByRole('button', { name: 'Alterar senha' }))
    await screen.findByText('A senha atual está incorreta.')
    expect(auth.updatePassword).not.toHaveBeenCalled()
  })

  it('senha: troca com sucesso e limpa o formulário', async () => {
    const auth = renderSettings('requester')
    await userEvent.type(screen.getByLabelText(/Senha atual/), 'antiga123')
    await userEvent.type(screen.getByLabelText(/^Nova senha/), 'novasenha1')
    await userEvent.type(screen.getByLabelText(/Confirmar nova senha/), 'novasenha1')
    await userEvent.click(screen.getByRole('button', { name: 'Alterar senha' }))
    await waitFor(() => expect(auth.updatePassword).toHaveBeenCalledWith('novasenha1'))
    expect(auth.signIn).toHaveBeenCalledWith('pessoa@exemplo.com', 'antiga123')
    await waitFor(() => expect(screen.getByLabelText(/Senha atual/)).toHaveValue(''))
  })

  it('senha: rejeita nova igual à atual e confirmação diferente', async () => {
    const auth = renderSettings('requester')
    await userEvent.type(screen.getByLabelText(/Senha atual/), 'antiga123')
    await userEvent.type(screen.getByLabelText(/^Nova senha/), 'antiga123')
    await userEvent.type(screen.getByLabelText(/Confirmar nova senha/), 'outra1234')
    await userEvent.click(screen.getByRole('button', { name: 'Alterar senha' }))
    await screen.findByText('As senhas não coincidem.')
    expect(auth.signIn).not.toHaveBeenCalled()
  })

  it('seção Sistema só aparece para administradores', async () => {
    const { unmount } = renderTemp('technician')
    expect(screen.queryByRole('heading', { name: 'Sistema' })).not.toBeInTheDocument()
    unmount()
    renderSettings('admin')
    expect(await screen.findByRole('heading', { name: 'Sistema' })).toBeInTheDocument()
  })

  it('administrador salva as regras do sistema', async () => {
    renderSettings('admin')
    const box = await screen.findByRole('checkbox', { name: /Solicitantes escolhem a prioridade/ })
    const save = screen.getByRole('button', { name: 'Salvar configurações' })
    expect(save).toBeDisabled()
    await userEvent.click(box)
    await userEvent.selectOptions(screen.getByLabelText(/Prazo para o solicitante reabrir/), '7')
    await userEvent.click(save)
    await waitFor(() => expect(settingsService.updateAppSettings).toHaveBeenCalledWith({ allow_requester_priority: false, requester_reopen_days: 7 }))
    expect(toast.success).toHaveBeenCalled()
  })

  it('erro ao salvar o sistema mostra mensagem', async () => {
    vi.mocked(settingsService.updateAppSettings).mockRejectedValueOnce({ code: '42501', message: 'row-level security' })
    renderSettings('admin')
    await userEvent.click(await screen.findByRole('checkbox', { name: /Solicitantes escolhem a prioridade/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Salvar configurações' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Você não tem permissão para realizar esta ação.'))
  })
})

function renderTemp(role: UserRole) {
  const auth = authAs(role)
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={auth}>
        <ThemeProvider>
          <MemoryRouter>
            <SettingsPage />
          </MemoryRouter>
        </ThemeProvider>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}
