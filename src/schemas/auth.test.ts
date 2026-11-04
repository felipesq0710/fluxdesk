import { describe, expect, it } from 'vitest'
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from '@/schemas/auth'

function messages(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues.map((i) => i.message) ?? []
}

describe('loginSchema', () => {
  it('aceita credenciais válidas e normaliza o e-mail', () => {
    const r = loginSchema.safeParse({ email: '  ana@exemplo.com ', password: 'qualquer' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.email).toBe('ana@exemplo.com')
  })

  it('exige e-mail válido e senha', () => {
    const r = loginSchema.safeParse({ email: 'invalido', password: '' })
    expect(r.success).toBe(false)
    expect(messages(r)).toEqual(expect.arrayContaining(['Informe um e-mail válido.', 'Informe sua senha.']))
  })
})

describe('registerSchema', () => {
  const valid = {
    fullName: 'Ana Souza',
    email: 'ana@exemplo.com',
    password: 'senha1234',
    confirmPassword: 'senha1234',
  }

  it('aceita dados válidos', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true)
  })

  it.each([
    ['curta', 'abc12', 'A senha deve ter ao menos 8 caracteres.'],
    ['sem número', 'somenteletras', 'A senha deve conter ao menos um número.'],
    ['sem letra', '123456789', 'A senha deve conter ao menos uma letra.'],
  ])('rejeita senha %s', (_nome, password, msg) => {
    const r = registerSchema.safeParse({ ...valid, password, confirmPassword: password })
    expect(r.success).toBe(false)
    expect(messages(r)).toContain(msg)
  })

  it('exige confirmação igual à senha', () => {
    const r = registerSchema.safeParse({ ...valid, confirmPassword: 'outra1234' })
    expect(r.success).toBe(false)
    expect(messages(r)).toContain('As senhas não coincidem.')
  })

  it('exige nome com ao menos 2 caracteres', () => {
    expect(registerSchema.safeParse({ ...valid, fullName: 'A' }).success).toBe(false)
  })
})

describe('forgotPasswordSchema / resetPasswordSchema', () => {
  it('valida e-mail', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'x' }).success).toBe(false)
    expect(forgotPasswordSchema.safeParse({ email: 'x@y.com' }).success).toBe(true)
  })

  it('redefinição exige senha forte e confirmação', () => {
    expect(resetPasswordSchema.safeParse({ password: 'nova12345', confirmPassword: 'nova12345' }).success).toBe(true)
    expect(resetPasswordSchema.safeParse({ password: 'nova12345', confirmPassword: 'x' }).success).toBe(false)
    expect(resetPasswordSchema.safeParse({ password: 'curta1', confirmPassword: 'curta1' }).success).toBe(false)
  })
})
