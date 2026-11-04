import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, SearchX } from 'lucide-react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { AttachmentsPanel } from '@/components/tickets/AttachmentsPanel'
import { CommentForm } from '@/components/tickets/CommentForm'
import { CommentThread } from '@/components/tickets/CommentThread'
import { HistoryTimeline } from '@/components/tickets/HistoryTimeline'
import { PriorityBadge, StatusBadge } from '@/components/tickets/badges'
import { TicketActions } from '@/components/tickets/TicketActions'
import { TicketContentEditor } from '@/components/tickets/TicketContentEditor'
import { Avatar } from '@/components/ui/Avatar'
import { Spinner } from '@/components/ui/Spinner'
import { useProfile } from '@/hooks/useAuth'
import { useComments, useHistory, useTicket } from '@/hooks/useTickets'
import { dbErrorMessage } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'
import { isUuid } from '@/lib/ids'
import type { ReactNode } from 'react'

function Section({ title, children, id, flat = false }: { title: string; children: ReactNode; id?: string; flat?: boolean }) {
  return (
    <section aria-labelledby={id} className={flat ? 'border-t border-line pt-6 first:border-0 first:pt-0' : 'min-w-0 p-5'}>
      <h2 id={id} className="section-title mb-4">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-fg-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-fg">{children}</dd>
    </div>
  )
}

function Conversation({ ticketId, children, currentUserId }: { ticketId: string; children: ReactNode; currentUserId: string }) {
  const comments = useComments(ticketId)
  return (
    <>
      {comments.isPending && (
        <div role="status" className="flex items-center gap-2 py-4 text-sm text-fg-muted">
          <Spinner /> Carregando conversa…
        </div>
      )}
      {comments.isError && <ErrorState title="Falha ao carregar a conversa" message={dbErrorMessage(comments.error)} onRetry={() => void comments.refetch()} />}
      {comments.isSuccess && <CommentThread comments={comments.data} currentUserId={currentUserId} />}
      <div className="mt-5 border-t border-line pt-5">{children}</div>
    </>
  )
}

function History({ ticketId }: { ticketId: string }) {
  const history = useHistory(ticketId)
  if (history.isPending) {
    return (
      <div role="status" className="flex items-center gap-2 text-sm text-fg-muted">
        <Spinner /> Carregando histórico…
      </div>
    )
  }
  if (history.isError) return <ErrorState title="Falha ao carregar o histórico" message={dbErrorMessage(history.error)} onRetry={() => void history.refetch()} />
  return <HistoryTimeline events={history.data} />
}

export default function TicketDetailPage() {
  const { id } = useParams()
  const profile = useProfile()
  const valid = isUuid(id)
  const ticketQuery = useTicket(valid ? id : undefined)
  const actor = { id: profile.id, role: profile.role }

  const back = (
    <Link to="/chamados" className="mb-4 inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Voltar para chamados
    </Link>
  )

  if (!valid || (ticketQuery.isSuccess && ticketQuery.data === null)) {
    return (
      <div>
        {back}
        <div className="card">
          <EmptyState
            icon={SearchX}
            title="Chamado não encontrado"
            description="O chamado não existe ou você não tem permissão para visualizá-lo."
            action={
              <Link to="/chamados" className="btn-primary">
                Ver meus chamados
              </Link>
            }
          />
        </div>
      </div>
    )
  }

  if (ticketQuery.isPending) {
    return (
      <div role="status" className="flex items-center gap-2 py-10 text-sm text-fg-muted">
        <Spinner /> Carregando chamado…
      </div>
    )
  }

  if (ticketQuery.isError) {
    return (
      <div>
        {back}
        <ErrorState title="Não foi possível carregar o chamado" message={dbErrorMessage(ticketQuery.error)} onRetry={() => void ticketQuery.refetch()} />
      </div>
    )
  }

  const ticket = ticketQuery.data
  if (!ticket) return null

  return (
    <div>
      {back}

      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-fg-muted">{ticket.code}</span>
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
        </div>
        <h1 className="page-title mt-2 break-words">{ticket.title}</h1>
      </header>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0 space-y-8">
          <Section flat title="Descrição" id="sec-description">
            <TicketContentEditor key={ticket.updated_at} ticket={ticket} actor={actor} />
          </Section>

          <Section flat title="Conversa" id="sec-conversation">
            <Conversation ticketId={ticket.id} currentUserId={profile.id}>
              <CommentForm ticket={ticket} actor={actor} />
            </Conversation>
          </Section>

          <Section flat title="Histórico" id="sec-history">
            <History ticketId={ticket.id} />
          </Section>
        </div>

        <aside
          className="card divide-y divide-line self-start md:order-first md:grid md:grid-cols-3 md:divide-x md:divide-y-0 xl:order-none xl:block xl:divide-x-0 xl:divide-y"
          aria-label="Detalhes e ações"
        >
          <Section title="Ações" id="sec-actions">
            <TicketActions ticket={ticket} actor={actor} />
          </Section>

          <Section title="Detalhes" id="sec-details">
            <dl className="space-y-3">
              <Detail label="Solicitante">{ticket.requester ? <span className="flex items-center gap-2"><Avatar name={ticket.requester.full_name} />{ticket.requester.full_name}</span> : '—'}</Detail>
              <Detail label="Responsável">{ticket.assignee ? <span className="flex items-center gap-2"><Avatar name={ticket.assignee.full_name} />{ticket.assignee.full_name}</span> : 'Sem responsável'}</Detail>
              <Detail label="Categoria">{ticket.category?.name ?? '—'}</Detail>
              <Detail label="Aberto em">{formatDateTime(ticket.created_at)}</Detail>
              <Detail label="Última atualização">{formatDateTime(ticket.updated_at)}</Detail>
              {ticket.resolved_at && <Detail label="Resolvido em">{formatDateTime(ticket.resolved_at)}</Detail>}
              {ticket.closed_at && <Detail label="Encerrado em">{formatDateTime(ticket.closed_at)}</Detail>}
            </dl>
          </Section>

          <Section title="Anexos" id="sec-attachments">
            <AttachmentsPanel ticket={ticket} actor={actor} />
          </Section>
        </aside>
      </div>
    </div>
  )
}
