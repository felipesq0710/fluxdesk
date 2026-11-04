const AUTH_PATHS = ['/entrar', '/cadastro', '/recuperar-senha', '/redefinir-senha']

// Destino após o login: a rota que o usuário tentou acessar, desde que seja
// um caminho interno seguro (evita redirecionamento aberto).
export function getRedirectTarget(state: unknown): string {
  const from = (state as { from?: { pathname?: unknown; search?: unknown } } | null)?.from
  const pathname = from?.pathname
  if (
    typeof pathname === 'string' &&
    pathname.startsWith('/') &&
    !pathname.startsWith('//') &&
    !AUTH_PATHS.includes(pathname)
  ) {
    const search = typeof from?.search === 'string' && from.search.startsWith('?') ? from.search : ''
    return pathname + search
  }
  return '/'
}
