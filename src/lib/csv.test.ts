import { describe, expect, it } from 'vitest'
import { buildCsv, csvCell, csvDateTime } from '@/lib/csv'

describe('csvCell', () => {
  it('valores vazios e números com vírgula decimal', () => {
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
    expect(csvCell(12.5)).toBe('12,5')
    expect(csvCell(0)).toBe('0')
  })

  it('escapa separador, aspas e quebras de linha', () => {
    expect(csvCell('a;b')).toBe('"a;b"')
    expect(csvCell('diz "oi"')).toBe('"diz ""oi"""')
    expect(csvCell('linha1\nlinha2')).toBe('"linha1\nlinha2"')
  })

  it('neutraliza fórmulas (CSV injection)', () => {
    expect(csvCell('=HYPERLINK("http://evil","x")')).toBe(`"'=HYPERLINK(""http://evil"",""x"")"`)
    expect(csvCell('+1+1')).toBe("'+1+1")
    expect(csvCell('-2+3')).toBe("'-2+3")
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)")
    expect(csvCell('\t=cmd')).toBe("'\t=cmd")
    expect(csvCell('texto normal')).toBe('texto normal')
  })
})

describe('buildCsv', () => {
  it('cabeçalho, BOM, CRLF e linhas', () => {
    const csv = buildCsv([{ n: 'FLX-000001', t: 'Impressora; offline' }], [
      { header: 'Número', value: (r) => r.n },
      { header: 'Título', value: (r) => r.t },
    ])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toBe('﻿Número;Título\r\nFLX-000001;"Impressora; offline"\r\n')
  })

  it('sem linhas gera apenas o cabeçalho', () => {
    expect(buildCsv([], [{ header: 'A', value: () => 1 }])).toBe('﻿A\r\n')
  })
})

describe('csvDateTime', () => {
  it('formata no fuso local e trata nulo', () => {
    expect(csvDateTime(null)).toBe('')
    expect(csvDateTime(new Date(2026, 0, 5, 9, 7).toISOString())).toBe('2026-01-05 09:07')
  })
})
