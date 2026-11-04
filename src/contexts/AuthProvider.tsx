import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { AuthContext, type AuthContextValue } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { fetchProfile } from '@/services/profiles'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)

  const hadSession = useRef(false)
  const manualSignOut = useRef(false)

  useEffect(() => {
    // O callback não pode aguardar chamadas ao Supabase (risco de deadlock do cliente).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'SIGNED_OUT') {
        if (hadSession.current && !manualSignOut.current) setSessionExpired(true)
        manualSignOut.current = false
        hadSession.current = false
        // Evita que dados de um usuário apareçam para o próximo na mesma aba.
        queryClient.clear()
      }
      if (nextSession) hadSession.current = true
      setSession(nextSession)
      setInitializing(false)
    })
    return () => subscription.unsubscribe()
  }, [queryClient])

  const userId = session?.user.id
  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => fetchProfile(userId as string),
    enabled: Boolean(userId),
    retry: 1,
    staleTime: 60_000,
  })

  const signIn = useCallback<AuthContextValue['signIn']>(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) setSessionExpired(false)
    return { error }
  }, [])

  const signUp = useCallback<AuthContextValue['signUp']>(async (fullName, email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // O papel NUNCA é enviado: o banco cria todo cadastro como solicitante.
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/entrar`,
      },
    })
    return { error, needsEmailConfirmation: !error && !data.session }
  }, [])

  const signOut = useCallback(async () => {
    manualSignOut.current = true
    // Escopo local: encerra apenas este dispositivo; funciona mesmo se a rede falhar.
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) {
      manualSignOut.current = false
      throw error
    }
  }, [])

  const requestPasswordReset = useCallback<AuthContextValue['requestPasswordReset']>(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })
    return { error }
  }, [])

  const updatePassword = useCallback<AuthContextValue['updatePassword']>(async (password) => {
    const { error } = await supabase.auth.updateUser({ password })
    return { error }
  }, [])

  const clearSessionExpired = useCallback(() => setSessionExpired(false), [])
  const refetchProfile = useCallback(() => {
    void profileQuery.refetch()
  }, [profileQuery])

  const value = useMemo<AuthContextValue>(
    () => ({
      initializing,
      session,
      user: session?.user ?? null,
      profile: profileQuery.data ?? null,
      profileLoading: Boolean(userId) && profileQuery.isPending,
      profileError: profileQuery.error,
      refetchProfile,
      sessionExpired,
      clearSessionExpired,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
    }),
    [
      initializing,
      session,
      userId,
      profileQuery.data,
      profileQuery.isPending,
      profileQuery.error,
      refetchProfile,
      sessionExpired,
      clearSessionExpired,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
