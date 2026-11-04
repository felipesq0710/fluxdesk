// Mensagem para valor ausente (undefined), equivalente ao `required_error` do Zod 3.
// Outros erros de tipo continuam com a mensagem padrão do Zod.
//
// Uso: z.string({ error: required('Informe o título.') })
export function required(message: string) {
  return (issue: { input?: unknown }) => (issue.input === undefined ? message : undefined)
}
