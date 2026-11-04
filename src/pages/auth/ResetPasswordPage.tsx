import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { FullPageLoader } from '@/components/feedback/FullPageLoader'
import { Alert } from '@/components/ui/Alert'
import { PasswordField } from '@/components/ui/PasswordField'
import { Spinner } from '@/components/ui/Spinner'
import { useAuth } from '@/hooks/useAuth'
import AuthLayout from '@/layouts/AuthLayout'
import { authErrorMessage } from '@/lib/errors'
import { resetPasswordSchema, type ResetPasswordValues } from '@/schemas/auth'

// Abre a sessão de recuperação criada pelo link seguro enviado por e-mail.
// Sem sessão (link inválido, expirado ou aberto em outro navegador) a redefinição não é possível.
export default function ResetPasswordPage() {
  const { initializing, session, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  if (initializing) return <FullPageLoader label="Validando link…" />

  if (!session) {
    return (
      <AuthLayout
        title="Link inválido ou expirado"
        footer={
          <Link to="/entrar" className="font-medium text-brand hover:underline dark:text-brand-300">
            Voltar para o login
          </Link>
        }
      >
        <div className="space-y-4">
          <Alert variant="warning">
            Não foi possível validar o link de recuperação. Ele pode ter expirado, já ter sido usado ou ter sido
            aberto em outro navegador.
          </Alert>
          <Link to="/recuperar-senha" className="btn-primary w-full">
            Solicitar novo link
          </Link>
        </div>
      </AuthLayout>
    )
  }

  async function onSubmit({ password }: ResetPasswordValues) {
    setFormError(null)
    const { error } = await updatePassword(password)
    if (error) {
      setFormError(authErrorMessage(error))
      return
    }
    toast.success('Senha redefinida com sucesso.')
    navigate('/', { replace: true })
  }

  return (
    <AuthLayout title="Criar nova senha" subtitle="Escolha uma senha forte que você não use em outros serviços.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {formError && <Alert variant="danger">{formError}</Alert>}
        <PasswordField
          label="Nova senha"
          autoComplete="new-password"
          required
          hint="Mínimo de 8 caracteres, com letras e números."
          error={errors.password?.message}
          {...register('password')}
        />
        <PasswordField
          label="Confirmar nova senha"
          autoComplete="new-password"
          required
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
          {isSubmitting && <Spinner />}
          {isSubmitting ? 'Salvando…' : 'Redefinir senha'}
        </button>
      </form>
    </AuthLayout>
  )
}
