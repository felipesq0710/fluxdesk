import { ARTICLE_PAGE_SIZE, type ArticleFilters } from '@/lib/articleRules'
import { sanitizeSearch } from '@/lib/ticketFilters'
import { currentActor, db, nextId } from '@/demo/store'
import type { ArticleStatus, KnowledgeArticle } from '@/types/domain'

export type ArticleSummary = Omit<KnowledgeArticle, 'content'>
export interface ArticlePage {
  items: ArticleSummary[]
  total: number
  page: number
  pageSize: number
}
export interface ArticleInput {
  title: string
  content: string
  categoryId: string | null
  status: ArticleStatus
  tags: string[]
}

const visible = () => (currentActor().role === 'requester' ? db.articles.filter((a) => a.status === 'published') : db.articles)

export async function listArticles(filters: ArticleFilters): Promise<ArticlePage> {
  const term = sanitizeSearch(filters.search).toLowerCase()
  const rows = visible()
    .filter((a) => (!filters.status || a.status === filters.status) && (!filters.category || a.category_id === filters.category) && (!filters.tag || a.tags.includes(filters.tag.toLowerCase())) && (!term || a.title.toLowerCase().includes(term) || a.content.toLowerCase().includes(term)))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  const from = (filters.page - 1) * ARTICLE_PAGE_SIZE
  return { items: rows.slice(from, from + ARTICLE_PAGE_SIZE).map(({ content: _c, ...rest }) => rest), total: rows.length, page: filters.page, pageSize: ARTICLE_PAGE_SIZE }
}
export async function getArticle(id: string): Promise<KnowledgeArticle | null> {
  return visible().find((a) => a.id === id) ?? null
}
export async function createArticle(input: ArticleInput, authorId: string): Promise<{ id: string }> {
  const author = db.people.find((p) => p.id === authorId)
  const cat = db.categories.find((c) => c.id === input.categoryId)
  const now = new Date().toISOString()
  const a: KnowledgeArticle = { id: nextId('b'), title: input.title, content: input.content, category_id: input.categoryId, author_id: authorId, status: input.status, tags: input.tags, created_at: now, updated_at: now, published_at: input.status === 'published' ? now : null, author: { full_name: author?.full_name ?? '' }, category: cat ? { id: cat.id, name: cat.name } : null }
  db.articles.unshift(a)
  return { id: a.id }
}
export async function updateArticle(id: string, input: ArticleInput): Promise<void> {
  const a = db.articles.find((x) => x.id === id)
  if (!a) return
  const cat = db.categories.find((c) => c.id === input.categoryId)
  Object.assign(a, { title: input.title, content: input.content, category_id: input.categoryId, status: input.status, tags: input.tags, updated_at: new Date().toISOString(), category: cat ? { id: cat.id, name: cat.name } : null })
  a.published_at = input.status === 'published' ? (a.published_at ?? a.updated_at) : null
}
export async function deleteArticle(id: string): Promise<void> {
  db.articles = db.articles.filter((a) => a.id !== id)
}
