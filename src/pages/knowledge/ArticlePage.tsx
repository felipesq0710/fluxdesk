import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ArticleContent } from '@/components/knowledge/ArticleContent'
import { ArticleStatusBadge } from '@/components/knowledge/ArticleStatusBadge'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/ui/Spinner'
import { useProfile } from '@/hooks/useAuth'
import { useArticle, useDeleteArticle } from '@/hooks/useArticles'
import { canManageArticle } from '@/lib/articleRules'
import { dbErrorMessage } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import { isStaff } from '@/lib/permissions'
import NotFoundContent from '@/pages/NotFoundContent'

export default function ArticlePage() {
  const { id } = useParams()
  const profile = useProfile()
  const navigate = useNavigate()
  const article = useArticle(id)
  const remove = useDeleteArticle()
  const [confirming, setConfirming] = useState(false)

  if (article.isPending)
    return (
      <div role="status" className="flex justify-center py-16">
        <Spinner />
        <span className="sr-only">Carregando artigo…</span>
      </div>
    )
  if (article.isError) return <ErrorState title="Não foi possível carregar o artigo" message={dbErrorMessage(article.error)} onRetry={() => void article.refetch()} />
  // Inexistente ou não visível (rascunho para solicitante): a RLS devolve vazio.
  if (!article.data) return <NotFoundContent />

  const a = article.data
  const manage = canManageArticle(profile.role, profile.id, a.author_id)

  async function onDelete() {
    try {
      await remove.mutateAsync(a.id)
      toast.success('Artigo excluído.')
      navigate('/conhecimento', { replace: true })
    } catch (error) {
      toast.error(dbErrorMessage(error))
      setConfirming(false)
    }
  }

  return (
    <article className="max-w-3xl">
      <Link to="/conhecimento" className="mb-4 inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Voltar para a base de conhecimento
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">{a.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-fg-muted">
            {isStaff(profile.role) && <ArticleStatusBadge status={a.status} />}
            <span>{a.category?.name ?? 'Sem categoria'}</span>
            <span>· Atualizado em {formatDate(a.updated_at)}</span>
            {a.author && <span>· {a.author.full_name}</span>}
          </p>
        </div>
        {manage && (
          <div className="flex gap-2">
            <Link to={`/conhecimento/${a.id}/editar`} className="btn-secondary">
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Editar
            </Link>
            <button type="button" className="btn-secondary text-red-700 dark:text-red-400" onClick={() => setConfirming(true)}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Excluir
            </button>
          </div>
        )}
      </div>

      <div className="card mt-6 p-5 sm:p-6">
        <ArticleContent source={a.content} />
      </div>

      {a.tags.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Tags">
          {a.tags.map((t) => (
            <li key={t}>
              <Link to={`/conhecimento?tag=${encodeURIComponent(t)}`} className="rounded-full border border-line px-2 py-0.5 text-xs text-fg-muted hover:text-fg">
                {t}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirming}
        destructive
        pending={remove.isPending}
        title="Excluir artigo?"
        description="Esta ação não pode ser desfeita. Se quiser apenas ocultá-lo dos solicitantes, mude a situação para rascunho."
        confirmLabel="Excluir artigo"
        onConfirm={() => void onDelete()}
        onCancel={() => setConfirming(false)}
      />
    </article>
  )
}
