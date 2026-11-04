import { z } from 'zod'

export const categoryFormSchema = z.object({
  name: z.string().trim().min(2, 'O nome precisa ter ao menos 2 caracteres.').max(80, 'O nome pode ter no máximo 80 caracteres.'),
  description: z.string().trim().max(300, 'A descrição pode ter no máximo 300 caracteres.'),
})
export type CategoryFormValues = z.infer<typeof categoryFormSchema>
