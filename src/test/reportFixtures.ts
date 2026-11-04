import type { ReportData } from '@/lib/report'

export function makeReport(over: Partial<ReportData> = {}): ReportData {
  return {
    totals: { total: 10, open: 3, in_progress: 2, waiting: 1, resolved: 4, critical: 1, resolved_with_date: 4, avg_resolution_hours: 26.5 },
    by_status: [
      { key: 'open', count: 3 },
      { key: 'in_progress', count: 2 },
      { key: 'resolved', count: 4 },
    ],
    by_priority: [
      { key: 'high', count: 6 },
      { key: 'critical', count: 1 },
    ],
    by_category: [
      { key: 'Software', count: 7 },
      { key: 'Rede', count: 3 },
    ],
    by_assignee: [{ key: 'Ana Técnica', count: 5, resolved: 4, avg_resolution_hours: 20 }],
    timeline: [{ day: '2026-10-20', created: 2, resolved: 1 }],
    ...over,
  }
}
