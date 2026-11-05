import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { Profile } from '@/types/domain'

export interface AuthResult {
  error: unknown | null
}

export interface SignUpResult extends AuthResult {
  needsEmailConfirmation: boolean
}

export interface AuthContextValue {
  // Verdadeiro até o Supabase informar o estado inicial da sessão.
  initializing: boolean
  session: Session | null
  user: User | null
  profile: Profile | null
  profileLoading: boolean
  profileError: unknown | null
  refetchProfile: () => void
  sessionExpired: boolean
  clearSessionExpired: () => void
  signIn: (email: string, password: string) => Promise<AuthResult>
  signUp: (fullName: string, email: string, password: string) => Promise<SignUpResult>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<AuthResult>
  updatePassword: (password: string) => Promise<AuthResult>
  updateEmail: (email: string) => Promise<AuthResult & { needsConfirmation: boolean }>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
