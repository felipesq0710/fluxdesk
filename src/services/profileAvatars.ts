import { supabase } from '@/lib/supabase'

export const PROFILE_AVATAR_MAX_BYTES = 5 * 1024 * 1024
export const PROFILE_AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
const BUCKET = 'profile-avatars'
const SIGNED_URL_TTL_SECONDS = 3600

function avatarPath(profileId: string) {
  return `${profileId}/avatar`
}

export async function fetchProfileAvatarUrl(profileId: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(avatarPath(profileId), SIGNED_URL_TTL_SECONDS)
  if (error) {
    if (error.statusCode === '404' || /not found/i.test(error.message)) return null
    throw error
  }
  return data.signedUrl
}

export async function uploadProfileAvatar(profileId: string, file: File): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).upload(avatarPath(profileId), file, {
    upsert: true,
    contentType: file.type,
    cacheControl: '3600',
  })
  if (error) throw error
}

export async function removeProfileAvatar(profileId: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([avatarPath(profileId)])
  if (error) throw error
}
