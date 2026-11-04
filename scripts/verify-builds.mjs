// Confere o isolamento entre a versão funcional (dist) e a demonstração (dist-demo).
// Usa valores FALSOS de ambiente: não acessa o Supabase nem lê credenciais reais.
import { execSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const FAKE_URL = 'https://fake-check-ref.supabase.co'
const FAKE_KEY = 'FAKE_ANON_KEY_FOR_BUILD_CHECK_0123456789'
const env = { ...process.env, VITE_SUPABASE_URL: FAKE_URL, VITE_SUPABASE_ANON_KEY: FAKE_KEY }

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}
function contains(dir, pattern) {
  return files(dir).filter((f) => /\.(js|html|css)$/.test(f) && pattern.test(readFileSync(f, 'utf8')))
}

execSync('npm run build', { stdio: 'inherit', env })
execSync('npm run build:demo', { stdio: 'inherit', env })

const checks = [
  ['dist (funcional) não contém dados nem autenticação simulados', contains('dist', /demo\.fluxdesk|fluxdesk-demo-role|demo1234|supabase-stub/), 0],
  ['dist (funcional) usa as variáveis de ambiente do Supabase', contains('dist', /fake-check-ref/), 1],
  ['dist-demo não contém URL nem chave do Supabase', contains('dist-demo', /fake-check-ref|FAKE_ANON_KEY|supabase\.co/), 0],
  ['dist-demo não contém o cliente nem a leitura de variáveis do Supabase', contains('dist-demo', /createClient|GoTrueClient|VITE_SUPABASE/), 0],
  ['dist-demo contém a demonstração fictícia', contains('dist-demo', /demo\.fluxdesk/), 'any'],
]

let failed = false
for (const [label, found, expected] of checks) {
  const ok = expected === 'any' ? found.length > 0 : expected === 1 ? found.length > 0 : found.length === 0
  console.log(`${ok ? 'OK  ' : 'FALHA'} ${label}${ok ? '' : ` -> ${found.join(', ')}`}`)
  if (!ok) failed = true
}
process.exit(failed ? 1 : 0)
