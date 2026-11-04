import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { MailCheck } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { PasswordField } from '@/components/ui/PasswordField'
import { Spinner } from '@/components/ui/Spinner'
import { TextField } from '@/components/ui/TextField'
import { useAuth } from '@/hooks/useAuth'
import AuthLayout from '@/layouts/AuthLayout'
import { authErrorMessage } from '@/lib/errors'
import { registerSchema, type RegisterValues } from '@/schemas/auth'

export default function RegisterPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  })

  async function onSubmit(values: RegisterValues) {
    setFormError(null)
    const { error, needsEmailConfirmation } = await signUp(values.fullName, values.email, values.password)
    if (error) {
      setFormError(authErrorMessage(error))
      return
    }
    if (needsEmailConfirmation) {
      setConfirmationEmail(values.email)
      return
    }
    navigate('/', { replace: true })
  }

  if (confirmationEmail) {
    return (
      <AuthLayout
        title="Verifique seu e-mail"
        footer={
          <Link to="/entrar" className="font-medium text-brand hover:underline dark:text-brand-300">
            Voltar para o login
          </Link>
        }
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <MailCheck className="h-10 w-10 text-success" aria-hidden="true" />
          <p className="text-sm text-fg">
            Se o endereço <strong className="break-all">{confirmationEmail}</strong> puder ser cadastrado, você
            receberá uma mensagem com o link de confirmação.
          </p>
          <p className="text-sm text-fg-muted">Depois de confirmar, volte e entre com seu e-mail e senha.</p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Criar conta"
      subtitle="Cadastre-se para abrir e acompanhar chamados de suporte."
      footer={
        <>
          Já tem conta?{' '}
          <Link to="/entrar" className="font-medium text-brand hover:underline dark:text-brand-300">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {formError && <Alert variant="danger">{formError}</Alert>}

        <TextField
          label="Nome completo"
          autoComplete="name"
          required
          error={errors.fullName?.message}
          {...register('fullName')}
        />
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
          autoComplete="new-password"
          required
          hint="Mínimo de 8 caracteres, com letras e números."
          error={errors.password?.message}
          {...register('password')}
        />
        <PasswordField
          label="Confirmar senha"
          autoComplete="new-password"
          required
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
          {isSubmitting && <Spinner />}
          {isSubmitting ? 'Criando conta…' : 'Criar conta'}
        </button>
      </form>
    </AuthLayout>
  )
}
