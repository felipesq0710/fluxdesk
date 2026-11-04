import { describe, expect, it } from 'vitest'
import { articleFiltersToParams, canManageArticle, parseArticleFilters } from '@/lib/articleRules'
import { articleFormSchema, parseTags } from '@/schemas/article'

describe('canManageArticle', () => {
  it('administrador gerencia qualquer artigo; técnico só os próprios; solicitante nenhum', () => {
    expect(canManageArticle('admin', 'a', 'b')).toBe(true)
    expect(canManageArticle('technician', 'a', 'a')).toBe(true)
    expect(canManageArticle('technician', 'a', 'b')).toBe(false)
    expect(canManageArticle('requester', 'a', 'a')).toBe(false)
  })
})

describe('filtros de artigos', () => {
  it('descarta valores inválidos e faz ida e volta pela URL', () => {
    const f = parseArticleFilters(new URLSearchParams('q=vpn%25&status=hack&category=nao-uuid&page=-3&tag=Rede<script>'))
    expect(f).toEqual({ search: 'vpn', category: '', tag: 'Redescript', status: '', page: 1 })
    const again = parseArticleFilters(articleFiltersToParams({ ...f, status: 'draft', page: 2 }))
    expect(again).toMatchObject({ status: 'draft', page: 2 })
  })
})

describe('formulário de artigo', () => {
  it('normaliza tags (minúsculas, sem duplicadas)', () => {
    expect(parseTags('VPN, rede ,vpn,,')).toEqual(['vpn', 'rede'])
  })
  const base = { title: 'Como usar a VPN', content: 'Passo a passo completo.', categoryId: '', status: 'draft', tags: '' }
  it('aceita válido e rejeita título curto, conteúdo curto e tags demais', () => {
    expect(articleFormSchema.safeParse(base).success).toBe(true)
    expect(articleFormSchema.safeParse({ ...base, title: 'ab' }).success).toBe(false)
    expect(articleFormSchema.safeParse({ ...base, content: 'curto' }).success).toBe(false)
    expect(articleFormSchema.safeParse({ ...base, tags: Array.from({ length: 11 }, (_, i) => `t${i}`).join(',') }).success).toBe(false)
    expect(articleFormSchema.safeParse({ ...base, tags: 'x'.repeat(31) }).success).toBe(false)
  })
})
