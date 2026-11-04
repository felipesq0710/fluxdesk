import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { sanitizeSearch } from '@/lib/ticketFilters'
import type { Profile, UserRole } from '@/types/domain'

const PROFILE_COLUMNS = 'id, email, full_name, role, is_active, created_at, updated_at'

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle()
    .overrideTypes<Profile, { merge: false }>()
  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
// Administração de usuários (somente administradores; a RLS e os triggers reforçam)
// ---------------------------------------------------------------------------

export const USER_PAGE_SIZE = 15

export interface UserFilters {
  search: string
  role: UserRole | ''
  status: 'active' | 'inactive' | ''
  page: number
}

export interface UserPage {
  items: Profile[]
  total: number
  page: number
  pageSize: number
}

export async function listUsers(filters: UserFilters): Promise<UserPage> {
  let query = supabase.from('profiles').select(PROFILE_COLUMNS, { count: 'exact' })
  if (filters.role) query = query.eq('role', filters.role)
  if (filters.status) query = query.eq('is_active', filters.status === 'active')
  const term = sanitizeSearch(filters.search)
  if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)
  const from = (filters.page - 1) * USER_PAGE_SIZE
  const { data, error, count } = await query
    .order('full_name')
    .order('id')
    .range(from, from + USER_PAGE_SIZE - 1)
    .overrideTypes<Profile[], { merge: false }>()
  if (error) throw error
  return { items: data ?? [], total: count ?? 0, page: filters.page, pageSize: USER_PAGE_SIZE }
}

const statsSchema = z.array(
  z.object({
    user_id: z.string(),
    requested: z.coerce.number(),
    assigned: z.coerce.number(),
    assigned_open: z.coerce.number(),
  }),
)
export type UserStats = z.infer<typeof statsSchema>[number]

export async function fetchUserStats(): Promise<Record<string, UserStats>> {
  const { data, error } = await supabase.rpc('user_ticket_stats')
  if (error) throw error
  return Object.fromEntries(statsSchema.parse(data ?? []).map((s) => [s.user_id, s]))
}

export async function updateUserRole(id: string, role: UserRole): Promise<void> {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
  if (error) throw error
}

export async function setUserActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('profiles').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}

export async function updateOwnName(id: string, fullName: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', id)
  if (error) throw error
}
