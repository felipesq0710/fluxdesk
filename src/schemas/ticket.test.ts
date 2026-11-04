import { describe, expect, it } from 'vitest'
import { commentSchema, ticketFormSchema } from '@/schemas/ticket'

const valid = {
  title: 'Impressora offline',
  description: 'A impressora do setor financeiro não responde.',
  categoryId: '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e',
  priority: 'high',
}
const msgs = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues.map((i) => i.message) ?? []

describe('ticketFormSchema', () => {
  it('aceita dados válidos e apara espaços', () => {
    const r = ticketFormSchema.safeParse({ ...valid, title: '  Impressora offline  ' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.title).toBe('Impressora offline')
  })

  it('exige título e descrição mínimos', () => {
    const r = ticketFormSchema.safeParse({ ...valid, title: 'ab', description: 'curta' })
    expect(msgs(r)).toEqual(
      expect.arrayContaining(['O título deve ter ao menos 3 caracteres.', 'Descreva o problema com ao menos 10 caracteres.']),
    )
  })

  it('aplica limites máximos', () => {
    expect(ticketFormSchema.safeParse({ ...valid, title: 'a'.repeat(161) }).success).toBe(false)
    expect(ticketFormSchema.safeParse({ ...valid, description: 'a'.repeat(10001) }).success).toBe(false)
  })

  it('exige categoria e prioridade válidas', () => {
    expect(msgs(ticketFormSchema.safeParse({ ...valid, categoryId: '' }))).toContain('Selecione uma categoria.')
    expect(msgs(ticketFormSchema.safeParse({ ...valid, priority: 'urgente' }))).toContain('Selecione a prioridade.')
  })
})

describe('commentSchema', () => {
  it('rejeita mensagem vazia ou só com espaços', () => {
    expect(msgs(commentSchema.safeParse({ body: '   ', kind: 'public' }))).toContain('Escreva uma mensagem.')
  })

  it('aceita comentário público e nota interna; rejeita tipo desconhecido', () => {
    expect(commentSchema.safeParse({ body: 'ok', kind: 'public' }).success).toBe(true)
    expect(commentSchema.safeParse({ body: 'ok', kind: 'internal' }).success).toBe(true)
    expect(commentSchema.safeParse({ body: 'ok', kind: 'secret' }).success).toBe(false)
  })
})
