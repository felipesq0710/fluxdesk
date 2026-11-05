import { describe, expect, it, vi } from 'vitest'
import { AttachmentRecoveryError, deleteAttachmentSafely } from '@/lib/attachmentDeletion'

function steps(overrides: Partial<Parameters<typeof deleteAttachmentSafely<string>>[0]> = {}) {
  const calls: string[] = []
  return {
    calls,
    options: {
      readObject: vi.fn(async () => { calls.push('read'); return 'snapshot' }),
      removeObject: vi.fn(async () => { calls.push('remove') }),
      deleteRecord: vi.fn(async () => { calls.push('delete') }),
      restoreObject: vi.fn(async () => { calls.push('restore') }),
      isObjectMissing: (error: unknown) => Boolean(error && typeof error === 'object' && 'missing' in error),
      ...overrides,
    },
  }
}

describe('exclusão coordenada de anexos (unidade simulada)', () => {
  it('remove o objeto antes dos metadados e conclui com sucesso', async () => {
    const test = steps()
    await deleteAttachmentSafely(test.options)
    expect(test.calls).toEqual(['read', 'remove', 'delete'])
  })

  it('não altera os metadados quando o Storage recusa a remoção', async () => {
    const test = steps({ removeObject: vi.fn(async () => { throw new Error('permission denied') }) })
    await expect(deleteAttachmentSafely(test.options)).rejects.toThrow('permission denied')
    expect(test.calls).toEqual(['read'])
    expect(test.options.deleteRecord).not.toHaveBeenCalled()
  })

  it('restaura o objeto se a exclusão dos metadados falhar, permitindo nova tentativa', async () => {
    const test = steps()
    test.options.deleteRecord = vi.fn()
      .mockImplementationOnce(async () => { throw new Error('db unavailable') })
      .mockImplementationOnce(async () => { test.calls.push('delete') })
    test.options.restoreObject = vi.fn(async () => { test.calls.push('restore') })
    await expect(deleteAttachmentSafely(test.options)).rejects.toThrow('db unavailable')
    expect(test.calls).toEqual(['read', 'remove', 'restore'])

    test.calls.length = 0
    await deleteAttachmentSafely(test.options)
    expect(test.calls).toEqual(['read', 'remove', 'delete'])
  })

  it('informa quando a compensação falha e permite limpar metadados em uma repetição sem objeto', async () => {
    const test = steps()
    test.options.readObject = vi.fn()
      .mockImplementationOnce(async () => { test.calls.push('read'); return 'snapshot' })
      .mockImplementationOnce(async () => { test.calls.push('read'); throw { missing: true } })
    test.options.removeObject = vi.fn(async () => { test.calls.push('remove') })
    test.options.deleteRecord = vi.fn()
      .mockImplementationOnce(async () => { test.calls.push('delete'); throw new Error('db unavailable') })
      .mockImplementationOnce(async () => { test.calls.push('delete') })
    test.options.restoreObject = vi.fn(async () => { test.calls.push('restore'); throw new Error('restore failed') })
    await expect(deleteAttachmentSafely(test.options)).rejects.toBeInstanceOf(AttachmentRecoveryError)
    await expect(deleteAttachmentSafely(test.options)).resolves.toBeUndefined()
    expect(test.options.deleteRecord).toHaveBeenCalledTimes(2)
    expect(test.calls).toEqual(['read', 'remove', 'delete', 'restore', 'read', 'delete'])
  })

  it('é idempotente quando o objeto já foi removido e o registro continua autorizado a ser apagado', async () => {
    const test = steps({ readObject: vi.fn().mockRejectedValue({ missing: true }) })
    await expect(deleteAttachmentSafely(test.options)).resolves.toBeUndefined()
    expect(test.calls).toEqual(['delete'])
  })

  it('não remove dados quando leitura ou autorização do Storage falha', async () => {
    const test = steps({ readObject: vi.fn().mockRejectedValue(new Error('permission denied')) })
    await expect(deleteAttachmentSafely(test.options)).rejects.toThrow('permission denied')
    expect(test.options.removeObject).not.toHaveBeenCalled()
    expect(test.options.deleteRecord).not.toHaveBeenCalled()
  })
})
