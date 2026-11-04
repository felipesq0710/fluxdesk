import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Alert } from '@/components/ui/Alert'
import { SelectField } from '@/components/ui/SelectField'
import { Spinner } from '@/components/ui/Spinner'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { TextField } from '@/components/ui/TextField'
import { useCategories, useUpdateTicket } from '@/hooks/useTickets'
import { dbErrorMessage } from '@/lib/errors'
import { canEditContent, type Actor } from '@/lib/ticketRules'
import { ticketFormSchema, type TicketFormValues } from '@/schemas/ticket'
import type { TicketPatch } from '@/services/tickets'
import type { Ticket } from '@/types/domain'

export function TicketContentEditor({ ticket, actor }: { ticket: Ticket; actor: Actor }) {
  const [editing, setEditing] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const update = useUpdateTicket(ticket.id)
  const categories = useCategories(true)
  const editable = canEditContent(ticket, actor)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TicketFormValues>({
    resolver: zodResolver(ticketFormSchema),
    defaultValues: { title: ticket.title, description: ticket.description, categoryId: ticket.category_id, priority: ticket.priority },
  })

  function startEditing() {
    reset({ title: ticket.title, description: ticket.description, categoryId: ticket.category_id, priority: ticket.priority })
    setFormError(null)
    setEditing(true)
  }

  async function onSubmit(values: TicketFormValues) {
    const patch: TicketPatch = {}
    if (values.title !== ticket.title) patch.title = values.title
    if (values.description !== ticket.description) patch.description = values.description
    if (values.categoryId !== ticket.category_id) patch.category_id = values.categoryId
    if (Object.keys(patch).length === 0) {
      setEditing(false)
      return
    }
    try {
      await update.mutateAsync(patch)
      toast.success('Chamado atualizado.')
      setEditing(false)
    } catch (error) {
      setFormError(dbErrorMessage(error))
    }
  }

  if (!editing) {
    return (
      <div>
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-fg">{ticket.description}</p>
        {editable && (
          <button type="button" className="btn-secondary mt-4" onClick={startEditing}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Editar chamado
          </button>
        )}
      </div>
    )
  }

  const options = categories.data ?? []
  const missingCurrent = ticket.category && !options.some((c) => c.id === ticket.category_id)

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4" aria-label="Editar chamado">
      {formError && <Alert variant="danger">{formError}</Alert>}
      <TextField label="Título" required maxLength={160} error={errors.title?.message} {...register('title')} />
      <SelectField label="Categoria" required error={errors.categoryId?.message} {...register('categoryId')}>
        {missingCurrent && <option value={ticket.category_id}>{ticket.category?.name} (inativa)</option>}
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>
      <TextAreaField label="Descrição" required rows={7} maxLength={10000} error={errors.description?.message} {...register('description')} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className="btn-secondary" onClick={() => setEditing(false)} disabled={isSubmitting}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting && <Spinner />}
          Salvar alterações
        </button>
      </div>
    </form>
  )
}
