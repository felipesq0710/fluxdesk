import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  parseReportFilters,
  reportFiltersToParams,
  type ReportFilters,
} from '@/lib/report'

export function useReportFilters(defaults: ReportFilters) {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => parseReportFilters(params, defaults), [params, defaults])

  const update = useCallback(
    (patch: Partial<ReportFilters>) => {
      setParams(reportFiltersToParams({ ...filters, ...patch }, defaults), { replace: true })
    },
    [filters, defaults, setParams],
  )
  const clear = useCallback(() => setParams(new URLSearchParams(), { replace: true }), [setParams])
  const dirty = params.toString() !== ''
  return { filters, update, clear, dirty }
}
