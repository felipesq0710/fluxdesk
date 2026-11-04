import type { UserRole } from '@/types/domain'

// Fonte única das regras de acesso à interface. A autorização real é imposta
// pelo banco (RLS/triggers); estas regras apenas decidem o que exibir e o que rotear.

export const ALL_ROLES: UserRole[] = ['requester', 'technician', 'admin']
export const STAFF_ROLES: UserRole[] = ['technician', 'admin']
export const ADMIN_ROLES: UserRole[] = ['admin']

export type NavKey =
  | 'dashboard'
  | 'tickets'
  | 'queue'
  | 'knowledge'
  | 'notifications'
  | 'reports'
  | 'users'
  | 'categories'
  | 'settings'

export interface NavItem {
  key: NavKey
  label: string
  to: string
  roles: UserRole[]
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', to: '/', roles: ALL_ROLES },
  { key: 'tickets', label: 'Chamados', to: '/chamados', roles: ALL_ROLES },
  { key: 'queue', label: 'Minha fila', to: '/minha-fila', roles: STAFF_ROLES },
  { key: 'knowledge', label: 'Base de conhecimento', to: '/conhecimento', roles: ALL_ROLES },
  { key: 'notifications', label: 'Notificações', to: '/notificacoes', roles: ALL_ROLES },
  { key: 'reports', label: 'Relatórios', to: '/relatorios', roles: STAFF_ROLES },
  { key: 'users', label: 'Usuários', to: '/usuarios', roles: ADMIN_ROLES },
  { key: 'categories', label: 'Categorias', to: '/categorias', roles: ADMIN_ROLES },
  { key: 'settings', label: 'Configurações', to: '/configuracoes', roles: ALL_ROLES },
]

export function navItemsFor(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role))
}

export function isStaff(role: UserRole | null | undefined): boolean {
  return role === 'technician' || role === 'admin'
}

export function isAdmin(role: UserRole | null | undefined): boolean {
  return role === 'admin'
}

export function hasRole(role: UserRole | null | undefined, allowed: UserRole[]): boolean {
  return role != null && allowed.includes(role)
}
