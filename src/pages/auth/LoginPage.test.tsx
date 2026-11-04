import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from '@/pages/auth/LoginPage'
import { makeAuth, renderWithProviders } from '@/test/utils'

describe('LoginPage', () => {
  it('mostra mensagens de validação por campo e não chama o login', async () => {
    const auth = makeAuth()
    renderWithProviders(<LoginPage />, { auth })

    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('Informe seu e-mail.')).toBeInTheDocument()
    expect(screen.getByText('Informe sua senha.')).toBeInTheDocument()
    expect(auth.signIn).not.toHaveBeenCalled()
  })

  it('valida o formato do e-mail', async () => {
    renderWithProviders(<LoginPage />)
    await userEvent.type(screen.getByLabelText(/E-mail/), 'sem-arroba')
    await userEvent.type(screen.getByLabelText(/Senha/), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument()
  })

  it('envia as credenciais informadas', async () => {
    const auth = makeAuth()
    renderWithProviders(<LoginPage />, { auth })

    await userEvent.type(screen.getByLabelText(/E-mail/), 'ana@exemplo.com')
    await userEvent.type(screen.getByLabelText(/Senha/), 'senha1234')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(auth.signIn).toHaveBeenCalledWith('ana@exemplo.com', 'senha1234'))
  })

  it('exibe erro traduzido quando as credenciais são inválidas', async () => {
    const auth = makeAuth({
      signIn: vi.fn().mockResolvedValue({ error: { code: 'invalid_credentials', message: 'Invalid login credentials' } }),
    })
    renderWithProviders(<LoginPage />, { auth })

    await userEvent.type(screen.getByLabelText(/E-mail/), 'ana@exemplo.com')
    await userEvent.type(screen.getByLabelText(/Senha/), 'errada')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.')
  })

  it('exibe falha de conexão de forma clara', async () => {
    const auth = makeAuth({
      signIn: vi.fn().mockResolvedValue({ error: new TypeError('Failed to fetch') }),
    })
    renderWithProviders(<LoginPage />, { auth })

    await userEvent.type(screen.getByLabelText(/E-mail/), 'ana@exemplo.com')
    await userEvent.type(screen.getByLabelText(/Senha/), 'senha1234')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha de conexão')
  })

  it('avisa que a sessão expirou', () => {
    renderWithProviders(<LoginPage />, { auth: makeAuth({ sessionExpired: true }) })
    expect(screen.getByRole('alert')).toHaveTextContent('Sua sessão expirou')
  })

  it('permite mostrar e ocultar a senha', async () => {
    renderWithProviders(<LoginPage />)
    const input = screen.getByLabelText(/Senha/)
    expect(input).toHaveAttribute('type', 'password')
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(input).toHaveAttribute('type', 'text')
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }))
    expect(input).toHaveAttribute('type', 'password')
  })

  it('oferece links de cadastro e recuperação de senha', () => {
    renderWithProviders(<LoginPage />)
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute('href', '/cadastro')
    expect(screen.getByRole('link', { name: 'Esqueci minha senha' })).toHaveAttribute('href', '/recuperar-senha')
  })
})
