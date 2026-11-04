import { TicketListView } from '@/components/tickets/TicketListView'
import { useProfile } from '@/hooks/useAuth'

export default function TicketsPage() {
  const profile = useProfile()
  const requester = profile.role === 'requester'
  return (
    <TicketListView
      title={requester ? 'Meus chamados' : 'Chamados'}
      description={
        requester
          ? 'Acompanhe as solicitações que você abriu.'
          : profile.role === 'technician'
            ? 'Chamados atribuídos a você e chamados sem responsável.'
            : 'Todos os chamados da organização.'
      }
      emptyTitle={requester ? 'Você ainda não abriu chamados' : 'Nenhum chamado por aqui'}
      emptyDescription={
        requester
          ? 'Precisa de ajuda? Abra um chamado e acompanhe o atendimento.'
          : 'Quando houver chamados, eles aparecerão nesta lista.'
      }
    />
  )
}
