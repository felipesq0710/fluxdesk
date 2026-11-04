import { useState } from 'react'
import { Download, FileText, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ErrorState } from '@/components/feedback/ErrorState'
import { AttachmentPicker } from '@/components/tickets/AttachmentPicker'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/ui/Spinner'
import { useAttachments, useDeleteAttachment, useUploadAttachments } from '@/hooks/useTickets'
import { formatBytes } from '@/lib/attachments'
import { dbErrorMessage } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'
import { canAttach, canDeleteAttachment, type Actor } from '@/lib/ticketRules'
import { getAttachmentUrl } from '@/services/tickets'
import type { Ticket, TicketAttachment } from '@/types/domain'

export function AttachmentsPanel({ ticket, actor }: { ticket: Ticket; actor: Actor }) {
  const attachments = useAttachments(ticket.id)
  const upload = useUploadAttachments(ticket.id)
  const remove = useDeleteAttachment(ticket.id)
  const [files, setFiles] = useState<File[]>([])
  const [toDelete, setToDelete] = useState<TicketAttachment | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)

  async function handleDownload(a: TicketAttachment) {
    setDownloading(a.id)
    try {
      const url = await getAttachmentUrl(a.storage_path, a.file_name)
      const link = document.createElement('a')
      link.href = url
      link.rel = 'noopener'
      link.click()
    } catch (error) {
      toast.error(dbErrorMessage(error))
    } finally {
      setDownloading(null)
    }
  }

  async function handleUpload() {
    if (files.length === 0) return
    const outcome = await upload.mutateAsync({ uploaderId: actor.id, files })
    if (outcome.uploaded > 0) toast.success(outcome.uploaded === 1 ? 'Arquivo enviado.' : `${outcome.uploaded} arquivos enviados.`)
    if (outcome.failed.length > 0) {
      toast.error(`Não foi possível enviar: ${outcome.failed.map((f) => f.name).join(', ')}.`)
      // Mantém na seleção apenas os que falharam, para nova tentativa.
      const failedNames = new Set(outcome.failed.map((f) => f.name))
      setFiles(files.filter((f) => failedNames.has(f.name)))
    } else {
      setFiles([])
    }
  }

  async function confirmDelete() {
    if (!toDelete) return
    try {
      await remove.mutateAsync(toDelete)
      toast.success('Anexo removido.')
    } catch (error) {
      toast.error(dbErrorMessage(error))
    } finally {
      setToDelete(null)
    }
  }

  return (
    <div>
      {attachments.isPending && (
        <div role="status" className="flex items-center gap-2 text-sm text-fg-muted">
          <Spinner /> Carregando anexos…
        </div>
      )}
      {attachments.isError && (
        <ErrorState title="Falha ao carregar anexos" message={dbErrorMessage(attachments.error)} onRetry={() => void attachments.refetch()} />
      )}
      {attachments.isSuccess && attachments.data.length === 0 && <p className="text-sm text-fg-muted">Nenhum anexo.</p>}
      {attachments.isSuccess && attachments.data.length > 0 && (
        <ul className="space-y-2" aria-label="Anexos do chamado">
          {attachments.data.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-control border border-line bg-surface p-2.5 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-fg-muted" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-fg" title={a.file_name}>
                  {a.file_name}
                </p>
                <p className="text-xs text-fg-muted">
                  {formatBytes(a.size_bytes)} · {a.uploader?.full_name ?? '—'} · {formatDateTime(a.created_at)}
                </p>
              </div>
              <button
                type="button"
                className="btn-ghost !min-h-0 p-1.5"
                onClick={() => void handleDownload(a)}
                disabled={downloading === a.id}
                aria-label={`Baixar ${a.file_name}`}
              >
                {downloading === a.id ? <Spinner /> : <Download className="h-4 w-4" aria-hidden="true" />}
              </button>
              {canDeleteAttachment(a.uploader_id, actor) && (
                <button type="button" className="btn-ghost !min-h-0 p-1.5 text-danger" onClick={() => setToDelete(a)} aria-label={`Remover ${a.file_name}`}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canAttach(ticket, actor) && (
        <div className="mt-4 border-t border-line pt-4">
          <AttachmentPicker files={files} onChange={setFiles} disabled={upload.isPending} label="Adicionar anexos" />
          {files.length > 0 && (
            <button type="button" className="btn-primary mt-3 w-full" onClick={() => void handleUpload()} disabled={upload.isPending}>
              {upload.isPending && <Spinner />}
              {upload.isPending ? 'Enviando…' : `Enviar ${files.length === 1 ? 'arquivo' : `${files.length} arquivos`}`}
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Remover anexo?"
        description={`O arquivo "${toDelete?.file_name ?? ''}" será removido permanentemente deste chamado.`}
        confirmLabel="Remover"
        destructive
        pending={remove.isPending}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}
