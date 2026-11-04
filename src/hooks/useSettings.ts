import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DEFAULT_SETTINGS, getAppSettings, updateAppSettings } from '@/services/settings'

export function useAppSettings() {
  const query = useQuery({ queryKey: ['app-settings'], queryFn: getAppSettings, staleTime: 5 * 60_000 })
  // Enquanto carrega (ou em erro) usa o padrão permissivo; o banco é quem impõe as regras.
  return { ...query, settings: query.data ?? DEFAULT_SETTINGS }
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: Parameters<typeof updateAppSettings>[0]) => updateAppSettings(patch),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['app-settings'] }),
  })
}
