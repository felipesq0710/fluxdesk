import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Configuração do MODO DEMONSTRAÇÃO (npm run dev:demo / build:demo).
// Troca, só nesta configuração, os módulos que falam com o Supabase por versões em memória
// com dados fictícios. O build de produção (vite.config.ts) nunca inclui src/demo.
const src = (p: string) => fileURLToPath(new URL(`./src/${p}`, import.meta.url))
const swap = (module: string, demo: string) => ({ find: new RegExp(`^@/${module}$`), replacement: src(demo) })

// order 'pre': a troca precisa ocorrer antes de o Vite descobrir o script de entrada no build,
// senão o build:demo empacotaria a entrada real (src/main.tsx) e, com ela, a leitura do ambiente do Supabase.
const demoEntry = (): Plugin => ({
  name: 'fluxdesk-demo-entry',
  transformIndexHtml: {
    order: 'pre',
    handler: (html) => html.replace('/src/main.tsx', '/src/demo/main.tsx').replace('<title>', '<title>[Demo] '),
  },
})

export default defineConfig({
  plugins: [react(), demoEntry()],
  // A demonstração nunca lê arquivos .env nem expõe variáveis VITE_* (nenhuma credencial entra no bundle).
  envDir: false,
  envPrefix: 'FLUXDESK_DEMO_UNUSED_',
  build: { outDir: 'dist-demo' },
  resolve: {
    alias: [
      swap('contexts/AuthProvider', 'demo/DemoAuthProvider.tsx'),
      swap('components/auth/DemoAccess', 'demo/DemoAccess.tsx'),
      swap('lib/supabase', 'demo/supabase-stub.ts'),
      swap('services/tickets', 'demo/services/tickets.ts'),
      swap('services/notifications', 'demo/services/notifications.ts'),
      swap('services/settings', 'demo/services/settings.ts'),
      swap('services/categories', 'demo/services/categories.ts'),
      swap('services/profiles', 'demo/services/profiles.ts'),
      swap('services/articles', 'demo/services/articles.ts'),
      swap('services/reports', 'demo/services/reports.ts'),
      { find: '@', replacement: src('') },
    ],
  },
})
