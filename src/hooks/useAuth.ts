import { useContext } from 'react'
import { AuthContext, type AuthContextValue } from '@/contexts/AuthContext'

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}

// Perfil garantido: só use dentro de rotas protegidas (RequireAuth).
export function useProfile() {
  const { profile } = useAuth()
  if (!profile) throw new Error('useProfile usado fora de uma rota autenticada')
  return profile
}
