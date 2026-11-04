import { supabase } from '@/lib/supabase'
import { ARTICLE_PAGE_SIZE, type ArticleFilters } from '@/lib/articleRules'
import { sanitizeSearch } from '@/lib/ticketFilters'
import type { ArticleStatus, KnowledgeArticle } from '@/types/domain'

const RELATIONS = `author:profiles!knowledge_articles_author_id_fkey(full_name), category:categories(id, name)`
const SUMMARY_COLUMNS = `id, title, category_id, author_id, status, tags, created_at, updated_at, published_at`

export type ArticleSummary = Omit<KnowledgeArticle, 'content'>

export interface ArticlePage {
  items: ArticleSummary[]
  total: number
  page: number
  pageSize: number
}

export async function listArticles(filters: ArticleFilters): Promise<ArticlePage> {
  let query = supabase.from('knowledge_articles').select(`${SUMMARY_COLUMNS}, ${RELATIONS}`, { count: 'exact' })
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.category) query = query.eq('category_id', filters.category)
  if (filters.tag) query = query.contains('tags', [filters.tag.toLowerCase()])
  const term = sanitizeSearch(filters.search)
  if (term) query = query.or(`title.ilike.%${term}%,content.ilike.%${term}%`)

  const from = (filters.page - 1) * ARTICLE_PAGE_SIZE
  const { data, error, count } = await query
    .order('updated_at', { ascending: false })
    .order('id', { ascending: true })
    .range(from, from + ARTICLE_PAGE_SIZE - 1)
    .overrideTypes<ArticleSummary[], { merge: false }>()
  if (error) throw error
  return { items: data ?? [], total: count ?? 0, page: filters.page, pageSize: ARTICLE_PAGE_SIZE }
}

export async function getArticle(id: string): Promise<KnowledgeArticle | null> {
  const { data, error } = await supabase
    .from('knowledge_articles')
    .select(`id, title, content, category_id, author_id, status, tags, created_at, updated_at, published_at, ${RELATIONS}`)
    .eq('id', id)
    .maybeSingle()
    .overrideTypes<KnowledgeArticle, { merge: false }>()
  if (error) throw error
  return data
}

export interface ArticleInput {
  title: string
  content: string
  categoryId: string | null
  status: ArticleStatus
  tags: string[]
}

export async function createArticle(input: ArticleInput, authorId: string): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('knowledge_articles')
    .insert({
      title: input.title,
      content: input.content,
      category_id: input.categoryId,
      status: input.status,
      tags: input.tags,
      author_id: authorId,
    })
    .select('id')
    .single()
  if (error) throw error
  return data
}

export async function updateArticle(id: string, input: ArticleInput): Promise<void> {
  const { error } = await supabase
    .from('knowledge_articles')
    .update({ title: input.title, content: input.content, category_id: input.categoryId, status: input.status, tags: input.tags })
    .eq('id', id)
  if (error) throw error
}

export async function deleteArticle(id: string): Promise<void> {
  const { error } = await supabase.from('knowledge_articles').delete().eq('id', id)
  if (error) throw error
}
