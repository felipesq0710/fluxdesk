import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { DemoAccess } from '@/components/auth/DemoAccess'
import { Alert } from '@/components/ui/Alert'
import { PasswordField } from '@/components/ui/PasswordField'
import { Spinner } from '@/components/ui/Spinner'
import { TextField } from '@/components/ui/TextField'
import { useAuth } from '@/hooks/useAuth'
import AuthLayout from '@/layouts/AuthLayout'
import { authErrorMessage } from '@/lib/errors'
import { getRedirectTarget } from '@/lib/navigation'
import { loginSchema, type LoginValues } from '@/schemas/auth'

export default function LoginPage() {
  const { signIn, sessionExpired } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: LoginValues) {
    setFormError(null)
    const { error } = await signIn(values.email, values.password)
    if (error) {
      setFormError(authErrorMessage(error))
      return
    }
    navigate(getRedirectTarget(location.state), { replace: true })
  }

  function enterAs(email: string, password: string) {
    setValue('email', email)
    setValue('password', password)
    void handleSubmit(onSubmit)()
  }

  return (
    <AuthLayout
      title="Entrar no Fluxdesk"
      subtitle="Use seu e-mail e senha para acessar seus chamados."
      footer={
        <>
          Ainda não tem conta?{' '}
          <Link to="/cadastro" className="font-medium text-brand hover:underline dark:text-brand-300">
            Criar conta
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {sessionExpired && (
          <Alert variant="warning" title="Sua sessão expirou">
            Por segurança, entre novamente para continuar.
          </Alert>
        )}
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
        <PasswordField
          label="Senha"
          autoComplete="current-password"
          required
          error={errors.password?.message}
          {...register('password')}
        />

        <div className="text-right">
          <Link to="/recuperar-senha" className="text-sm font-medium text-brand hover:underline dark:text-brand-300">
            Esqueci minha senha
          </Link>
        </div>

        <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
          {isSubmitting && <Spinner />}
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <DemoAccess onPick={enterAs} />
    </AuthLayout>
  )
}
