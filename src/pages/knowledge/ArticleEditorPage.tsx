import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { ArticleContent } from '@/components/knowledge/ArticleContent'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Alert } from '@/components/ui/Alert'
import { SelectField } from '@/components/ui/SelectField'
import { Spinner } from '@/components/ui/Spinner'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { TextField } from '@/components/ui/TextField'
import { useProfile } from '@/hooks/useAuth'
import { useArticle, useSaveArticle } from '@/hooks/useArticles'
import { useCategories } from '@/hooks/useTickets'
import { ARTICLE_STATUSES, ARTICLE_STATUS_LABEL, canManageArticle } from '@/lib/articleRules'
import { dbErrorMessage } from '@/lib/errors'
import NotFoundContent from '@/pages/NotFoundContent'
import ForbiddenPage from '@/pages/ForbiddenPage'
import { articleFormSchema, parseTags, type ArticleFormValues } from '@/schemas/article'

export default function ArticleEditorPage() {
  const { id } = useParams()
  const editing = Boolean(id)
  const profile = useProfile()
  const navigate = useNavigate()
  const article = useArticle(id)
  const categories = useCategories(false)
  const save = useSaveArticle(id)
  const [formError, setFormError] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ArticleFormValues>({
    resolver: zodResolver(articleFormSchema),
    defaultValues: { title: '', content: '', categoryId: '', status: 'draft', tags: '' },
  })

  const content = useWatch({ control, name: 'content' })

  useEffect(() => {
    if (article.data)
      reset({
        title: article.data.title,
        content: article.data.content,
        categoryId: article.data.category_id ?? '',
        status: article.data.status,
        tags: article.data.tags.join(', '),
      })
  }, [article.data, reset])

  if (editing) {
    if (article.isPending) return <div role="status" className="flex justify-center py-16"><Spinner /><span className="sr-only">Carregando artigo…</span></div>
    if (article.isError) return <ErrorState title="Não foi possível carregar o artigo" message={dbErrorMessage(article.error)} onRetry={() => void article.refetch()} />
    if (!article.data) return <NotFoundContent />
    if (!canManageArticle(profile.role, profile.id, article.data.author_id)) return <ForbiddenPage />
  }

  async function onSubmit(values: ArticleFormValues) {
    setFormError(null)
    try {
      const saved = await save.mutateAsync({
        authorId: profile.id,
        input: {
          title: values.title,
          content: values.content,
          categoryId: values.categoryId || null,
          status: values.status,
          tags: parseTags(values.tags),
        },
      })
      toast.success(editing ? 'Artigo atualizado.' : values.status === 'published' ? 'Artigo publicado.' : 'Rascunho salvo.')
      navigate(`/conhecimento/${saved.id}`)
    } catch (error) {
      setFormError(dbErrorMessage(error))
    }
  }

  const active = (categories.data ?? []).filter((c) => c.is_active || c.id === article.data?.category_id)

  return (
    <div className="max-w-4xl">
      <Link to={editing ? `/conhecimento/${id}` : '/conhecimento'} className="mb-4 inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Voltar
      </Link>
      <h1 className="page-title">{editing ? 'Editar artigo' : 'Novo artigo'}</h1>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="card mt-6 space-y-5 p-5 sm:p-6">
        {formError && <Alert variant="danger">{formError}</Alert>}
        <TextField label="Título" required maxLength={160} error={errors.title?.message} {...register('title')} />
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField label="Categoria" error={errors.categoryId?.message} {...register('categoryId')}>
            <option value="">Sem categoria</option>
            {active.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
          <SelectField label="Situação" hint="Rascunhos são vistos apenas pela equipe." error={errors.status?.message} {...register('status')}>
            {ARTICLE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ARTICLE_STATUS_LABEL[s]}
              </option>
            ))}
          </SelectField>
        </div>
        <TextField label="Tags" hint="Separe por vírgula (máximo de 10)." error={errors.tags?.message} {...register('tags')} />

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="field-label !mb-0">Conteúdo</span>
            <button type="button" className="btn-ghost !min-h-0 px-2 py-1 text-xs" aria-pressed={preview} onClick={() => setPreview((v) => !v)}>
              {preview ? 'Voltar a editar' : 'Pré-visualizar'}
            </button>
          </div>
          {preview ? (
            <div className="min-h-[12rem] rounded-control border border-line p-4" aria-label="Pré-visualização do artigo">
              {content.trim() ? <ArticleContent source={content} /> : <p className="text-sm text-fg-muted">Nada para pré-visualizar.</p>}
            </div>
          ) : (
            <TextAreaField
              label="Conteúdo do artigo"
              hideLabel
              required
              rows={14}
              maxLength={50000}
              hint="Formatação: ## título, - lista, 1. lista numerada, **negrito**, `código`, [texto](https://link)."
              error={errors.content?.message}
              {...register('content')}
            />
          )}
          {preview && errors.content && <p className="field-error">{errors.content.message}</p>}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link to={editing ? `/conhecimento/${id}` : '/conhecimento'} className="btn-secondary">
            Cancelar
          </Link>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting && <Spinner />}
            {isSubmitting ? 'Salvando…' : editing ? 'Salvar alterações' : 'Salvar artigo'}
          </button>
        </div>
      </form>
    </div>
  )
}
