export interface AttachmentDeletionSteps<T> {
  readObject: () => Promise<T>
  removeObject: () => Promise<void>
  deleteRecord: () => Promise<void>
  restoreObject: (snapshot: T) => Promise<void>
  isObjectMissing: (error: unknown) => boolean
}

export class AttachmentRecoveryError extends Error {
  readonly originalError: unknown
  readonly recoveryError: unknown

  constructor(originalError: unknown, recoveryError: unknown) {
    super('O arquivo foi removido, mas não foi possível restaurá-lo após uma falha ao remover os dados do anexo.')
    this.name = 'AttachmentRecoveryError'
    this.originalError = originalError
    this.recoveryError = recoveryError
  }
}

/** Coordinates Storage and metadata operations, which cannot share a transaction. */
export async function deleteAttachmentSafely<T>(steps: AttachmentDeletionSteps<T>): Promise<void> {
  let snapshot: T | undefined
  try {
    snapshot = await steps.readObject()
  } catch (error) {
    if (!steps.isObjectMissing(error)) throw error
    // A previous attempt may have removed the object but failed to delete its row.
    await steps.deleteRecord()
    return
  }

  await steps.removeObject()
  try {
    await steps.deleteRecord()
  } catch (error) {
    try {
      await steps.restoreObject(snapshot)
    } catch (recoveryError) {
      throw new AttachmentRecoveryError(error, recoveryError)
    }
    throw error
  }
}
