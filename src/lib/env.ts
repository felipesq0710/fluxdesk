import { z } from 'zod'
import { required } from '@/lib/zodMessages'

const envSchema = z.object({
  VITE_SUPABASE_URL: z
    .string({ error: required('VITE_SUPABASE_URL não definida') })
    .url('VITE_SUPABASE_URL deve ser uma URL válida'),
  VITE_SUPABASE_ANON_KEY: z
    .string({ error: required('VITE_SUPABASE_ANON_KEY não definida') })
    .min(20, 'VITE_SUPABASE_ANON_KEY parece inválida'),
})

export type AppEnv = z.infer<typeof envSchema>

// Valida as variáveis de ambiente públicas. Nunca inclua a chave service_role aqui.
export function parseEnv(source: Record<string, unknown>) {
  return envSchema.safeParse(source)
}

export const envResult = parseEnv(import.meta.env)

export function getEnv(): AppEnv {
  if (!envResult.success) {
    throw new Error('Variáveis de ambiente do Supabase ausentes ou inválidas.')
  }
  return envResult.data
}
