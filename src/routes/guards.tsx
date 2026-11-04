import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { FullPageLoader } from '@/components/feedback/FullPageLoader'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useAuth } from '@/hooks/useAuth'
import { getRedirectTarget } from '@/lib/navigation'
import { hasRole } from '@/lib/permissions'
import AccountBlockedPage from '@/pages/AccountBlockedPage'
import ForbiddenPage from '@/pages/ForbiddenPage'
import type { UserRole } from '@/types/domain'

export function RequireAuth() {
  const { initializing, session, profile, profileLoading, profileError, refetchProfile } = useAuth()
  const location = useLocation()

  if (initializing) return <FullPageLoader />
  if (!session) return <Navigate to="/entrar" replace state={{ from: location }} />
  if (profileLoading) return <FullPageLoader label="Carregando seu perfil…" />
  if (profileError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-muted p-6">
        <div className="w-full max-w-md">
          <ErrorState
            title="Não foi possível carregar seu perfil"
            message="Verifique sua conexão e tente novamente."
            onRetry={refetchProfile}
          />
        </div>
      </main>
    )
  }
  if (!profile) return <AccountBlockedPage inactive={false} />
  if (!profile.is_active) return <AccountBlockedPage inactive />
  return <Outlet />
}

export function RequireRole({ roles }: { roles: UserRole[] }) {
  const { profile } = useAuth()
  if (!hasRole(profile?.role, roles)) return <ForbiddenPage />
  return <Outlet />
}

export function PublicOnly() {
  const { initializing, session } = useAuth()
  const location = useLocation()

  if (initializing) return <FullPageLoader />
  if (session) return <Navigate to={getRedirectTarget(location.state)} replace />
  return <Outlet />
}
