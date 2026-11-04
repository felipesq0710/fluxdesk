import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as categories from '@/services/categories'
import * as profiles from '@/services/profiles'
import type { UserRole } from '@/types/domain'

export function useUsers(filters: profiles.UserFilters) {
  return useQuery({ queryKey: ['admin', 'users', filters] as const, queryFn: () => profiles.listUsers(filters), placeholderData: keepPreviousData })
}

export function useUserStats() {
  return useQuery({ queryKey: ['admin', 'user-stats'] as const, queryFn: profiles.fetchUserStats, staleTime: 30_000 })
}

export function useUserMutations() {
  const queryClient = useQueryClient()
  const done = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin'] }),
      queryClient.invalidateQueries({ queryKey: ['staff'] }),
    ])
  return {
    changeRole: useMutation({ mutationFn: ({ id, role }: { id: string; role: UserRole }) => profiles.updateUserRole(id, role), onSuccess: done }),
    setActive: useMutation({ mutationFn: ({ id, active }: { id: string; active: boolean }) => profiles.setUserActive(id, active), onSuccess: done }),
  }
}

export function useCategoryCounts() {
  return useQuery({ queryKey: ['admin', 'category-counts'] as const, queryFn: categories.fetchCategoryCounts, staleTime: 30_000 })
}

export function useCategoryMutations() {
  const queryClient = useQueryClient()
  const done = () =>
    Promise.all([queryClient.invalidateQueries({ queryKey: ['admin'] }), queryClient.invalidateQueries({ queryKey: ['categories'] })])
  return {
    create: useMutation({ mutationFn: (input: categories.CategoryInput) => categories.createCategory(input), onSuccess: done }),
    update: useMutation({ mutationFn: ({ id, input }: { id: string; input: categories.CategoryInput }) => categories.updateCategory(id, input), onSuccess: done }),
    setActive: useMutation({ mutationFn: ({ id, active }: { id: string; active: boolean }) => categories.setCategoryActive(id, active), onSuccess: done }),
  }
}
