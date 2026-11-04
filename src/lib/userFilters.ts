import { ROLES } from '@/lib/constants'
import { sanitizeSearch } from '@/lib/ticketFilters'
import type { UserFilters } from '@/services/profiles'

export const DEFAULT_USER_FILTERS: UserFilters = { search: '', role: '', status: '', page: 1 }

export function parseUserFilters(params: URLSearchParams): UserFilters {
  const role = params.get('role') ?? ''
  const status = params.get('status') ?? ''
  const page = Number.parseInt(params.get('page') ?? '1', 10)
  return {
    search: sanitizeSearch(params.get('q') ?? ''),
    role: (ROLES as string[]).includes(role) ? (role as UserFilters['role']) : '',
    status: status === 'active' || status === 'inactive' ? status : '',
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 10_000) : 1,
  }
}

export function userFiltersToParams(f: UserFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.search) p.set('q', f.search)
  if (f.role) p.set('role', f.role)
  if (f.status) p.set('status', f.status)
  if (f.page > 1) p.set('page', String(f.page))
  return p
}
