import { db } from '@/demo/store'
import { sanitizeSearch } from '@/lib/ticketFilters'
import type { Profile, UserRole } from '@/types/domain'

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
export interface UserStats {
  user_id: string
  requested: number
  assigned: number
  assigned_open: number
}
const ACTIVE = ['open', 'in_progress', 'waiting_requester', 'waiting_third_party']

export async function fetchProfile(userId: string): Promise<Profile | null> {
  return db.people.find((p) => p.id === userId) ?? null
}
export async function listUsers(filters: UserFilters): Promise<UserPage> {
  const term = sanitizeSearch(filters.search).toLowerCase()
  const rows = db.people
    .filter((p) => (!filters.role || p.role === filters.role) && (!filters.status || p.is_active === (filters.status === 'active')) && (!term || p.full_name.toLowerCase().includes(term) || p.email.includes(term)))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'pt-BR'))
  const from = (filters.page - 1) * USER_PAGE_SIZE
  return { items: rows.slice(from, from + USER_PAGE_SIZE), total: rows.length, page: filters.page, pageSize: USER_PAGE_SIZE }
}
export async function fetchUserStats(): Promise<Record<string, UserStats>> {
  return Object.fromEntries(
    db.people.map((p) => [
      p.id,
      {
        user_id: p.id,
        requested: db.tickets.filter((t) => t.requester_id === p.id).length,
        assigned: db.tickets.filter((t) => t.assignee_id === p.id).length,
        assigned_open: db.tickets.filter((t) => t.assignee_id === p.id && ACTIVE.includes(t.status)).length,
      },
    ]),
  )
}
export async function updateUserRole(id: string, role: UserRole): Promise<void> {
  const p = db.people.find((x) => x.id === id)
  if (p) p.role = role
}
export async function setUserActive(id: string, isActive: boolean): Promise<void> {
  const p = db.people.find((x) => x.id === id)
  if (!p) return
  if (!isActive && p.role === 'admin' && !db.people.some((x) => x.role === 'admin' && x.is_active && x.id !== id)) throw { code: '23514', message: 'É necessário manter ao menos um administrador ativo.' }
  p.is_active = isActive
}
export async function updateOwnName(id: string, fullName: string): Promise<void> {
  const p = db.people.find((x) => x.id === id)
  if (p) p.full_name = fullName
}
