// Gerador de CSV para o Excel em português: separador ";", CRLF e BOM UTF-8.
// Células que começariam com =, +, -, @, tab ou CR recebem um apóstrofo à frente,
// impedindo que planilhas interpretem texto de usuários como fórmula (CSV injection).

// Marca de ordem de bytes UTF-8: faz o Excel reconhecer a codificação.
const BOM = String.fromCharCode(0xfeff)

const FORMULA_START = /^[=+\-@\t\r]/

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  let text = typeof value === 'number' ? String(value).replace('.', ',') : String(value)
  if (FORMULA_START.test(text)) text = `'${text}`
  if (/[;"\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`
  return text
}

export interface CsvColumn<T> {
  header: string
  value: (row: T) => unknown
}

export function buildCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((c) => csvCell(c.header)).join(';')]
  for (const row of rows) lines.push(columns.map((c) => csvCell(c.value(row))).join(';'))
  return `${BOM}${lines.join('\r\n')}\r\n`
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function csvDateTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
