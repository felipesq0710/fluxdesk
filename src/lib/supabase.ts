import { createClient } from '@supabase/supabase-js'
import { getEnv } from '@/lib/env'

const env = getEnv()

// Cliente Supabase do navegador. Usa somente a chave anon (pública):
// toda autorização é imposta pelo banco via RLS.
export const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // PKCE: links de e-mail trocam um código de uso único (sem tokens na URL).
    // Consequência: o link deve ser aberto no mesmo navegador em que foi solicitado.
    flowType: 'pkce',
  },
})
