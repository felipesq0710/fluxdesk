import '@testing-library/jest-dom/vitest'
import * as axeMatchers from 'vitest-axe/matchers'
import { cleanup } from '@testing-library/react'
import { afterEach, expect, vi } from 'vitest'

expect.extend(axeMatchers)

// Nenhum teste de interface deve alcançar o Supabase real: o uso acidental falha de forma explícita.
vi.mock('@/lib/supabase', () => ({
  supabase: new Proxy(
    {},
    {
      get(_target, prop) {
        throw new Error(`Cliente Supabase usado em teste sem mock (propriedade "${String(prop)}"). Simule o serviço correspondente.`)
      },
    },
  ),
}))

// Configurações do sistema: padrão permissivo, substituível em testes específicos.
vi.mock('@/services/settings', () => {
  const DEFAULT_SETTINGS = { allow_requester_priority: true, requester_reopen_days: null, updated_at: '' }
  return {
    DEFAULT_SETTINGS,
    getAppSettings: vi.fn(async () => DEFAULT_SETTINGS),
    updateAppSettings: vi.fn(async () => undefined),
  }
})

// jsdom não implementa ResizeObserver (usado pelos gráficos do recharts).
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

afterEach(() => {
  cleanup()
})
