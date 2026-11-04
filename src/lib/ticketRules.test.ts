import { describe, expect, it } from 'vitest'
import {
  canAssignOthers,
  canAttach,
  canChangePriority,
  canClaim,
  canComment,
  commentBlockedReason,
  canEditContent,
  canRelease,
  isReopenWindowExpired,
  statusTransitionsFor,
  transitionBlockedReason,
  type Actor,
} from '@/lib/ticketRules'
import type { Ticket } from '@/types/domain'

const requester: Actor = { id: 'req', role: 'requester' }
const otherRequester: Actor = { id: 'req2', role: 'requester' }
const tech: Actor = { id: 'tech', role: 'technician' }
const otherTech: Actor = { id: 'tech2', role: 'technician' }
const admin: Actor = { id: 'adm', role: 'admin' }

type T = Pick<Ticket, 'requester_id' | 'assignee_id' | 'status'>
const ticket = (over: Partial<T> = {}): T => ({ requester_id: 'req', assignee_id: null, status: 'open', ...over })

describe('transições de status', () => {
  it('administrador segue o mapa completo, inclusive reabrir encerrado', () => {
    expect(statusTransitionsFor(ticket({ status: 'closed' }), admin)).toEqual(['open'])
    expect(statusTransitionsFor(ticket({ status: 'resolved' }), admin)).toEqual(['open', 'in_progress', 'closed'])
  })

  it('técnico atua em chamado livre ou próprio, nunca em chamado de outro técnico', () => {
    expect(statusTransitionsFor(ticket(), tech)).toContain('in_progress')
    expect(statusTransitionsFor(ticket({ assignee_id: 'tech', status: 'in_progress' }), tech)).toContain('resolved')
    expect(statusTransitionsFor(ticket({ assignee_id: 'tech', status: 'in_progress' }), otherTech)).toEqual([])
  })

  it('técnico não reabre chamado encerrado', () => {
    expect(statusTransitionsFor(ticket({ assignee_id: 'tech', status: 'closed' }), tech)).toEqual([])
  })

  it('solicitante só responde solicitação, confirma ou reabre resolvido', () => {
    expect(statusTransitionsFor(ticket({ status: 'waiting_requester', assignee_id: 'tech' }), requester)).toEqual(['in_progress'])
    expect(statusTransitionsFor(ticket({ status: 'resolved', assignee_id: 'tech' }), requester)).toEqual(['closed', 'open'])
    expect(statusTransitionsFor(ticket({ status: 'in_progress', assignee_id: 'tech' }), requester)).toEqual([])
    expect(statusTransitionsFor(ticket({ status: 'closed' }), requester)).toEqual([])
  })

  it('solicitante não age em chamado de outra pessoa', () => {
    expect(statusTransitionsFor(ticket({ status: 'resolved' }), otherRequester)).toEqual([])
  })

  it('administrador precisa atribuir responsável antes de iniciar o atendimento; técnico assume sozinho', () => {
    expect(transitionBlockedReason(ticket(), 'in_progress', admin)).toMatch(/Atribua um responsável/)
    expect(transitionBlockedReason(ticket(), 'in_progress', tech)).toBeNull()
    expect(transitionBlockedReason(ticket(), 'closed', admin)).toBeNull()
    expect(transitionBlockedReason(ticket({ assignee_id: 'tech' }), 'resolved', admin)).toBeNull()
  })
})

describe('edição, atribuição e prioridade', () => {
  it('solicitante edita apenas enquanto aberto e sem responsável', () => {
    expect(canEditContent(ticket(), requester)).toBe(true)
    expect(canEditContent(ticket({ assignee_id: 'tech' }), requester)).toBe(false)
    expect(canEditContent(ticket({ status: 'in_progress' }), requester)).toBe(false)
    expect(canEditContent(ticket(), otherRequester)).toBe(false)
    expect(canEditContent(ticket(), tech)).toBe(false)
    expect(canEditContent(ticket({ status: 'closed' }), admin)).toBe(true)
  })

  it('apenas equipe altera prioridade', () => {
    expect(canChangePriority(ticket(), requester)).toBe(false)
    expect(canChangePriority(ticket(), tech)).toBe(true)
    expect(canChangePriority(ticket({ assignee_id: 'tech2' }), tech)).toBe(false)
    expect(canChangePriority(ticket({ assignee_id: 'tech2' }), admin)).toBe(true)
  })

  it('assumir e liberar', () => {
    expect(canClaim(ticket(), tech)).toBe(true)
    expect(canClaim(ticket({ assignee_id: 'tech2' }), tech)).toBe(false)
    expect(canClaim(ticket({ status: 'closed' }), tech)).toBe(false)
    expect(canClaim(ticket(), requester)).toBe(false)
    expect(canRelease(ticket({ assignee_id: 'tech' }), tech)).toBe(true)
    expect(canRelease(ticket({ assignee_id: 'tech2' }), tech)).toBe(false)
    expect(canRelease(ticket({ assignee_id: 'tech', status: 'in_progress' }), tech)).toBe(true)
    // De "Aguardando…" o banco não permite voltar a "Aberto": liberar exigiria antes retomar o atendimento.
    expect(canRelease(ticket({ assignee_id: 'tech', status: 'waiting_third_party' }), tech)).toBe(false)
    expect(canRelease(ticket({ assignee_id: 'tech', status: 'resolved' }), tech)).toBe(false)
  })

  it('só administrador atribui a terceiros', () => {
    expect(canAssignOthers(admin)).toBe(true)
    expect(canAssignOthers(tech)).toBe(false)
    expect(canAssignOthers(requester)).toBe(false)
  })
})

describe('comentários e anexos', () => {
  it('solicitante nunca cria nota interna', () => {
    expect(canComment(ticket(), requester, 'public')).toBe(true)
    expect(canComment(ticket(), requester, 'internal')).toBe(false)
  })

  it('técnico só comenta nos chamados atribuídos a ele', () => {
    expect(canComment(ticket({ assignee_id: 'tech' }), tech, 'internal')).toBe(true)
    expect(canComment(ticket(), tech, 'public')).toBe(false)
    expect(canComment(ticket({ assignee_id: 'tech2' }), tech, 'public')).toBe(false)
  })

  it('ninguém comenta em chamado encerrado', () => {
    for (const actor of [requester, tech, admin]) {
      expect(canComment(ticket({ status: 'closed', assignee_id: 'tech' }), actor, 'public')).toBe(false)
    }
    expect(canAttach(ticket({ status: 'closed' }), admin)).toBe(false)
  })

  it('outro solicitante não comenta', () => {
    expect(canComment(ticket(), otherRequester, 'public')).toBe(false)
  })
})

describe('commentBlockedReason', () => {
  it('explica cada bloqueio e retorna null quando pode comentar', () => {
    expect(commentBlockedReason(ticket({ status: 'closed' }), admin)).toMatch(/encerrado/)
    expect(commentBlockedReason(ticket(), tech)).toMatch(/Assuma o chamado/)
    expect(commentBlockedReason(ticket({ assignee_id: 'tech2' }), tech)).toMatch(/outro técnico/)
    expect(commentBlockedReason(ticket(), otherRequester)).toMatch(/não pode/)
    expect(commentBlockedReason(ticket(), requester)).toBeNull()
    expect(commentBlockedReason(ticket({ assignee_id: 'tech' }), tech)).toBeNull()
    expect(commentBlockedReason(ticket(), admin)).toBeNull()
  })
})

describe('isReopenWindowExpired', () => {
  const now = new Date('2026-10-10T12:00:00Z')
  it('sem limite configurado ou sem data de resolução nunca expira', () => {
    expect(isReopenWindowExpired('2020-01-01T00:00:00Z', null, now)).toBe(false)
    expect(isReopenWindowExpired(null, 3, now)).toBe(false)
  })
  it('compara com o prazo em dias', () => {
    expect(isReopenWindowExpired('2026-10-08T12:00:01Z', 3, now)).toBe(false)
    expect(isReopenWindowExpired('2026-10-06T00:00:00Z', 3, now)).toBe(true)
  })
})
