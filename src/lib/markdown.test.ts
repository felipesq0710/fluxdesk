import { describe, expect, it } from 'vitest'
import { parseInline, parseMarkdown, safeHref } from '@/lib/markdown'

describe('safeHref', () => {
  it.each([
    ['https://exemplo.com/a?b=1', true],
    ['http://exemplo.com', true],
    ['mailto:ajuda@exemplo.com', true],
    ['javascript:alert(1)', false],
    ['JaVaScRiPt:alert(1)', false],
    ['data:text/html;base64,AAAA', false],
    ['/relativo', false],
    ['vbscript:x', false],
  ])('%s → %s', (href, ok) => expect(safeHref(href) !== null).toBe(ok))
})

describe('parseInline', () => {
  it('reconhece negrito, código e link', () => {
    expect(parseInline('a **b** `c` [d](https://x.com)')).toEqual([
      { t: 'text', v: 'a ' },
      { t: 'bold', v: 'b' },
      { t: 'text', v: ' ' },
      { t: 'code', v: 'c' },
      { t: 'text', v: ' ' },
      { t: 'link', v: 'd', href: 'https://x.com/' },
    ])
  })
  it('link com protocolo perigoso vira texto, sem href', () => {
    const out = parseInline('[clique](javascript:alert(1))')
    expect(out.some((n) => n.t === 'link')).toBe(false)
  })
  it('HTML é mantido como texto literal', () => {
    expect(parseInline('<img src=x onerror=alert(1)>')).toEqual([{ t: 'text', v: '<img src=x onerror=alert(1)>' }])
  })
})

describe('parseMarkdown', () => {
  it('títulos, listas, citação e código', () => {
    const blocks = parseMarkdown('# A\n### B\n\n- um\n- dois\n\n1. x\n2. y\n\n> citado\n\n```\nlinha 1\n  linha 2\n```\n\ntexto\nem duas linhas')
    expect(blocks.map((b) => b.t)).toEqual(['heading', 'heading', 'ul', 'ol', 'quote', 'code', 'paragraph'])
    expect(blocks[0]).toMatchObject({ level: 2 })
    expect(blocks[1]).toMatchObject({ level: 3 })
    expect(blocks[5]).toEqual({ t: 'code', text: 'linha 1\n  linha 2' })
    expect(blocks[6]).toMatchObject({ inline: [{ t: 'text', v: 'texto em duas linhas' }] })
  })
  it('bloco de código sem fechamento não trava', () => {
    expect(parseMarkdown('```\nabc')).toEqual([{ t: 'code', text: 'abc' }])
  })
  it('entrada vazia gera nenhum bloco', () => {
    expect(parseMarkdown('  \n\n')).toEqual([])
  })
})
