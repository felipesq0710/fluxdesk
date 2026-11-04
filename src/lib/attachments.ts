export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
export const MAX_ATTACHMENTS_PER_UPLOAD = 5

export const ALLOWED_ATTACHMENT_TYPES: Record<string, string> = {
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/webp': 'WebP',
  'image/gif': 'GIF',
  'application/pdf': 'PDF',
  'text/plain': 'TXT',
  'text/csv': 'CSV',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
}

export const ATTACHMENT_ACCEPT = Object.keys(ALLOWED_ATTACHMENT_TYPES).join(',')

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

// Retorna a mensagem de erro ou null se o arquivo é aceitável.
export function validateAttachment(file: Pick<File, 'name' | 'size' | 'type'>): string | null {
  if (file.size === 0) return `"${file.name}" está vazio.`
  if (!(file.type in ALLOWED_ATTACHMENT_TYPES)) {
    return `"${file.name}": tipo de arquivo não permitido. Use imagens, PDF, TXT, CSV, DOCX ou XLSX.`
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return `"${file.name}" excede o limite de ${formatBytes(MAX_ATTACHMENT_BYTES)}.`
  }
  return null
}

export function validateAttachments(
  files: File[],
  alreadySelected = 0,
): { accepted: File[]; errors: string[] } {
  const accepted: File[] = []
  const errors: string[] = []
  for (const file of files) {
    if (alreadySelected + accepted.length >= MAX_ATTACHMENTS_PER_UPLOAD) {
      errors.push(`Limite de ${MAX_ATTACHMENTS_PER_UPLOAD} arquivos por envio.`)
      break
    }
    const error = validateAttachment(file)
    if (error) errors.push(error)
    else accepted.push(file)
  }
  return { accepted, errors }
}

// Nome seguro para o caminho no Storage (sem separadores nem caracteres especiais).
export function safeStorageName(name: string): string {
  const cleaned = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^\.+/, '')
    .slice(-100)
  return cleaned || 'arquivo'
}
