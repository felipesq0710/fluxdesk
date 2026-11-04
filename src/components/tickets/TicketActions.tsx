import { useState } from 'react'
import { Hand, LogOut, RotateCcw, ThumbsUp } from 'lucide-react'
import { toast } from 'sonner'
import { Alert } from '@/components/ui/Alert'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SelectField } from '@/components/ui/SelectField'
import { useAppSettings } from '@/hooks/useSettings'
import { useCategories, useStaff, useUpdateTicket } from '@/hooks/useTickets'
import { dbErrorMessage } from '@/lib/errors'
import { PRIORITIES, PRIORITY_LABEL, STATUS_LABEL } from '@/lib/ticketLabels'
import {
  canAssignOthers,
  canChangeCategory,
  canChangePriority,
  canClaim,
  canRelease,
  statusTransitionsFor,
  transitionBlockedReason,
  type Actor,
} from '@/lib/ticketRules'
import { isReopenWindowExpired } from '@/lib/ticketRules'
import type { TicketPatch } from '@/services/tickets'
import type { Ticket, TicketPriority, TicketStatus } from '@/types/domain'

interface PendingConfirm {
  title: string
  description: string
  confirmLabel: string
  patch: TicketPatch
  success: string
}

export function TicketActions({ ticket, actor }: { ticket: Ticket; actor: Actor }) {
  const update = useUpdateTicket(ticket.id)
  const staff = useStaff(canAssignOthers(actor))
  const categories = useCategories(true)
  const { settings } = useAppSettings()
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null)

  const transitions = statusTransitionsFor(ticket, actor)
  const isRequester = actor.role === 'requester'
  const reopenExpired = isReopenWindowExpired(ticket.resolved_at, settings.requester_reopen_days)
  const showPriority = canChangePriority(ticket, actor)
  const showCategory = actor.role !== 'requester' && canChangeCategory(ticket, actor)
  const showAssignee = canAssignOthers(actor)
  const showClaim = canClaim(ticket, actor)
  const showRelease = canRelease(ticket, actor)

  async function apply(patch: TicketPatch, success: string) {
    try {
      await update.mutateAsync(patch)
      toast.success(success)
    } catch (error) {
      toast.error(dbErrorMessage(error))
    }
  }

  function changeStatus(next: TicketStatus) {
    if (next === ticket.status) return
    if (next === 'closed') {
      setConfirm({
        title: 'Encerrar chamado?',
        description:
          actor.role === 'admin'
            ? 'O chamado ficará encerrado e não aceitará novas mensagens. Apenas administradores podem reabri-lo.'
            : 'O chamado ficará encerrado e não aceitará novas mensagens. Somente um administrador poderá reabri-lo.',
        confirmLabel: 'Encerrar chamado',
        patch: { status: 'closed' },
        success: 'Chamado encerrado.',
      })
      return
    }
    void apply({ status: next }, `Status alterado para "${STATUS_LABEL[next]}".`)
  }

  if (isRequester) {
    return (
      <div className="space-y-3">
        {ticket.status === 'waiting_requester' && (
          <Alert variant="warning" title="A equipe aguarda sua resposta">
            Responda na conversa para retomar o atendimento.
          </Alert>
        )}
        {ticket.status === 'resolved' && (
          <>
            <Alert variant="success" title="Chamado resolvido">
              Confirme se o problema foi resolvido ou reabra o chamado.
            </Alert>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="btn-primary"
                disabled={update.isPending}
                onClick={() =>
                  setConfirm({
                    title: 'Confirmar resolução?',
                    description: 'O chamado será encerrado e não aceitará novas mensagens.',
                    confirmLabel: 'Confirmar e encerrar',
                    patch: { status: 'closed' },
                    success: 'Resolução confirmada. Chamado encerrado.',
                  })
                }
              >
                <ThumbsUp className="h-4 w-4" aria-hidden="true" />
                Confirmar resolução
              </button>
              {reopenExpired ? (
                <p className="text-sm text-fg-muted">O prazo de {settings.requester_reopen_days} dia(s) para reabrir este chamado terminou. Abra um novo chamado se o problema voltou.</p>
              ) : (
                <button type="button" className="btn-secondary" disabled={update.isPending} onClick={() => void apply({ status: 'open' }, 'Chamado reaberto.')}>
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Reabrir chamado
                </button>
              )}
            </div>
          </>
        )}
        {transitions.length === 0 && ticket.status !== 'waiting_requester' && ticket.status !== 'resolved' && (
          <p className="text-sm text-fg-muted">Nenhuma ação necessária de sua parte no momento.</p>
        )}
        <ConfirmDialog
          open={confirm !== null}
          title={confirm?.title ?? ''}
          description={confirm?.description ?? ''}
          confirmLabel={confirm?.confirmLabel}
          pending={update.isPending}
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            if (confirm) await apply(confirm.patch, confirm.success)
            setConfirm(null)
          }}
        />
      </div>
    )
  }

  const nothing = transitions.length === 0 && !showPriority && !showCategory && !showAssignee && !showClaim && !showRelease
  const assigneeHint = transitions.some((s) => transitionBlockedReason(ticket, s, actor)) ? 'Atribua um responsável para liberar o atendimento.' : null

  return (
    <div className="space-y-4">
      {(showClaim || showRelease) && (
        <div className="flex flex-col gap-2">
          {showClaim && (
            <button type="button" className="btn-primary" disabled={update.isPending} onClick={() => void apply({ assignee_id: actor.id }, 'Você assumiu o chamado.')}>
              <Hand className="h-4 w-4" aria-hidden="true" />
              Assumir chamado
            </button>
          )}
          {showRelease && (
            <button
              type="button"
              className="btn-secondary"
              disabled={update.isPending}
              onClick={() => void apply({ assignee_id: null, status: 'open' }, 'Chamado devolvido à fila.')}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Liberar chamado
            </button>
          )}
        </div>
      )}

      {transitions.length > 0 && (
        <div>
          <SelectField label="Status" value={ticket.status} disabled={update.isPending} onChange={(e) => changeStatus(e.target.value as TicketStatus)}>
            <option value={ticket.status}>{STATUS_LABEL[ticket.status]} (atual)</option>
            {transitions.map((s) => (
              <option key={s} value={s} disabled={transitionBlockedReason(ticket, s, actor) !== null}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </SelectField>
          {assigneeHint && <p className="field-hint">{assigneeHint}</p>}
        </div>
      )}

      {showPriority && (
        <SelectField
          label="Prioridade"
          value={ticket.priority}
          disabled={update.isPending}
          onChange={(e) => void apply({ priority: e.target.value as TicketPriority }, 'Prioridade atualizada.')}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </SelectField>
      )}

      {showCategory && (
        <SelectField
          label="Categoria"
          value={ticket.category_id}
          disabled={update.isPending || categories.isPending}
          onChange={(e) => void apply({ category_id: e.target.value }, 'Categoria atualizada.')}
        >
          {ticket.category && !(categories.data ?? []).some((c) => c.id === ticket.category_id) && (
            <option value={ticket.category_id}>{ticket.category.name} (inativa)</option>
          )}
          {(categories.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
      )}

      {showAssignee && (
        <SelectField
          label="Responsável"
          value={ticket.assignee_id ?? ''}
          disabled={update.isPending || staff.isPending}
          onChange={(e) => void apply({ assignee_id: e.target.value || null }, e.target.value ? 'Responsável atribuído.' : 'Responsável removido.')}
        >
          {ticket.status === 'open' && <option value="">Sem responsável</option>}
          {ticket.assignee_id === null && ticket.status !== 'open' && <option value="">Selecione…</option>}
          {(staff.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
            </option>
          ))}
        </SelectField>
      )}

      {nothing && <p className="text-sm text-fg-muted">Você não tem ações disponíveis para este chamado.</p>}

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title ?? ''}
        description={confirm?.description ?? ''}
        confirmLabel={confirm?.confirmLabel}
        destructive
        pending={update.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (confirm) await apply(confirm.patch, confirm.success)
          setConfirm(null)
        }}
      />
    </div>
  )
}
