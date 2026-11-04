import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TicketFilters } from '@/lib/ticketFilters'
import * as api from '@/services/tickets'
import type { CommentKind, Ticket, TicketAttachment } from '@/types/domain'

export const ticketKeys = {
  all: ['tickets'] as const,
  list: (filters: TicketFilters, userId: string, scope: api.TicketScope) =>
    ['tickets', 'list', filters, userId, scope] as const,
  detail: (id: string) => ['ticket', id] as const,
  comments: (id: string) => ['ticket', id, 'comments'] as const,
  history: (id: string) => ['ticket', id, 'history'] as const,
  attachments: (id: string) => ['ticket', id, 'attachments'] as const,
  categories: (onlyActive: boolean) => ['categories', onlyActive] as const,
  staff: ['staff'] as const,
}

export function useTickets(filters: TicketFilters, userId: string, scope: api.TicketScope = {}) {
  return useQuery({
    queryKey: ticketKeys.list(filters, userId, scope),
    queryFn: () => api.listTickets(filters, userId, scope),
    // Mantém a página anterior visível durante a troca de página/filtro (sem piscar).
    placeholderData: keepPreviousData,
  })
}

export function useTicketCount(userId: string, scope: api.TicketScope) {
  return useQuery({
    queryKey: ['tickets', 'count', userId, scope] as const,
    queryFn: () => api.countTickets(userId, scope),
    staleTime: 15_000,
  })
}

export function useTicket(id: string | undefined) {
  return useQuery({
    queryKey: ticketKeys.detail(id ?? ''),
    queryFn: () => api.getTicket(id as string),
    enabled: Boolean(id),
  })
}

export function useComments(id: string) {
  return useQuery({ queryKey: ticketKeys.comments(id), queryFn: () => api.listComments(id) })
}

export function useHistory(id: string) {
  return useQuery({ queryKey: ticketKeys.history(id), queryFn: () => api.listHistory(id) })
}

export function useAttachments(id: string) {
  return useQuery({ queryKey: ticketKeys.attachments(id), queryFn: () => api.listAttachments(id) })
}

export function useCategories(onlyActive = true) {
  return useQuery({
    queryKey: ticketKeys.categories(onlyActive),
    queryFn: () => api.listCategories({ onlyActive }),
    staleTime: 5 * 60_000,
  })
}

export function useStaff(enabled = true) {
  return useQuery({ queryKey: ticketKeys.staff, queryFn: api.listStaff, enabled, staleTime: 5 * 60_000 })
}

function useInvalidateTicket() {
  const queryClient = useQueryClient()
  return (id: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ticketKeys.detail(id) }),
      queryClient.invalidateQueries({ queryKey: ticketKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['report'] }),
    ])
}

export function useCreateTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ input, requesterId }: { input: api.CreateTicketInput; requesterId: string }) =>
      api.createTicket(input, requesterId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ticketKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateTicket(id: string) {
  const invalidate = useInvalidateTicket()
  return useMutation({
    mutationFn: (patch: api.TicketPatch) => api.updateTicket(id, patch),
    onSettled: () => invalidate(id),
  })
}

export function useAddComment(id: string) {
  const invalidate = useInvalidateTicket()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ authorId, kind, body }: { authorId: string; kind: CommentKind; body: string }) =>
      api.addComment(id, authorId, kind, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ticketKeys.comments(id) })
      void queryClient.invalidateQueries({ queryKey: ticketKeys.history(id) })
    },
    onSettled: () => invalidate(id),
  })
}

export function useUploadAttachments(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ uploaderId, files }: { uploaderId: string; files: File[] }) =>
      api.uploadAttachments(id, uploaderId, files),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ticketKeys.attachments(id) }),
  })
}

export function useDeleteAttachment(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (attachment: Pick<TicketAttachment, 'id' | 'storage_path'>) => api.deleteAttachment(attachment),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ticketKeys.attachments(id) }),
  })
}

export type { Ticket }
