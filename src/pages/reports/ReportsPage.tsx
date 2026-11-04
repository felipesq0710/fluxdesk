import { useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { ReportFiltersBar } from '@/components/reports/ReportFiltersBar'
import { ReportStatus, ReportView } from '@/components/reports/ReportView'
import { Spinner } from '@/components/ui/Spinner'
import { useProfile } from '@/hooks/useAuth'
import { useReport } from '@/hooks/useReport'
import { useReportFilters } from '@/hooks/useReportFilters'
import { useCategories, useStaff } from '@/hooks/useTickets'
import { buildCsv, csvDateTime, downloadCsv, type CsvColumn } from '@/lib/csv'
import { DEFAULT_REPORT_FILTERS } from '@/lib/report'
import { PRIORITY_LABEL, STATUS_LABEL } from '@/lib/ticketLabels'
import { EXPORT_MAX_ROWS, fetchTicketsForExport, type ExportRow } from '@/services/reports'
import type { TicketPriority, TicketStatus } from '@/types/domain'

const COLUMNS: CsvColumn<ExportRow>[] = [
  { header: 'Número', value: (r) => r.code },
  { header: 'Título', value: (r) => r.title },
  { header: 'Status', value: (r) => STATUS_LABEL[r.status as TicketStatus] ?? r.status },
  { header: 'Prioridade', value: (r) => PRIORITY_LABEL[r.priority as TicketPriority] ?? r.priority },
  { header: 'Categoria', value: (r) => r.category },
  { header: 'Solicitante', value: (r) => r.requester },
  { header: 'Responsável', value: (r) => r.assignee },
  { header: 'Criado em', value: (r) => csvDateTime(r.created_at) },
  { header: 'Atualizado em', value: (r) => csvDateTime(r.updated_at) },
  { header: 'Resolvido em', value: (r) => csvDateTime(r.resolved_at) },
]

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ReportsPage() {
  const profile = useProfile()
  const { filters, update, clear, dirty } = useReportFilters(DEFAULT_REPORT_FILTERS)
  const report = useReport(filters, profile.id)
  const categories = useCategories(false)
  const staff = useStaff()
  const [exporting, setExporting] = useState(false)

  async function exportCsv() {
    setExporting(true)
    try {
      const { rows, truncated } = await fetchTicketsForExport(filters, profile.id)
      if (rows.length === 0) {
        toast.info('Nenhum chamado para exportar com os filtros atuais.')
        return
      }
      downloadCsv(`fluxdesk-chamados-${today()}.csv`, buildCsv(rows, COLUMNS))
      if (truncated) toast.warning(`A exportação foi limitada a ${EXPORT_MAX_ROWS.toLocaleString('pt-BR')} chamados. Refine os filtros para exportar o restante.`)
      else toast.success(`${rows.length} chamado${rows.length === 1 ? '' : 's'} exportado${rows.length === 1 ? '' : 's'}.`)
    } catch {
      toast.error('Não foi possível exportar. Tente novamente.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Relatórios</h1>
          <p className="page-lead">Indicadores e exportação dos chamados. Notas internas não fazem parte do relatório.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => void exportCsv()} disabled={exporting}>
          {exporting ? <Spinner /> : <Download className="h-4 w-4" aria-hidden="true" />}
          {exporting ? 'Exportando…' : 'Exportar CSV'}
        </button>
      </div>

      <ReportFiltersBar
        filters={filters}
        onChange={update}
        onClear={clear}
        categories={categories.data ?? []}
        staff={staff.data ?? []}
        dirty={dirty}
      />

      <ReportStatus isLoading={report.isLoading} isError={report.isError} onRetry={() => void report.refetch()} />
      {report.data && <ReportView data={report.data} filters={filters} showAssignees />}

      <p className="text-xs text-fg-muted">
        O período filtra pela data de criação. Resolvidos na linha do tempo contam pela data de resolução. O CSV usa “;” como separador e abre
        direto no Excel em português.
      </p>
    </div>
  )
}
