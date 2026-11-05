export const PROFILE_AVATAR_MAX_BYTES = 5 * 1024 * 1024
export const PROFILE_AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export async function fetchProfileAvatarUrl(): Promise<string | null> {
  return null
}

export async function uploadProfileAvatar(): Promise<void> {
  throw new Error('Upload de foto indisponível na demonstração. Nenhum arquivo foi salvo.')
}

export async function removeProfileAvatar(): Promise<void> {
  throw new Error('Remoção de foto indisponível na demonstração. Nenhum arquivo foi alterado.')
}
