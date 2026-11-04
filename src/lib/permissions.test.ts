import { describe, expect, it } from 'vitest'
import { hasRole, isAdmin, isStaff, navItemsFor } from '@/lib/permissions'

const keys = (role: Parameters<typeof navItemsFor>[0]) => navItemsFor(role).map((i) => i.key)

describe('navegação por perfil', () => {
  it('solicitante não vê áreas administrativas nem a fila', () => {
    const k = keys('requester')
    expect(k).toEqual(['dashboard', 'tickets', 'knowledge', 'notifications', 'settings'])
    for (const hidden of ['users', 'categories', 'reports', 'queue'] as const) {
      expect(k).not.toContain(hidden)
    }
  })

  it('técnico vê fila e relatórios, mas não usuários nem categorias', () => {
    const k = keys('technician')
    expect(k).toContain('queue')
    expect(k).toContain('reports')
    expect(k).not.toContain('users')
    expect(k).not.toContain('categories')
  })

  it('administrador vê todas as opções', () => {
    expect(keys('admin')).toHaveLength(9)
  })
})

describe('predicados de perfil', () => {
  it('isStaff / isAdmin', () => {
    expect(isStaff('requester')).toBe(false)
    expect(isStaff('technician')).toBe(true)
    expect(isStaff('admin')).toBe(true)
    expect(isStaff(null)).toBe(false)
    expect(isAdmin('admin')).toBe(true)
    expect(isAdmin('technician')).toBe(false)
  })

  it('hasRole trata perfil ausente como sem acesso', () => {
    expect(hasRole(undefined, ['admin'])).toBe(false)
    expect(hasRole('admin', ['admin'])).toBe(true)
    expect(hasRole('requester', ['technician', 'admin'])).toBe(false)
  })
})
