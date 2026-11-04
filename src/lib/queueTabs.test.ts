import { describe, expect, it } from 'vitest'
import { parseQueueTab, recentSince, scopeForTab } from '@/lib/queueTabs'

describe('abas da fila', () => {
  it('parseQueueTab usa "mine" para valores desconhecidos', () => {
    expect(parseQueueTab(null)).toBe('mine')
    expect(parseQueueTab('hack')).toBe('mine')
    expect(parseQueueTab('critical')).toBe('critical')
  })

  it('cada aba produz o escopo esperado', () => {
    const since = '2026-10-01T00:00:00.000Z'
    expect(scopeForTab('mine', 'u1', since)).toEqual({ assignedTo: 'u1', activeOnly: true })
    expect(scopeForTab('unassigned', 'u1', since)).toEqual({ unassigned: true, activeOnly: true })
    expect(scopeForTab('critical', 'u1', since)).toEqual({ priority: 'critical', activeOnly: true })
    expect(scopeForTab('waiting', 'u1', since)).toEqual({ assignedTo: 'u1', status: 'waiting_requester' })
    expect(scopeForTab('recent', 'u1', since)).toEqual({ assignedTo: 'u1', updatedSince: since })
  })

  it('recentSince é estável dentro da mesma hora e fica 48 h para trás', () => {
    const base = Date.parse('2026-10-10T12:10:00Z')
    expect(recentSince(base)).toBe(recentSince(base + 20 * 60_000))
    expect(recentSince(base)).toBe('2026-10-08T12:00:00.000Z')
  })
})
