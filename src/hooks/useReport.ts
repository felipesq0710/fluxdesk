import { useQuery } from '@tanstack/react-query'
import type { ReportFilters } from '@/lib/report'
import { fetchReport } from '@/services/reports'

export function useReport(filters: ReportFilters, userId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    // Prefixo 'report' é invalidado quando chamados mudam (ver useTickets).
    queryKey: ['report', filters, userId] as const,
    queryFn: () => fetchReport(filters, userId),
    staleTime: 30_000,
    enabled: options.enabled ?? true,
  })
}
