import { describe, expect, it, vi } from 'vitest'
import { Route, Routes } from 'react-router-dom'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { Sidebar } from '@/components/layout/Sidebar'
import { authAs, renderWithProviders } from '@/test/utils'

vi.mock('@/services/notifications', () => ({ countUnread: vi.fn().mockResolvedValue(0) }))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

function renderSidebar(route: string, onNavigate?: () => void) {
  return renderWithProviders(
    <Routes>
      <Route path="*" element={<ThemeProvider><Sidebar role="admin" onNavigate={onNavigate} /></ThemeProvider>} />
    </Routes>,
    { auth: authAs('admin'), route },
  )
}

describe('Sidebar', () => {
  it('o logo e o nome levam ao início (/) sem alterar os demais itens', async () => {
    renderSidebar('/chamados')
    const home = screen.getByRole('link', { name: /Fluxdesk — ir para o início/ })
    expect(home).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Chamados' })).toHaveAttribute('href', '/chamados')
    expect(screen.getByRole('link', { name: 'Usuários' })).toHaveAttribute('href', '/usuarios')
  })

  it('fecha a gaveta ao clicar no logo', async () => {
    const onNavigate = vi.fn()
    renderSidebar('/chamados', onNavigate)
    await userEvent.click(screen.getByRole('link', { name: /ir para o início/ }))
    expect(onNavigate).toHaveBeenCalledTimes(1)
  })

  it('marca apenas o item da rota atual', () => {
    renderSidebar('/chamados')
    expect(screen.getByRole('link', { name: 'Chamados' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current')
  })
})
