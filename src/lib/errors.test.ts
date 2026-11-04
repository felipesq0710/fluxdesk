import { describe, expect, it } from 'vitest'
import { authErrorMessage, dbErrorMessage, isNetworkError } from '@/lib/errors'

describe('authErrorMessage', () => {
  it('traduz credenciais inválidas', () => {
    expect(authErrorMessage({ code: 'invalid_credentials' })).toBe('E-mail ou senha incorretos.')
  })

  it('traduz e-mail não confirmado e limites de taxa', () => {
    expect(authErrorMessage({ code: 'email_not_confirmed' })).toMatch(/Confirme seu e-mail/)
    expect(authErrorMessage({ code: 'over_email_send_rate_limit' })).toMatch(/Muitas tentativas/)
    expect(authErrorMessage({ status: 429 })).toMatch(/Muitas tentativas/)
  })

  it('não revela se um e-mail já existe no cadastro', () => {
    expect(authErrorMessage({ code: 'user_already_exists' })).toBe(
      'Não foi possível concluir o cadastro com este e-mail.',
    )
  })

  it('detecta falha de rede', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isNetworkError({ name: 'AuthRetryableFetchError', message: 'x' })).toBe(true)
    expect(authErrorMessage(new TypeError('Failed to fetch'))).toMatch(/Falha de conexão/)
  })

  it('usa mensagem genérica para erros desconhecidos, sem vazar detalhes', () => {
    const msg = authErrorMessage({ message: 'internal stack trace at line 42', code: 'weird' })
    expect(msg).not.toMatch(/stack/)
  })
})

describe('dbErrorMessage', () => {
  it('oculta detalhes de RLS', () => {
    expect(
      dbErrorMessage({ code: '42501', message: 'new row violates row-level security policy for table "tickets"' }),
    ).toBe('Você não tem permissão para realizar esta ação.')
    expect(dbErrorMessage({ code: '42501', message: 'permission denied for table audit_log' })).toBe(
      'Você não tem permissão para realizar esta ação.',
    )
  })

  it('repassa mensagens de regra de negócio já escritas em português', () => {
    expect(dbErrorMessage({ code: '23514', message: 'Transição de status inválida: Encerrado → Resolvido.' })).toBe(
      'Transição de status inválida: Encerrado → Resolvido.',
    )
    expect(dbErrorMessage({ code: '42501', message: 'Apenas administradores podem reabrir chamados encerrados.' })).toBe(
      'Apenas administradores podem reabrir chamados encerrados.',
    )
  })

  it('traduz violações de constraint', () => {
    expect(dbErrorMessage({ code: '23505', message: 'duplicate key' })).toMatch(/Já existe/)
    expect(dbErrorMessage({ code: '23503', message: 'fk' })).toMatch(/registros relacionados/)
    expect(dbErrorMessage({ code: '23514', message: 'new row violates check constraint "x"' })).toMatch(/Dados inválidos/)
  })

  it('trata sessão expirada e falhas de rede', () => {
    expect(dbErrorMessage({ status: 401, message: 'JWT expired' })).toMatch(/sessão expirou/)
    expect(dbErrorMessage(new TypeError('Failed to fetch'))).toMatch(/Falha de conexão/)
  })
})
