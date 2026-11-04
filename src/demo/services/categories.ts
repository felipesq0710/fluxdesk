import { db } from '@/demo/store'

export interface CategoryCounts {
  total: number
  active: number
}
export interface CategoryInput {
  name: string
  description: string | null
}
const ACTIVE = ['open', 'in_progress', 'waiting_requester', 'waiting_third_party']

export async function fetchCategoryCounts(): Promise<Record<string, CategoryCounts>> {
  return Object.fromEntries(
    db.categories.map((c) => {
      const rows = db.tickets.filter((t) => t.category_id === c.id)
      return [c.id, { total: rows.length, active: rows.filter((t) => ACTIVE.includes(t.status)).length }]
    }),
  )
}
export async function createCategory(input: CategoryInput): Promise<void> {
  if (db.categories.some((c) => c.name.toLowerCase() === input.name.trim().toLowerCase())) throw { code: '23505', message: 'duplicate' }
  const now = new Date().toISOString()
  db.categories.push({ id: `c0000000-0000-4000-8000-${String(db.categories.length + 1).padStart(12, '0')}`, name: input.name, description: input.description, is_active: true, created_at: now, updated_at: now })
}
export async function updateCategory(id: string, input: CategoryInput): Promise<void> {
  const c = db.categories.find((x) => x.id === id)
  if (c) Object.assign(c, input)
}
export async function setCategoryActive(id: string, isActive: boolean): Promise<void> {
  const c = db.categories.find((x) => x.id === id)
  if (!c) return
  if (!isActive && !db.categories.some((x) => x.is_active && x.id !== id)) throw { code: '23514', message: 'É necessário manter ao menos uma categoria ativa.' }
  c.is_active = isActive
}
