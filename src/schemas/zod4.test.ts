import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { parseEnv } from '@/lib/env'
import { required } from '@/lib/zodMessages'
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from '@/schemas/auth'
import { articleFormSchema } from '@/schemas/article'
import { categoryFormSchema } from '@/schemas/category'
import { changePasswordSchema } from '@/schemas/settings'
import { commentSchema, ticketFormSchema } from '@/schemas/ticket'

function firstMessages(result: { success: boolean; error?: z.ZodError }): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of result.error?.issues ?? []) {
    const key = issue.path.join('.')
    if (!(key in out)) out[key] = issue.message
  }
  return out
}

describe('Zod 4 — mensagens de campo ausente (antes required_error)', () => {
  it('helper só traduz undefined; outros tipos mantêm a mensagem padrão', () => {
    const schema = z.object({ a: z.string({ error: required('Informe a.') }) })
    expect(firstMessages(schema.safeParse({}))).toEqual({ a: 'Informe a.' })
    expect(firstMessages(schema.safeParse({ a: undefined }))).toEqual({ a: 'Informe a.' })
    expect(firstMessages(schema.safeParse({ a: 42 }))['a']).not.toBe('Informe a.')
    expect(schema.safeParse({ a: 'ok' }).success).toBe(true)
  })

  it('login, cadastro, recuperação e redefinição', () => {
    expect(firstMessages(loginSchema.safeParse({}))).toEqual({ email: 'Informe seu e-mail.', password: 'Informe sua senha.' })
    expect(firstMessages(registerSchema.safeParse({}))).toMatchObject({
      fullName: 'Informe seu nome.',
      email: 'Informe seu e-mail.',
      password: 'Informe uma senha.',
      confirmPassword: 'Confirme sua senha.',
    })
    expect(firstMessages(forgotPasswordSchema.safeParse({}))).toEqual({ email: 'Informe seu e-mail.' })
    expect(firstMessages(resetPasswordSchema.safeParse({}))).toMatchObject({ password: 'Informe uma senha.', confirmPassword: 'Confirme sua senha.' })
  })

  it('campos vazios (o que o React Hook Form realmente envia) mantêm as mensagens de tamanho', () => {
    expect(firstMessages(loginSchema.safeParse({ email: '', password: '' }))).toEqual({ email: 'Informe seu e-mail.', password: 'Informe sua senha.' })
    expect(firstMessages(loginSchema.safeParse({ email: 'sem-arroba', password: 'x' }))).toEqual({ email: 'Informe um e-mail válido.' })
  })

  it('chamado e comentário', () => {
    expect(firstMessages(ticketFormSchema.safeParse({}))).toMatchObject({
      title: 'Informe o título.',
      description: 'Descreva o problema.',
      categoryId: 'Selecione uma categoria.',
      priority: 'Selecione a prioridade.',
    })
    expect(firstMessages(commentSchema.safeParse({ kind: 'public' }))).toEqual({ body: 'Escreva uma mensagem.' })
  })

  it('variáveis de ambiente ausentes ou inválidas', () => {
    const missing = parseEnv({})
    expect(missing.success).toBe(false)
    expect(missing.error?.issues.map((i) => i.message)).toEqual(['VITE_SUPABASE_URL não definida', 'VITE_SUPABASE_ANON_KEY não definida'])
    const invalid = parseEnv({ VITE_SUPABASE_URL: 'nao-e-url', VITE_SUPABASE_ANON_KEY: 'curta' })
    expect(invalid.error?.issues.map((i) => i.message)).toEqual(['VITE_SUPABASE_URL deve ser uma URL válida', 'VITE_SUPABASE_ANON_KEY parece inválida'])
    expect(parseEnv({ VITE_SUPABASE_URL: 'https://abc.supabase.co', VITE_SUPABASE_ANON_KEY: 'x'.repeat(40) }).success).toBe(true)
  })
})

describe('Zod 4 — comportamentos que mudaram de versão', () => {
  const base = { title: 'Título válido', description: 'Descrição com mais de dez caracteres', categoryId: '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e', priority: 'high' }

  it('enum: valor inválido usa a mensagem em português', () => {
    expect(firstMessages(ticketFormSchema.safeParse({ ...base, priority: 'urgente' }))).toEqual({ priority: 'Selecione a prioridade.' })
    expect(firstMessages(ticketFormSchema.safeParse({ ...base, priority: '' }))).toEqual({ priority: 'Selecione a prioridade.' })
  })

  it('uuid: aceita ids gerados pelo Postgres (v4) e rejeita texto e string vazia', () => {
    expect(ticketFormSchema.safeParse(base).success).toBe(true)
    expect(ticketFormSchema.safeParse({ ...base, categoryId: crypto.randomUUID() }).success).toBe(true)
    expect(firstMessages(ticketFormSchema.safeParse({ ...base, categoryId: '' }))).toEqual({ categoryId: 'Selecione uma categoria.' })
    expect(firstMessages(ticketFormSchema.safeParse({ ...base, categoryId: 'abc' }))).toEqual({ categoryId: 'Selecione uma categoria.' })
  })

  it('trim continua antes das validações de tamanho e o valor sai aparado', () => {
    expect(firstMessages(ticketFormSchema.safeParse({ ...base, title: '   ab   ' }))).toEqual({ title: 'O título deve ter ao menos 3 caracteres.' })
    const ok = ticketFormSchema.safeParse({ ...base, title: '  Título  ' })
    expect(ok.success && ok.data.title).toBe('Título')
    expect(firstMessages(commentSchema.safeParse({ body: '   ', kind: 'public' }))).toEqual({ body: 'Escreva uma mensagem.' })
  })

  it('refine de objeto: mensagem do campo vem antes da do refine e o caminho é preservado', () => {
    const empty = changePasswordSchema.safeParse({ currentPassword: '', password: '', confirmPassword: '' })
    expect(firstMessages(empty)).toMatchObject({ currentPassword: 'Informe sua senha atual.', confirmPassword: 'Confirme a nova senha.' })
    const mismatch = changePasswordSchema.safeParse({ currentPassword: 'antiga123', password: 'novasenha1', confirmPassword: 'outrasenha1' })
    expect(firstMessages(mismatch)).toEqual({ confirmPassword: 'As senhas não coincidem.' })
    const same = changePasswordSchema.safeParse({ currentPassword: 'antiga123', password: 'antiga123', confirmPassword: 'antiga123' })
    expect(firstMessages(same)).toEqual({ password: 'A nova senha deve ser diferente da atual.' })
    expect(registerSchema.safeParse({ fullName: 'Ana Souza', email: 'a@b.com', password: 'senha1234', confirmPassword: 'diferente1' }).error?.issues[0]?.path).toEqual(['confirmPassword'])
  })

  it('senha: regras de letra, número e tamanho', () => {
    const msg = (password: string) => firstMessages(resetPasswordSchema.safeParse({ password, confirmPassword: password }))['password']
    expect(msg('curta1')).toBe('A senha deve ter ao menos 8 caracteres.')
    expect(msg('12345678')).toBe('A senha deve conter ao menos uma letra.')
    expect(msg('abcdefgh')).toBe('A senha deve conter ao menos um número.')
    expect(msg('a1'.repeat(37))).toBe('A senha deve ter no máximo 72 caracteres.')
    expect(msg('senha1234')).toBeUndefined()
  })

  it('superRefine (tags) e categoria continuam validando', () => {
    const art = { title: 'Guia de VPN', content: 'Conteúdo suficiente.', categoryId: '', status: 'draft', tags: '' }
    expect(articleFormSchema.safeParse(art).success).toBe(true)
    const many = articleFormSchema.safeParse({ ...art, tags: Array.from({ length: 11 }, (_, i) => `t${i}`).join(',') })
    expect(firstMessages(many)).toEqual({ tags: 'Use no máximo 10 tags.' })
    expect(firstMessages(articleFormSchema.safeParse({ ...art, status: 'x' }))).toHaveProperty('status')
    expect(firstMessages(categoryFormSchema.safeParse({ name: ' a ', description: '' }))).toEqual({ name: 'O nome precisa ter ao menos 2 caracteres.' })
  })

  it('coerção usada nas respostas do banco: bigint em string vira número', () => {
    const schema = z.object({ n: z.coerce.number() })
    expect(schema.parse({ n: '12' }).n).toBe(12)
    expect(schema.safeParse({ n: 'abc' }).success).toBe(false)
  })
})
