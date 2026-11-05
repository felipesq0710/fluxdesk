import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { ErrorState } from '@/components/feedback/ErrorState'
import { AttachmentPicker } from '@/components/tickets/AttachmentPicker'
import { Alert } from '@/components/ui/Alert'
import { SelectField } from '@/components/ui/SelectField'
import { Spinner } from '@/components/ui/Spinner'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { TextField } from '@/components/ui/TextField'
import { useProfile } from '@/hooks/useAuth'
import { useAppSettings } from '@/hooks/useSettings'
import { useCategories, useCreateTicket } from '@/hooks/useTickets'
import { dbErrorMessage } from '@/lib/errors'
import { PRIORITIES, PRIORITY_LABEL } from '@/lib/ticketLabels'
import { ticketFormSchema, type TicketFormValues } from '@/schemas/ticket'
import { uploadAttachments } from '@/services/tickets'

export default function NewTicketPage() {
  const profile = useProfile()
  const navigate = useNavigate()
  const categories = useCategories(true)
  const createTicket = useCreateTicket()
  const { settings } = useAppSettings()
  const canPickPriority = profile.role !== 'requester' || settings.allow_requester_priority
  const [files, setFiles] = useState<File[]>([])
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TicketFormValues>({
    resolver: zodResolver(ticketFormSchema),
    defaultValues: { title: '', description: '', categoryId: '', priority: 'medium' },
  })

  async function onSubmit(values: TicketFormValues) {
    setFormError(null)
    let created: { id: string; code: string }
    try {
      created = await createTicket.mutateAsync({
        input: {
          title: values.title,
          description: values.description,
          categoryId: values.categoryId,
          priority: (canPickPriority ? values.priority : 'medium') as TicketFormValues['priority'],
        },
        requesterId: profile.id,
      })
    } catch (error) {
      setFormError(dbErrorMessage(error))
      return
    }

    if (files.length > 0) {
      try {
        const outcome = await uploadAttachments(created.id, profile.id, files)
        if (outcome.failed.length > 0) {
          const names = outcome.failed.map((f) => f.name).join(', ')
          toast.warning(`Chamado ${created.code} aberto, mas não foi possível enviar: ${names}. Anexe-os novamente na página do chamado.`)
          navigate(`/chamados/${created.id}`)
          return
        }
      } catch (error) {
        toast.warning(`Chamado ${created.code} aberto, mas ocorreu uma falha inesperada ao enviar os anexos: ${dbErrorMessage(error)}. Você poderá tentar novamente na página do chamado.`)
        navigate(`/chamados/${created.id}`)
        return
      }
    }
    toast.success(`Chamado ${created.code} aberto com sucesso.`)
    navigate(`/chamados/${created.id}`)
  }

  const noCategories = categories.isSuccess && categories.data.length === 0

  return (
    <div className="max-w-4xl">
      <Link to="/chamados" className="mb-4 inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Voltar para chamados
      </Link>
      <h1 className="page-title">Novo chamado</h1>
      <p className="page-lead">Descreva o problema com o máximo de detalhes para agilizar o atendimento.</p>

      <div className="card mt-6 p-5 sm:p-6">
        {categories.isError ? (
          <ErrorState title="Não foi possível carregar as categorias" message={dbErrorMessage(categories.error)} onRetry={() => void categories.refetch()} />
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            {formError && <Alert variant="danger">{formError}</Alert>}
            {noCategories && (
              <Alert variant="warning" title="Nenhuma categoria disponível">
                Peça a um administrador para ativar ao menos uma categoria.
              </Alert>
            )}

            <TextField label="Título" required maxLength={160} placeholder="Resumo curto do problema" error={errors.title?.message} {...register('title')} />

            <div className="grid gap-5 sm:grid-cols-2">
              <SelectField label="Categoria" required disabled={categories.isPending || noCategories} error={errors.categoryId?.message} {...register('categoryId')}>
                <option value="">{categories.isPending ? 'Carregando…' : 'Selecione…'}</option>
                {(categories.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </SelectField>
              {canPickPriority ? (
                <SelectField label="Prioridade" required hint="A equipe pode ajustar a prioridade ao analisar o chamado." error={errors.priority?.message} {...register('priority')}>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </option>
                  ))}
                </SelectField>
              ) : (
                <p className="self-end text-sm text-fg-muted">A prioridade será definida pela equipe de suporte ao analisar o chamado.</p>
              )}
            </div>

            <TextAreaField label="Descrição" required rows={7} maxLength={10000} placeholder="O que aconteceu? Quando começou? Já tentou alguma solução?" error={errors.description?.message} {...register('description')} />

            <AttachmentPicker files={files} onChange={setFiles} disabled={isSubmitting} />

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Link to="/chamados" className="btn-secondary">
                Cancelar
              </Link>
              <button type="submit" className="btn-primary" disabled={isSubmitting || noCategories}>
                {isSubmitting && <Spinner />}
                {isSubmitting ? (files.length > 0 ? 'Abrindo e enviando anexos…' : 'Abrindo chamado…') : 'Abrir chamado'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
