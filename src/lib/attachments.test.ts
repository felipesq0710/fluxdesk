import { describe, expect, it } from 'vitest'
import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_UPLOAD,
  formatBytes,
  safeStorageName,
  validateAttachment,
  validateAttachments,
} from '@/lib/attachments'

const file = (name: string, size: number, type: string) => new File([new Uint8Array(Math.min(size, 8))], name, { type }) as File
const fake = (name: string, size: number, type: string) => ({ name, size, type })

describe('validateAttachment', () => {
  it('aceita tipos permitidos dentro do limite', () => {
    expect(validateAttachment(fake('print.png', 1024, 'image/png'))).toBeNull()
    expect(validateAttachment(fake('rel.pdf', MAX_ATTACHMENT_BYTES, 'application/pdf'))).toBeNull()
  })

  it('rejeita tipo não permitido', () => {
    expect(validateAttachment(fake('virus.exe', 10, 'application/x-msdownload'))).toMatch(/tipo de arquivo não permitido/)
    expect(validateAttachment(fake('page.html', 10, 'text/html'))).toMatch(/não permitido/)
    expect(validateAttachment(fake('logo.svg', 10, 'image/svg+xml'))).toMatch(/não permitido/)
  })

  it('rejeita arquivo acima de 10 MB e arquivo vazio', () => {
    expect(validateAttachment(fake('g.pdf', MAX_ATTACHMENT_BYTES + 1, 'application/pdf'))).toMatch(/limite/)
    expect(validateAttachment(fake('vazio.txt', 0, 'text/plain'))).toMatch(/vazio/)
  })
})

describe('validateAttachments', () => {
  it('separa aceitos e erros', () => {
    const r = validateAttachments([file('a.png', 10, 'image/png'), file('b.exe', 10, 'application/x-msdownload')])
    expect(r.accepted).toHaveLength(1)
    expect(r.errors).toHaveLength(1)
  })

  it('respeita o limite de arquivos por envio', () => {
    const many = Array.from({ length: MAX_ATTACHMENTS_PER_UPLOAD + 2 }, (_, i) => file(`f${i}.png`, 10, 'image/png'))
    const r = validateAttachments(many)
    expect(r.accepted).toHaveLength(MAX_ATTACHMENTS_PER_UPLOAD)
    expect(r.errors[0]).toMatch(/Limite/)
    expect(validateAttachments([file('x.png', 10, 'image/png')], MAX_ATTACHMENTS_PER_UPLOAD).accepted).toHaveLength(0)
  })
})

describe('safeStorageName', () => {
  it('remove acentos, separadores de caminho e caracteres especiais', () => {
    expect(safeStorageName('Relatório final (v2).pdf')).toBe('Relatorio_final_v2_.pdf')
    expect(safeStorageName('../../etc/passwd')).toBe('_.._etc_passwd')
    expect(safeStorageName('...')).toBe('arquivo')
  })

  it('nunca contém barras', () => {
    expect(safeStorageName('a/b\\c.png')).not.toMatch(/[\\/]/)
  })
})

describe('formatBytes', () => {
  it('formata em pt-BR', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1,5 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5,0 MB')
  })
})
