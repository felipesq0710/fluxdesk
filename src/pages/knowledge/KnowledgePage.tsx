import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BookOpen, Plus, Search, X } from 'lucide-react'
import { ArticleStatusBadge } from '@/components/knowledge/ArticleStatusBadge'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Pagination } from '@/components/ui/Pagination'
import { SelectField } from '@/components/ui/SelectField'
import { Spinner } from '@/components/ui/Spinner'
import { useProfile } from '@/hooks/useAuth'
import { useArticles } from '@/hooks/useArticles'
import { useCategories } from '@/hooks/useTickets'
import { ARTICLE_STATUSES, ARTICLE_STATUS_LABEL, articleFiltersToParams, hasActiveArticleFilters, parseArticleFilters, type ArticleFilters } from '@/lib/articleRules'
import { dbErrorMessage } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import { isStaff } from '@/lib/permissions'

export default function KnowledgePage() {
  const profile = useProfile()
  const staff = isStaff(profile.role)
  const [params, setParams] = useSearchParams()
  const filters = parseArticleFilters(params)
  const articles = useArticles(filters)
  const categories = useCategories(false)
  const [text, setText] = useState(filters.search)
  const lastSent = useRef(filters.search)

  const update = (patch: Partial<ArticleFilters>) =>
    setParams(articleFiltersToParams({ ...filters, page: 1, ...patch }), { replace: true })

  useEffect(() => {
    const value = text.trim()
    if (value === filters.search) return
    const t = window.setTimeout(() => {
      lastSent.current = value
      update({ search: value })
    }, 350)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])
  // Sincroniza mudanças externas (Voltar, limpar filtros) sem atropelar a digitação.
  useEffect(() => {
    if (filters.search !== lastSent.current) {
      lastSent.current = filters.search
      setText(filters.search)
    }
  }, [filters.search])

  const active = hasActiveArticleFilters(filters)
  const data = articles.data

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Base de conhecimento</h1>
          <p className="page-lead">Guias e respostas para resolver problemas comuns sem abrir chamado.</p>
        </div>
        {staff && (
          <Link to="/conhecimento/novo" className="btn-primary">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Novo artigo
          </Link>
        )}
      </div>

      <section aria-label="Filtros de artigos" className="card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label htmlFor="kb-search" className="field-label">
              Buscar
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
              <input id="kb-search" type="search" className="field-input pl-9" maxLength={100} autoComplete="off" placeholder="Título ou conteúdo" value={text} onChange={(e) => setText(e.target.value)} />
            </div>
          </div>
          <SelectField label="Categoria" value={filters.category} onChange={(e) => update({ category: e.target.value })}>
            <option value="">Todas</option>
            {(categories.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
          {staff && (
            <SelectField label="Situação" value={filters.status} onChange={(e) => update({ status: e.target.value as ArticleFilters['status'] })}>
              <option value="">Todas</option>
              {ARTICLE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ARTICLE_STATUS_LABEL[s]}
                </option>
              ))}
            </SelectField>
          )}
        </div>
        {(filters.tag || active) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {filters.tag && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-medium text-brand dark:bg-brand/15 dark:text-brand-300">
                Tag: {filters.tag}
                <button type="button" aria-label={`Remover filtro da tag ${filters.tag}`} onClick={() => update({ tag: '' })}>
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </span>
            )}
            <button type="button" className="btn-ghost !min-h-0 px-2 py-1 text-xs" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
              Limpar filtros
            </button>
          </div>
        )}
      </section>

      {articles.isPending ? (
        <div role="status" className="card flex items-center justify-center gap-2 py-16 text-sm text-fg-muted">
          <Spinner /> Carregando artigos…
        </div>
      ) : articles.isError ? (
        <ErrorState title="Não foi possível carregar os artigos" message={dbErrorMessage(articles.error)} onRetry={() => void articles.refetch()} />
      ) : data && data.items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={BookOpen}
            title={active ? 'Nenhum artigo encontrado' : 'Ainda não há artigos'}
            description={active ? 'Tente outros termos ou limpe os filtros.' : staff ? 'Crie o primeiro artigo para ajudar os solicitantes.' : 'Os artigos publicados pela equipe aparecerão aqui.'}
          />
        </div>
      ) : (
        data && (
          <div className="card">
            <ul className="divide-y divide-line">
              {data.items.map((a) => (
                <li key={a.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/conhecimento/${a.id}`} className="font-medium text-fg hover:text-brand hover:underline">
                      {a.title}
                    </Link>
                    {staff && <ArticleStatusBadge status={a.status} />}
                  </div>
                  <p className="mt-1 text-xs text-fg-muted">
                    {a.category?.name ?? 'Sem categoria'} · Atualizado em {formatDate(a.updated_at)}
                    {a.author ? ` · ${a.author.full_name}` : ''}
                  </p>
                  {a.tags.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Tags">
                      {a.tags.map((t) => (
                        <li key={t}>
                          <button type="button" className="rounded-full border border-line px-2 py-0.5 text-xs text-fg-muted hover:text-fg" onClick={() => update({ tag: t })}>
                            {t}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={(page) => update({ page })} disabled={articles.isFetching} />
          </div>
        )
      )}
    </div>
  )
}
