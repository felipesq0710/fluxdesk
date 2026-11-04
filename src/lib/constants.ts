import type { UserRole } from '@/types/domain'

export const ROLE_LABEL: Record<UserRole, string> = {
  requester: 'Solicitante',
  technician: 'Técnico',
  admin: 'Administrador',
}

export const ROLES: UserRole[] = ['requester', 'technician', 'admin']
