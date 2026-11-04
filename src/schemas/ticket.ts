import { z } from 'zod'
import { required } from '@/lib/zodMessages'

export const ticketFormSchema = z.object({
  title: z
    .string({ error: required('Informe o título.') })
    .trim()
    .min(3, 'O título deve ter ao menos 3 caracteres.')
    .max(160, 'O título deve ter no máximo 160 caracteres.'),
  description: z
    .string({ error: required('Descreva o problema.') })
    .trim()
    .min(10, 'Descreva o problema com ao menos 10 caracteres.')
    .max(10000, 'A descrição deve ter no máximo 10.000 caracteres.'),
  categoryId: z
    .string({ error: required('Selecione uma categoria.') })
    .uuid('Selecione uma categoria.'),
  priority: z.enum(['low', 'medium', 'high', 'critical'], {
    error: () => 'Selecione a prioridade.',
  }),
})

export const commentSchema = z.object({
  body: z
    .string({ error: required('Escreva uma mensagem.') })
    .trim()
    .min(1, 'Escreva uma mensagem.')
    .max(5000, 'A mensagem deve ter no máximo 5.000 caracteres.'),
  kind: z.enum(['public', 'internal']),
})

export type TicketFormValues = z.infer<typeof ticketFormSchema>
export type CommentFormValues = z.infer<typeof commentSchema>
