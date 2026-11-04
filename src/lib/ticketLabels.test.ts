import { describe, expect, it } from 'vitest'
import { describeHistoryEvent } from '@/lib/ticketLabels'

describe('describeHistoryEvent', () => {
  it('descreve prioridade com rótulos em português', () => {
    expect(describeHistoryEvent({ event_type: 'priority_changed', old_value: 'low', new_value: 'critical' })).toBe(
      'Prioridade: Baixa → Crítica',
    )
  })

  it('descreve atribuição e liberação', () => {
    expect(describeHistoryEvent({ event_type: 'assignee_changed', old_value: null, new_value: 'Tiago' })).toBe('Atribuído a Tiago')
    expect(describeHistoryEvent({ event_type: 'assignee_changed', old_value: 'Tiago', new_value: null })).toMatch(/Liberado por Tiago/)
    expect(describeHistoryEvent({ event_type: 'assignee_changed', old_value: 'Tiago', new_value: 'Teresa' })).toBe('Responsável: Tiago → Teresa')
  })

  it('descreve mudanças de status', () => {
    expect(describeHistoryEvent({ event_type: 'reopened', old_value: 'Resolvido', new_value: 'Aberto' })).toBe(
      'Chamado reaberto: Resolvido → Aberto',
    )
    expect(describeHistoryEvent({ event_type: 'created', old_value: null, new_value: 'Aberto' })).toBe('Chamado criado com status Aberto')
  })
})
