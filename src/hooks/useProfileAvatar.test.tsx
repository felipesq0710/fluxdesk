import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchProfileAvatarUrl } from '@/services/profileAvatars'
import { PROFILE_AVATAR_REFRESH_INTERVAL_MS, profileAvatarRefetchInterval, useProfileAvatar } from '@/hooks/useProfileAvatar'

vi.mock('@/services/profileAvatars', () => ({ fetchProfileAvatarUrl: vi.fn() }))

function setup(initialUrl?: string, stale = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  if (initialUrl) queryClient.setQueryData(['profile-avatar', 'profile-1'], initialUrl, { updatedAt: stale ? Date.now() - 10 * 60 * 1000 : Date.now() })
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  return { ...renderHook(() => useProfileAvatar('profile-1'), { wrapper }), queryClient }
}

beforeEach(() => vi.clearAllMocks())

describe('renovação de URL do avatar', () => {
  it('carrega URL válida e atualiza uma URL próxima da expiração sem remontar', async () => {
    vi.mocked(fetchProfileAvatarUrl).mockResolvedValue('signed-url-renovada')
    const { result } = setup('signed-url-inicial', true)

    await waitFor(() => expect(result.current.data).toBe('signed-url-renovada'))
    expect(fetchProfileAvatarUrl).toHaveBeenCalled()
    expect(profileAvatarRefetchInterval(result.current.data)).toBe(PROFILE_AVATAR_REFRESH_INTERVAL_MS)
    expect(PROFILE_AVATAR_REFRESH_INTERVAL_MS).toBeLessThan(60 * 60 * 1000)
  })

  it('ao renovar URL expirada, mantém o estado utilizável se a rede falhar', async () => {
    vi.mocked(fetchProfileAvatarUrl).mockRejectedValue(new TypeError('Failed to fetch'))
    const { result } = setup('url-expirada', true)
    await waitFor(() => expect(fetchProfileAvatarUrl).toHaveBeenCalled())
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'))
    expect(result.current.data).toBe('url-expirada')
  })

  it('não faz polling quando o usuário não tem avatar', async () => {
    vi.mocked(fetchProfileAvatarUrl).mockResolvedValue(null)
    const { result } = setup()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
    expect(profileAvatarRefetchInterval(result.current.data)).toBe(false)
  })
})
