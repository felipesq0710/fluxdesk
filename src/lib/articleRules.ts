import { sanitizeSearch } from '@/lib/ticketFilters'
import type { ArticleStatus, UserRole } from '@/types/domain'

export const ARTICLE_PAGE_SIZE = 12

export const ARTICLE_STATUS_LABEL: Record<ArticleStatus, string> = {
  draft: 'Rascunho',
  published: 'Publicado',
}

export const ARTICLE_STATUSES: ArticleStatus[] = ['draft', 'published']

// Espelha as políticas de RLS: equipe cria; só o autor ou um administrador edita/exclui.
export function canManageArticle(role: UserRole | null | undefined, userId: string, authorId: string): boolean {
  return role === 'admin' || (role === 'technician' && authorId === userId)
}

export interface ArticleFilters {
  search: string
  category: string
  tag: string
  // Somente equipe enxerga rascunhos; solicitantes sempre recebem apenas publicados (RLS).
  status: ArticleStatus | ''
  page: number
}

export const DEFAULT_ARTICLE_FILTERS: ArticleFilters = { search: '', category: '', tag: '', status: '', page: 1 }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function sanitizeTag(tag: string): string {
  return tag.replace(/[^\p{L}\p{N}\- ]/gu, '').trim().slice(0, 30)
}

export function parseArticleFilters(params: URLSearchParams): ArticleFilters {
  const status = params.get('status') ?? ''
  const category = params.get('category') ?? ''
  const page = Number.parseInt(params.get('page') ?? '1', 10)
  return {
    search: sanitizeSearch(params.get('q') ?? ''),
    category: UUID.test(category) ? category : '',
    tag: sanitizeTag(params.get('tag') ?? ''),
    status: status === 'draft' || status === 'published' ? status : '',
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 10_000) : 1,
  }
}

export function articleFiltersToParams(f: ArticleFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.search) p.set('q', f.search)
  if (f.category) p.set('category', f.category)
  if (f.tag) p.set('tag', f.tag)
  if (f.status) p.set('status', f.status)
  if (f.page > 1) p.set('page', String(f.page))
  return p
}

export function hasActiveArticleFilters(f: ArticleFilters): boolean {
  return Boolean(f.search || f.category || f.tag || f.status)
}
