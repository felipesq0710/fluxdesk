import { z } from 'zod'
import { supabase } from '@/lib/supabase'

const countsSchema = z.array(
  z.object({ category_id: z.string(), total: z.coerce.number(), in_progress: z.coerce.number() }),
)
export interface CategoryCounts {
  total: number
  active: number
}

export async function fetchCategoryCounts(): Promise<Record<string, CategoryCounts>> {
  const { data, error } = await supabase.rpc('category_ticket_counts')
  if (error) throw error
  return Object.fromEntries(countsSchema.parse(data ?? []).map((c) => [c.category_id, { total: c.total, active: c.in_progress }]))
}

export interface CategoryInput {
  name: string
  description: string | null
}

export async function createCategory(input: CategoryInput): Promise<void> {
  const { error } = await supabase.from('categories').insert({ name: input.name, description: input.description })
  if (error) throw error
}

export async function updateCategory(id: string, input: CategoryInput): Promise<void> {
  const { error } = await supabase.from('categories').update({ name: input.name, description: input.description }).eq('id', id)
  if (error) throw error
}

export async function setCategoryActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('categories').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}
