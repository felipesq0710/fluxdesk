import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '@/contexts/AuthContext'
import type { Profile, UserRole } from '@/types/domain'

export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'user-1',
    email: 'pessoa@exemplo.com',
    full_name: 'Pessoa Teste',
    role: 'requester',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

export function makeAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    initializing: false,
    session: null,
    user: null,
    profile: null,
    profileLoading: false,
    profileError: null,
    refetchProfile: vi.fn(),
    sessionExpired: false,
    clearSessionExpired: vi.fn(),
    signIn: vi.fn().mockResolvedValue({ error: null }),
    signUp: vi.fn().mockResolvedValue({ error: null, needsEmailConfirmation: false }),
    signOut: vi.fn().mockResolvedValue(undefined),
    requestPasswordReset: vi.fn().mockResolvedValue({ error: null }),
    updatePassword: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  }
}

export function authAs(role: UserRole, overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return makeAuth({
    session: { user: { id: 'user-1' } } as AuthContextValue['session'],
    user: { id: 'user-1' } as AuthContextValue['user'],
    profile: makeProfile({ role }),
    ...overrides,
  })
}

export function renderWithProviders(
  ui: ReactElement,
  { auth = makeAuth(), route = '/' }: { auth?: AuthContextValue; route?: string } = {},
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}
