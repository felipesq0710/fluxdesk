import { useId, useRef, useState } from 'react'
import { FileText, Paperclip, X } from 'lucide-react'
import {
  ALLOWED_ATTACHMENT_TYPES,
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENTS_PER_UPLOAD,
  MAX_ATTACHMENT_BYTES,
  formatBytes,
  validateAttachments,
} from '@/lib/attachments'

export function AttachmentPicker({
  files,
  onChange,
  disabled = false,
  label = 'Anexos',
}: {
  files: File[]
  onChange: (files: File[]) => void
  disabled?: boolean
  label?: string
}) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [errors, setErrors] = useState<string[]>([])

  function handleSelect(list: FileList | null) {
    if (!list) return
    const { accepted, errors: found } = validateAttachments(Array.from(list), files.length)
    setErrors(found)
    if (accepted.length > 0) onChange([...files, ...accepted])
    // Permite escolher o mesmo arquivo novamente após removê-lo.
    if (inputRef.current) inputRef.current.value = ''
  }

  const types = [...new Set(Object.values(ALLOWED_ATTACHMENT_TYPES))].join(', ')

  return (
    <div>
      <label htmlFor={inputId} className="field-label">
        {label}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        multiple
        accept={ATTACHMENT_ACCEPT}
        disabled={disabled || files.length >= MAX_ATTACHMENTS_PER_UPLOAD}
        onChange={(e) => handleSelect(e.target.files)}
        aria-describedby={`${inputId}-hint`}
        className="block w-full cursor-pointer rounded-control border border-dashed border-line bg-surface p-2 text-sm text-fg-muted file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-solid file:border-line file:bg-surface-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-fg hover:file:bg-line disabled:cursor-not-allowed disabled:opacity-60"
      />
      <p id={`${inputId}-hint`} className="field-hint">
        Até {MAX_ATTACHMENTS_PER_UPLOAD} arquivos de {formatBytes(MAX_ATTACHMENT_BYTES)} cada. Tipos aceitos: {types}.
      </p>

      {errors.length > 0 && (
        <ul role="alert" className="mt-2 space-y-1 text-sm text-red-700 dark:text-red-400">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <ul className="mt-3 space-y-2" aria-label="Arquivos selecionados">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="flex items-center gap-3 rounded-control border border-line bg-surface px-3 py-2 text-sm">
              {file.type.startsWith('image/') ? (
                <Paperclip className="h-4 w-4 shrink-0 text-fg-muted" aria-hidden="true" />
              ) : (
                <FileText className="h-4 w-4 shrink-0 text-fg-muted" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1 truncate text-fg" title={file.name}>
                {file.name}
              </span>
              <span className="shrink-0 text-xs text-fg-muted">{formatBytes(file.size)}</span>
              <button
                type="button"
                className="btn-ghost !min-h-0 p-1"
                aria-label={`Remover ${file.name}`}
                disabled={disabled}
                onClick={() => {
                  setErrors([])
                  onChange(files.filter((_, i) => i !== index))
                }}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
