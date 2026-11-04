import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/services/notifications'

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (page: number, onlyUnread: boolean) => ['notifications', 'list', page, onlyUnread] as const,
  unread: ['notifications', 'unread'] as const,
}

export function useNotifications(page: number, onlyUnread: boolean) {
  return useQuery({
    queryKey: notificationKeys.list(page, onlyUnread),
    queryFn: () => api.listNotifications(page, onlyUnread),
    placeholderData: keepPreviousData,
  })
}

export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unread,
    queryFn: api.countUnread,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
}

export function useMarkRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.markRead(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  })
}

export function useMarkAllRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.markAllRead(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  })
}
