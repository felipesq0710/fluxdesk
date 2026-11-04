import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Tags } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Alert } from '@/components/ui/Alert'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/ui/Spinner'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { TextField } from '@/components/ui/TextField'
import { useCategoryCounts, useCategoryMutations } from '@/hooks/useAdmin'
import { useCategories } from '@/hooks/useTickets'
import { dbErrorMessage } from '@/lib/errors'
import { categoryFormSchema, type CategoryFormValues } from '@/schemas/category'
import type { Category } from '@/types/domain'

function messageFor(error: unknown): string {
  const code = (error as { code?: string } | null)?.code
  return code === '23505' ? 'Já existe uma categoria com este nome.' : dbErrorMessage(error)
}

function CategoryForm({ category, onDone }: { category: Category | null; onDone: () => void }) {
  const { create, update } = useCategoryMutations()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: { name: category?.name ?? '', description: category?.description ?? '' },
  })

  async function onSubmit(values: CategoryFormValues) {
    setFormError(null)
    const input = { name: values.name, description: values.description || null }
    try {
      if (category) await update.mutateAsync({ id: category.id, input })
      else await create.mutateAsync(input)
      toast.success(category ? 'Categoria atualizada.' : 'Categoria criada.')
      onDone()
    } catch (error) {
      setFormError(messageFor(error))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="card space-y-4 p-4" aria-label={category ? `Editar categoria ${category.name}` : 'Nova categoria'}>
      <h2 className="text-sm font-semibold text-fg">{category ? 'Editar categoria' : 'Nova categoria'}</h2>
      {formError && <Alert variant="danger">{formError}</Alert>}
      <TextField label="Nome" required maxLength={80} error={errors.name?.message} {...register('name')} />
      <TextAreaField label="Descrição" rows={3} maxLength={300} hint="Opcional." error={errors.description?.message} {...register('description')} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onDone}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting && <Spinner />}
          {category ? 'Salvar alterações' : 'Criar categoria'}
        </button>
      </div>
    </form>
  )
}

export default function CategoriesPage() {
  const categories = useCategories(false)
  const counts = useCategoryCounts()
  const { setActive } = useCategoryMutations()
  // 'new' = criando; Category = editando; null = nenhum formulário aberto.
  const [editing, setEditing] = useState<Category | 'new' | null>(null)
  const [toggle, setToggle] = useState<Category | null>(null)

  async function confirmToggle() {
    if (!toggle) return
    try {
      await setActive.mutateAsync({ id: toggle.id, active: !toggle.is_active })
      toast.success(toggle.is_active ? `Categoria "${toggle.name}" desativada.` : `Categoria "${toggle.name}" reativada.`)
    } catch (error) {
      toast.error(messageFor(error))
    } finally {
      setToggle(null)
    }
  }

  const toggleActive = toggle ? (counts.data?.[toggle.id]?.active ?? 0) : 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Categorias</h1>
          <p className="page-lead">Categorias desativadas deixam de aparecer para novos chamados; os existentes não são alterados.</p>
        </div>
        {editing === null && (
          <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nova categoria
          </button>
        )}
      </div>

      {editing !== null && <CategoryForm key={editing === 'new' ? 'new' : editing.id} category={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />}

      {categories.isPending ? (
        <div role="status" className="card flex items-center justify-center gap-2 py-16 text-sm text-fg-muted">
          <Spinner /> Carregando categorias…
        </div>
      ) : categories.isError ? (
        <ErrorState title="Não foi possível carregar as categorias" message={dbErrorMessage(categories.error)} onRetry={() => void categories.refetch()} />
      ) : categories.data.length === 0 ? (
        <div className="card">
          <EmptyState icon={Tags} title="Nenhuma categoria" description="Crie ao menos uma categoria para que solicitantes possam abrir chamados." />
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="stack-table w-full text-sm lg:min-w-[40rem]">
            <caption className="sr-only">Categorias de chamados</caption>
            <thead>
              <tr className="border-b border-line text-left text-xs text-fg-muted">
                <th scope="col" className="px-4 py-3 font-medium">Categoria</th>
                <th scope="col" className="px-4 py-3 font-medium">Situação</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Chamados</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Em aberto</th>
                <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {categories.data.map((c) => {
                const n = counts.data?.[c.id]
                return (
                  <tr key={c.id} className="border-b border-line/60 last:border-0">
                    <th scope="row" className="px-4 py-3 text-left font-normal">
                      <span className="block font-medium text-fg">{c.name}</span>
                      {c.description && <span className="block text-xs text-fg-muted">{c.description}</span>}
                    </th>
                    <td data-label="Situação" className="px-4 py-3">
                      <span className={c.is_active ? 'text-green-700 dark:text-green-400' : 'text-fg-muted'}>{c.is_active ? 'Ativa' : 'Inativa'}</span>
                    </td>
                    <td data-label="Chamados" className="px-4 py-3 text-right tabular-nums">{n ? n.total : '—'}</td>
                    <td data-label="Em aberto" className="px-4 py-3 text-right tabular-nums">{n ? n.active : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button type="button" className="btn-secondary btn-sm" onClick={() => setEditing(c)}>
                          Editar<span className="sr-only"> {c.name}</span>
                        </button>
                        <button type="button" className="btn-secondary btn-sm" disabled={setActive.isPending} onClick={() => setToggle(c)}>
                          {c.is_active ? 'Desativar' : 'Reativar'}
                          <span className="sr-only"> {c.name}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {toggle && (
        <ConfirmDialog
          open
          pending={setActive.isPending}
          destructive={toggle.is_active}
          title={toggle.is_active ? 'Desativar categoria?' : 'Reativar categoria?'}
          description={
            toggle.is_active
              ? `Novos chamados não poderão usar "${toggle.name}".${toggleActive > 0 ? ` Há ${toggleActive} chamado${toggleActive > 1 ? 's' : ''} em aberto nesta categoria; eles continuam normalmente.` : ''}`
              : `"${toggle.name}" voltará a ficar disponível para novos chamados.`
          }
          confirmLabel={toggle.is_active ? 'Desativar' : 'Reativar'}
          onConfirm={() => void confirmToggle()}
          onCancel={() => setToggle(null)}
        />
      )}
    </div>
  )
}
