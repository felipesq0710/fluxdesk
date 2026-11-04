interface ErrorLike {
  message?: string
  code?: string
  status?: number
  name?: string
}

function asErrorLike(error: unknown): ErrorLike {
  if (error && typeof error === 'object') return error as ErrorLike
  if (typeof error === 'string') return { message: error }
  return {}
}

const NETWORK_PATTERN = /failed to fetch|networkerror|network request failed|load failed|fetch failed/i

export function isNetworkError(error: unknown): boolean {
  const e = asErrorLike(error)
  return (
    e.name === 'AuthRetryableFetchError' ||
    (error instanceof TypeError && NETWORK_PATTERN.test(error.message)) ||
    NETWORK_PATTERN.test(e.message ?? '')
  )
}

const NETWORK_MESSAGE = 'Falha de conexão. Verifique sua internet e tente novamente.'

// Traduz erros do Supabase Auth para mensagens claras em português.
export function authErrorMessage(error: unknown): string {
  if (isNetworkError(error)) return NETWORK_MESSAGE
  const e = asErrorLike(error)
  switch (e.code) {
    case 'invalid_credentials':
      return 'E-mail ou senha incorretos.'
    case 'email_not_confirmed':
      return 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.'
    case 'user_already_exists':
    case 'email_exists':
      return 'Não foi possível concluir o cadastro com este e-mail.'
    case 'weak_password':
      return 'Senha fraca. Use ao menos 8 caracteres, com letras e números.'
    case 'same_password':
      return 'A nova senha deve ser diferente da senha atual.'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.'
    case 'signup_disabled':
      return 'Novos cadastros estão desativados no momento.'
    case 'user_banned':
      return 'Esta conta está bloqueada. Entre em contato com o administrador.'
    case 'session_expired':
    case 'session_not_found':
    case 'refresh_token_not_found':
      return 'Sua sessão expirou. Entre novamente.'
    default:
      break
  }
  if (e.status === 429) return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.'
  return 'Não foi possível concluir a operação. Tente novamente em instantes.'
}

// Traduz erros do PostgREST/PostgreSQL. As mensagens das regras de negócio
// (triggers) já são escritas em português e podem ser exibidas diretamente.
export function dbErrorMessage(error: unknown): string {
  if (isNetworkError(error)) return NETWORK_MESSAGE
  const e = asErrorLike(error)
  const message = e.message ?? ''

  if (/row-level security|permission denied/i.test(message) || e.code === '42501' && /^new row/i.test(message)) {
    return 'Você não tem permissão para realizar esta ação.'
  }
  if (e.code === '23505') return 'Já existe um registro com estes dados.'
  if (e.code === '23503') return 'Operação bloqueada: existem registros relacionados.'
  if (/violates check constraint|invalid input/i.test(message) || e.code === '22P02') {
    return 'Dados inválidos. Verifique os campos informados.'
  }
  if ((e.code === '23514' || e.code === '42501') && message) return message
  if (e.status === 401 || /jwt expired/i.test(message)) return 'Sua sessão expirou. Entre novamente.'
  return 'Não foi possível concluir a operação. Tente novamente em instantes.'
}
