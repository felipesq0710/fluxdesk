import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { MailCheck } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { TextField } from '@/components/ui/TextField'
import { useAuth } from '@/hooks/useAuth'
import AuthLayout from '@/layouts/AuthLayout'
import { authErrorMessage, isNetworkError } from '@/lib/errors'
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/schemas/auth'

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  async function onSubmit({ email }: ForgotPasswordValues) {
    setFormError(null)
    const { error } = await requestPasswordReset(email)
    // Resposta neutra: não revela se o e-mail existe. Só falhas de rede/limite são exibidas.
    if (error && (isNetworkError(error) || (error as { status?: number }).status === 429)) {
      setFormError(authErrorMessage(error))
      return
    }
    setSentTo(email)
  }

  const backLink = (
    <Link to="/entrar" className="font-medium text-brand hover:underline dark:text-brand-300">
      Voltar para o login
    </Link>
  )

  if (sentTo) {
    return (
      <AuthLayout title="Verifique seu e-mail" footer={backLink}>
        <div className="flex flex-col items-center gap-3 text-center">
          <MailCheck className="h-10 w-10 text-success" aria-hidden="true" />
          <p className="text-sm text-fg">
            Se existir uma conta para <strong className="break-all">{sentTo}</strong>, enviaremos um link para
            redefinir a senha.
          </p>
          <p className="text-sm text-fg-muted">
            Abra o link no mesmo navegador em que fez esta solicitação. O link expira em pouco tempo.
          </p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Recuperar senha"
      subtitle="Informe seu e-mail e enviaremos um link para criar uma nova senha."
      footer={backLink}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {formError && <Alert variant="danger">{formError}</Alert>}
        <TextField
          label="E-mail"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          error={errors.email?.message}
          {...register('email')}
        />
        <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
          {isSubmitting && <Spinner />}
          {isSubmitting ? 'Enviando…' : 'Enviar link de recuperação'}
        </button>
      </form>
    </AuthLayout>
  )
}
