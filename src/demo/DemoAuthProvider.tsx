import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { AuthContext, type AuthContextValue } from '@/contexts/AuthContext'
import { DEMO_ROLE_KEY, DEMO_USERS } from '@/demo/store'
import type { UserRole } from '@/types/domain'

function readRole(): UserRole | null {
  try {
    const saved = sessionStorage.getItem(DEMO_ROLE_KEY)
    return saved === 'admin' || saved === 'technician' || saved === 'requester' ? saved : null
  } catch {
    return null
  }
}

// Autenticação simulada da demonstração: o e-mail digitado escolhe o perfil (admin@, tecnico@ ou solicitante@).
export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole | null>(readRole)

  const choose = useCallback((next: UserRole | null) => {
    try {
      if (next) sessionStorage.setItem(DEMO_ROLE_KEY, next)
      else sessionStorage.removeItem(DEMO_ROLE_KEY)
    } catch {
      // sem armazenamento
    }
    setRole(next)
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    const profile = role ? DEMO_USERS[role] : null
    const user = profile ? ({ id: profile.id, email: profile.email } as User) : null
    return {
      initializing: false,
      session: user ? ({ user } as Session) : null,
      user,
      profile,
      profileLoading: false,
      profileError: null,
      refetchProfile: () => undefined,
      sessionExpired: false,
      clearSessionExpired: () => undefined,
      signIn: async (email) => {
        const key = email.trim().toLowerCase()
        const next: UserRole = key.startsWith('admin') ? 'admin' : key.startsWith('tecnico') ? 'technician' : 'requester'
        choose(next)
        return { error: null }
      },
      signUp: async () => ({ error: null, needsEmailConfirmation: true }),
      signOut: async () => choose(null),
      requestPasswordReset: async () => ({ error: null }),
      updatePassword: async () => ({ error: null }),
    }
  }, [role, choose])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
