import { describe, expect, it } from 'vitest'
import { getRedirectTarget } from '@/lib/navigation'

describe('getRedirectTarget', () => {
  it('retorna a rota de origem com query string', () => {
    expect(getRedirectTarget({ from: { pathname: '/chamados', search: '?status=open' } })).toBe('/chamados?status=open')
  })

  it('volta ao início sem estado', () => {
    expect(getRedirectTarget(null)).toBe('/')
    expect(getRedirectTarget(undefined)).toBe('/')
    expect(getRedirectTarget({})).toBe('/')
  })

  it('bloqueia redirecionamento aberto', () => {
    expect(getRedirectTarget({ from: { pathname: '//evil.com' } })).toBe('/')
    expect(getRedirectTarget({ from: { pathname: 'https://evil.com' } })).toBe('/')
    expect(getRedirectTarget({ from: { pathname: '/ok', search: 'javascript:alert(1)' } })).toBe('/ok')
  })

  it('não retorna para telas de autenticação', () => {
    expect(getRedirectTarget({ from: { pathname: '/entrar' } })).toBe('/')
    expect(getRedirectTarget({ from: { pathname: '/redefinir-senha' } })).toBe('/')
  })
})
