const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const dateOnly = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })
const longDateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' })

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso))
}

export function formatDate(iso: string): string {
  return dateOnly.format(new Date(iso))
}

export function formatLongDateTime(iso: string): string {
  return longDateTime.format(new Date(iso))
}

const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })

export function formatRelative(iso: string, now: Date = new Date()): string {
  const diffSeconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000)
  const abs = Math.abs(diffSeconds)
  if (abs < 45) return 'agora há pouco'
  if (abs < 3600) return rtf.format(Math.round(diffSeconds / 60), 'minute')
  if (abs < 86_400) return rtf.format(Math.round(diffSeconds / 3600), 'hour')
  if (abs < 7 * 86_400) return rtf.format(Math.round(diffSeconds / 86_400), 'day')
  return formatDate(iso)
}

export function formatHours(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`
  if (hours < 24) return `${hours.toFixed(1).replace('.', ',').replace(',0', '')} h`
  const days = Math.floor(hours / 24)
  const rest = Math.round(hours - days * 24)
  return rest > 0 ? `${days} d ${rest} h` : `${days} d`
}
