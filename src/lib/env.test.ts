import { describe, expect, it } from 'vitest'
import { parseEnv } from '@/lib/env'

describe('parseEnv', () => {
  it('aceita URL e chave válidas', () => {
    const r = parseEnv({
      VITE_SUPABASE_URL: 'https://abc.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'x'.repeat(40),
    })
    expect(r.success).toBe(true)
  })

  it('rejeita variáveis ausentes com mensagens claras', () => {
    const r = parseEnv({})
    expect(r.success).toBe(false)
    if (!r.success) {
      const msgs = r.error.issues.map((i) => i.message)
      expect(msgs).toContain('VITE_SUPABASE_URL não definida')
      expect(msgs).toContain('VITE_SUPABASE_ANON_KEY não definida')
    }
  })

  it('rejeita URL malformada', () => {
    const r = parseEnv({ VITE_SUPABASE_URL: 'não-é-url', VITE_SUPABASE_ANON_KEY: 'x'.repeat(40) })
    expect(r.success).toBe(false)
  })
})
