import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { ConfigMissing } from '@/components/feedback/ConfigMissing'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { envResult } from '@/lib/env'

const container = document.getElementById('root')
if (!container) throw new Error('Elemento #root não encontrado')
const root = createRoot(container)

if (!envResult.success) {
  const problems = envResult.error.issues.map((issue) => issue.message)
  root.render(
    <StrictMode>
      <ThemeProvider>
        <ConfigMissing problems={problems} />
      </ThemeProvider>
    </StrictMode>,
  )
} else {
  // Importação dinâmica: o cliente Supabase só é criado com ambiente válido.
  void import('@/App').then(({ default: App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
}
