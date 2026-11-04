import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ArticleFilters } from '@/lib/articleRules'
import * as api from '@/services/articles'

export const articleKeys = {
  all: ['articles'] as const,
  list: (filters: ArticleFilters) => ['articles', 'list', filters] as const,
  detail: (id: string) => ['articles', 'detail', id] as const,
}

export function useArticles(filters: ArticleFilters) {
  return useQuery({
    queryKey: articleKeys.list(filters),
    queryFn: () => api.listArticles(filters),
    placeholderData: keepPreviousData,
  })
}

export function useArticle(id: string | undefined) {
  return useQuery({
    queryKey: articleKeys.detail(id ?? ''),
    queryFn: () => api.getArticle(id!),
    enabled: Boolean(id),
  })
}

export function useSaveArticle(id?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ input, authorId }: { input: api.ArticleInput; authorId: string }) =>
      id ? api.updateArticle(id, input).then(() => ({ id })) : api.createArticle(input, authorId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: articleKeys.all }),
  })
}

export function useDeleteArticle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteArticle(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: articleKeys.all }),
  })
}
