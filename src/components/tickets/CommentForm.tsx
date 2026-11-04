import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Lock, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { useAddComment } from '@/hooks/useTickets'
import { dbErrorMessage } from '@/lib/errors'
import { isStaff } from '@/lib/permissions'
import { commentBlockedReason, type Actor } from '@/lib/ticketRules'
import { commentSchema, type CommentFormValues } from '@/schemas/ticket'
import type { Ticket } from '@/types/domain'

export function CommentForm({ ticket, actor }: { ticket: Ticket; actor: Actor }) {
  const addComment = useAddComment(ticket.id)
  const [formError, setFormError] = useState<string | null>(null)
  const staff = isStaff(actor.role)

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CommentFormValues>({
    resolver: zodResolver(commentSchema),
    defaultValues: { body: '', kind: 'public' },
  })

  const kind = useWatch({ control, name: 'kind' })
  const internal = kind === 'internal'

  const blocked = commentBlockedReason(ticket, actor)
  if (blocked) return <Alert variant="info">{blocked}</Alert>

  async function onSubmit(values: CommentFormValues) {
    setFormError(null)
    try {
      await addComment.mutateAsync({ authorId: actor.id, kind: values.kind, body: values.body })
      reset({ body: '', kind: values.kind })
      toast.success(values.kind === 'internal' ? 'Nota interna registrada.' : 'Mensagem enviada.')
    } catch (error) {
      setFormError(dbErrorMessage(error))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
      {formError && <Alert variant="danger">{formError}</Alert>}

      {staff ? (
        <fieldset>
          <legend className="field-label">Tipo de mensagem</legend>
          <div className="flex flex-wrap gap-2">
            <label className="flex min-h-[2.5rem] cursor-pointer items-center gap-2 rounded-control border border-line px-3 py-2 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand/10">
              <input type="radio" value="public" className="accent-brand" {...register('kind')} />
              Resposta pública
            </label>
            <label className="flex min-h-[2.5rem] cursor-pointer items-center gap-2 rounded-control border border-line px-3 py-2 text-sm has-[:checked]:border-warning has-[:checked]:bg-warning/10">
              <input type="radio" value="internal" className="accent-amber-500" {...register('kind')} />
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              Nota interna
            </label>
          </div>
        </fieldset>
      ) : (
        <input type="hidden" value="public" {...register('kind')} />
      )}

      <TextAreaField
        label={internal ? 'Nota interna' : 'Mensagem'}
        rows={4}
        maxLength={5000}
        placeholder={internal ? 'Anotação visível apenas para a equipe…' : 'Escreva sua mensagem…'}
        hint={internal ? 'Visível apenas para técnicos e administradores. O solicitante não é notificado.' : undefined}
        error={errors.body?.message}
        className={internal ? 'border-warning/70 bg-warning/5' : undefined}
        {...register('body')}
      />

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? <Spinner /> : internal ? <Lock className="h-4 w-4" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
          {internal ? 'Salvar nota interna' : 'Enviar mensagem'}
        </button>
      </div>
    </form>
  )
}
