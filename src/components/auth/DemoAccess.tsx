export interface DemoAccessProps {
  // Preenche o formulário de login com as credenciais fictícias escolhidas e envia.
  onPick: (email: string, password: string) => void
}

// Na versão real não há acesso de demonstração; o build de demonstração troca este módulo (vite.demo.config.ts).
export function DemoAccess(_props: DemoAccessProps) {
  return null
}
