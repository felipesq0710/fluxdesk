import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DemoAccess as ProductionDemoAccess } from '@/components/auth/DemoAccess'
import { DemoAccess } from '@/demo/DemoAccess'
import { DEMO_PASSWORD, PEOPLE } from '@/demo/store'

describe('acesso de teste da demonstração', () => {
  it('a versão real não exibe nenhum acesso de demonstração', () => {
    const { container } = render(<ProductionDemoAccess onPick={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('cada perfil entra com credenciais fictícias do domínio demo.fluxdesk', async () => {
    const onPick = vi.fn()
    render(<DemoAccess onPick={onPick} />)
    await userEvent.click(screen.getByRole('button', { name: /Entrar como administrador/ }))
    await userEvent.click(screen.getByRole('button', { name: /Entrar como técnico/ }))
    await userEvent.click(screen.getByRole('button', { name: /Entrar como solicitante/ }))
    expect(onPick.mock.calls.map(([email]) => email)).toEqual(['admin@demo.fluxdesk', 'tecnico@demo.fluxdesk', 'solicitante@demo.fluxdesk'])
    for (const [email, password] of onPick.mock.calls) {
      expect(email).toMatch(/@demo\.fluxdesk$/)
      expect(password).toBe(DEMO_PASSWORD)
      expect(PEOPLE.some((p) => p.email === email)).toBe(true)
    }
  })
})
