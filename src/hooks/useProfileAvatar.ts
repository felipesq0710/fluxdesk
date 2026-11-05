import { useQuery } from '@tanstack/react-query'
import { fetchProfileAvatarUrl } from '@/services/profileAvatars'

export const PROFILE_AVATAR_REFRESH_INTERVAL_MS = 30 * 60 * 1000
const PROFILE_AVATAR_STALE_TIME_MS = 5 * 60 * 1000

export function profileAvatarRefetchInterval(url: string | null | undefined) {
  return url ? PROFILE_AVATAR_REFRESH_INTERVAL_MS : false
}

export function useProfileAvatar(profileId?: string) {
  return useQuery({
    queryKey: ['profile-avatar', profileId],
    queryFn: () => fetchProfileAvatarUrl(profileId as string),
    enabled: Boolean(profileId),
    staleTime: PROFILE_AVATAR_STALE_TIME_MS,
    // Refresh at 45 minutes, before the signed URL's 60-minute expiration.
    // Missing avatars do not poll; focus/mount can still refresh stale data.
    refetchInterval: (query) => profileAvatarRefetchInterval(query.state.data),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    // A timer/focus will provide the next bounded retry; avoid rapid loops.
    retry: false,
  })
}
