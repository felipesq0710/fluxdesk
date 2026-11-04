import { z } from 'zod'

export const MAX_TAGS = 10

export function parseTags(input: string): string[] {
  const seen = new Set<string>()
  for (const raw of input.split(',')) {
    const tag = raw.trim().toLowerCase()
    if (tag) seen.add(tag)
  }
  return [...seen]
}

export const articleFormSchema = z.object({
  title: z.string().trim().min(3, 'O título precisa ter ao menos 3 caracteres.').max(160, 'O título pode ter no máximo 160 caracteres.'),
  content: z.string().trim().min(10, 'O conteúdo precisa ter ao menos 10 caracteres.').max(50_000, 'O conteúdo pode ter no máximo 50.000 caracteres.'),
  categoryId: z.string(),
  status: z.enum(['draft', 'published']),
  tags: z.string().superRefine((value, ctx) => {
    const tags = parseTags(value)
    if (tags.length > MAX_TAGS) ctx.addIssue({ code: 'custom', message: `Use no máximo ${MAX_TAGS} tags.` })
    if (tags.some((t) => t.length > 30)) ctx.addIssue({ code: 'custom', message: 'Cada tag pode ter no máximo 30 caracteres.' })
  }),
})

export type ArticleFormValues = z.infer<typeof articleFormSchema>
