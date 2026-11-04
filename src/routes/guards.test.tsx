import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { PublicOnly, RequireAuth, RequireRole } from '@/routes/guards'
import { authAs, makeAuth, makeProfile, renderWithProviders } from '@/test/utils'

function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/entrar" element={<p>tela de login</p>} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route path="/" element={<p>conteúdo privado</p>} />
        <Route element={<RequireRole roles={['admin']} />}>
          <Route path="/usuarios" element={<p>área administrativa</p>} />
        </Route>
        <Route element={<RequireRole roles={['technician', 'admin']} />}>
          <Route path="/minha-fila" element={<p>fila do técnico</p>} />
        </Route>
      </Route>
    </Routes>
  )
}

describe('RequireAuth', () => {
  it('mostra carregamento enquanto a sessão é verificada', () => {
    renderWithProviders(<AppRoutes />, { auth: makeAuth({ initializing: true }) })
    expect(screen.getByRole('status')).toHaveTextContent('Carregando')
    expect(screen.queryByText('conteúdo privado')).not.toBeInTheDocument()
  })

  it('redireciona visitantes para o login', () => {
    renderWithProviders(<AppRoutes />, { auth: makeAuth(), route: '/' })
    expect(screen.getByText('tela de login')).toBeInTheDocument()
    expect(screen.queryByText('conteúdo privado')).not.toBeInTheDocument()
  })

  it('aguarda o perfil antes de liberar o conteúdo', () => {
    renderWithProviders(<AppRoutes />, {
      auth: authAs('requester', { profile: null, profileLoading: true }),
    })
    expect(screen.getByRole('status')).toHaveTextContent('perfil')
    expect(screen.queryByText('conteúdo privado')).not.toBeInTheDocument()
  })

  it('permite tentar novamente quando o perfil falha ao carregar', async () => {
    const refetchProfile = vi.fn()
    renderWithProviders(<AppRoutes />, {
      auth: authAs('requester', { profile: null, profileError: new Error('x'), refetchProfile }),
    })
    await userEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))
    expect(refetchProfile).toHaveBeenCalledOnce()
  })

  it('bloqueia conta desativada', () => {
    renderWithProviders(<AppRoutes />, {
      auth: authAs('admin', { profile: makeProfile({ role: 'admin', is_active: false }) }),
    })
    expect(screen.getByRole('heading', { name: 'Conta desativada' })).toBeInTheDocument()
    expect(screen.queryByText('conteúdo privado')).not.toBeInTheDocument()
  })

  it('bloqueia sessão sem perfil', () => {
    renderWithProviders(<AppRoutes />, { auth: authAs('requester', { profile: null }) })
    expect(screen.getByRole('heading', { name: 'Perfil não encontrado' })).toBeInTheDocument()
  })

  it('libera o conteúdo para usuário ativo', () => {
    renderWithProviders(<AppRoutes />, { auth: authAs('requester') })
    expect(screen.getByText('conteúdo privado')).toBeInTheDocument()
  })
})

describe('RequireRole', () => {
  it('nega a área administrativa ao solicitante', () => {
    renderWithProviders(<AppRoutes />, { auth: authAs('requester'), route: '/usuarios' })
    expect(screen.getByRole('heading', { name: 'Acesso não autorizado' })).toBeInTheDocument()
    expect(screen.queryByText('área administrativa')).not.toBeInTheDocument()
  })

  it('nega a área administrativa ao técnico', () => {
    renderWithProviders(<AppRoutes />, { auth: authAs('technician'), route: '/usuarios' })
    expect(screen.getByRole('heading', { name: 'Acesso não autorizado' })).toBeInTheDocument()
  })

  it('libera a área administrativa ao administrador', () => {
    renderWithProviders(<AppRoutes />, { auth: authAs('admin'), route: '/usuarios' })
    expect(screen.getByText('área administrativa')).toBeInTheDocument()
  })

  it('libera a fila a técnicos e nega a solicitantes', () => {
    const { unmount } = renderWithProviders(<AppRoutes />, { auth: authAs('technician'), route: '/minha-fila' })
    expect(screen.getByText('fila do técnico')).toBeInTheDocument()
    unmount()
    renderWithProviders(<AppRoutes />, { auth: authAs('requester'), route: '/minha-fila' })
    expect(screen.queryByText('fila do técnico')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Acesso não autorizado' })).toBeInTheDocument()
  })
})

describe('PublicOnly', () => {
  it('mostra o login para visitantes', () => {
    renderWithProviders(<AppRoutes />, { auth: makeAuth(), route: '/entrar' })
    expect(screen.getByText('tela de login')).toBeInTheDocument()
  })

  it('leva usuários autenticados ao app', () => {
    renderWithProviders(<AppRoutes />, { auth: authAs('requester'), route: '/entrar' })
    expect(screen.getByText('conteúdo privado')).toBeInTheDocument()
    expect(screen.queryByText('tela de login')).not.toBeInTheDocument()
  })
})
