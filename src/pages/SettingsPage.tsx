import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Alert } from '@/components/ui/Alert'
import { PasswordField } from '@/components/ui/PasswordField'
import { SelectField } from '@/components/ui/SelectField'
import { Spinner } from '@/components/ui/Spinner'
import { TextField } from '@/components/ui/TextField'
import { useTheme, type ThemePreference } from '@/contexts/ThemeContext'
import { useAuth, useProfile } from '@/hooks/useAuth'
import { useAppSettings, useUpdateSettings } from '@/hooks/useSettings'
import { ROLE_LABEL } from '@/lib/constants'
import { authErrorMessage, dbErrorMessage } from '@/lib/errors'
import { isAdmin } from '@/lib/permissions'
import { changePasswordSchema, profileNameSchema, type ChangePasswordValues, type ProfileNameValues } from '@/schemas/settings'
import { updateOwnName } from '@/services/profiles'

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6" aria-labelledby={`sec-${title}`}>
      <h2 id={`sec-${title}`} className="text-base font-semibold text-fg">
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Seguir o sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
]

function AppearanceSection() {
  const { preference, setPreference } = useTheme()
  return (
    <Section title="Aparência" description="Fica salvo apenas neste navegador.">
      <fieldset>
        <legend className="sr-only">Tema da interface</legend>
        <div className="flex flex-wrap gap-2">
          {THEME_OPTIONS.map((o) => (
            <label
              key={o.value}
              className="flex min-h-[2.5rem] cursor-pointer items-center gap-2 rounded-control border border-line px-3 py-2 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-100 dark:has-[:checked]:bg-brand/15"
            >
              <input type="radio" name="theme" value={o.value} checked={preference === o.value} onChange={() => setPreference(o.value)} />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>
    </Section>
  )
}

function ProfileSection() {
  const profile = useProfile()
  const { refetchProfile } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<ProfileNameValues>({ resolver: zodResolver(profileNameSchema), defaultValues: { fullName: profile.full_name } })

  async function onSubmit(values: ProfileNameValues) {
    setError(null)
    try {
      await updateOwnName(profile.id, values.fullName)
      refetchProfile()
      reset({ fullName: values.fullName })
      toast.success('Nome atualizado.')
    } catch (e) {
      setError(dbErrorMessage(e))
    }
  }

  return (
    <Section title="Perfil">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <TextField label="Nome completo" required maxLength={120} error={errors.fullName?.message} {...register('fullName')} />
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-fg-muted">E-mail</dt>
            <dd className="text-fg">{profile.email}</dd>
          </div>
          <div>
            <dt className="text-fg-muted">Perfil de acesso</dt>
            <dd className="text-fg">{ROLE_LABEL[profile.role]}</dd>
          </div>
        </dl>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={isSubmitting || !isDirty}>
            {isSubmitting && <Spinner />}
            Salvar nome
          </button>
        </div>
      </form>
    </Section>
  )
}

function PasswordSection() {
  const profile = useProfile()
  const { signIn, updatePassword } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({ resolver: zodResolver(changePasswordSchema), defaultValues: { currentPassword: '', password: '', confirmPassword: '' } })

  async function onSubmit(values: ChangePasswordValues) {
    setError(null)
    // Confirma a identidade: quem está com a aba aberta precisa conhecer a senha atual.
    const check = await signIn(profile.email, values.currentPassword)
    if (check.error) {
      setError('A senha atual está incorreta.')
      return
    }
    const result = await updatePassword(values.password)
    if (result.error) {
      setError(authErrorMessage(result.error))
      return
    }
    reset()
    toast.success('Senha alterada com sucesso.')
  }

  return (
    <Section title="Segurança" description="Alterar a senha exige a senha atual.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <PasswordField label="Senha atual" required autoComplete="current-password" error={errors.currentPassword?.message} {...register('currentPassword')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <PasswordField label="Nova senha" required autoComplete="new-password" hint="Mínimo de 8 caracteres, com letra e número." error={errors.password?.message} {...register('password')} />
          <PasswordField label="Confirmar nova senha" required autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        </div>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting && <Spinner />}
            Alterar senha
          </button>
        </div>
      </form>
    </Section>
  )
}

const REOPEN_CHOICES = [1, 3, 7, 15, 30, 90]

function SystemSection() {
  const { settings, isPending } = useAppSettings()
  const update = useUpdateSettings()
  const [allow, setAllow] = useState<boolean | null>(null)
  const [days, setDays] = useState<string | null>(null)

  const currentAllow = allow ?? settings.allow_requester_priority
  const currentDays = days ?? (settings.requester_reopen_days === null ? '' : String(settings.requester_reopen_days))
  const choices = settings.requester_reopen_days !== null && !REOPEN_CHOICES.includes(settings.requester_reopen_days) ? [...REOPEN_CHOICES, settings.requester_reopen_days].sort((a, b) => a - b) : REOPEN_CHOICES
  const dirty = currentAllow !== settings.allow_requester_priority || currentDays !== (settings.requester_reopen_days === null ? '' : String(settings.requester_reopen_days))

  async function save() {
    try {
      await update.mutateAsync({ allow_requester_priority: currentAllow, requester_reopen_days: currentDays === '' ? null : Number(currentDays) })
      setAllow(null)
      setDays(null)
      toast.success('Configurações do sistema salvas.')
    } catch (e) {
      toast.error(dbErrorMessage(e))
    }
  }

  return (
    <Section title="Sistema" description="Regras aplicadas a todos os usuários. Visível apenas para administradores.">
      <div className="space-y-4">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4" checked={currentAllow} disabled={isPending} onChange={(e) => setAllow(e.target.checked)} />
          <span>
            <span className="block font-medium text-fg">Solicitantes escolhem a prioridade</span>
            <span className="block text-fg-muted">Desativado: chamados abertos por solicitantes entram com prioridade média e a equipe ajusta depois.</span>
          </span>
        </label>
        <SelectField label="Prazo para o solicitante reabrir um chamado resolvido" value={currentDays} disabled={isPending} onChange={(e) => setDays(e.target.value)}>
          <option value="">Sem limite</option>
          {choices.map((d) => (
            <option key={d} value={d}>
              {d} {d === 1 ? 'dia' : 'dias'} após a resolução
            </option>
          ))}
        </SelectField>
        <div className="flex justify-end">
          <button type="button" className="btn-primary" disabled={!dirty || update.isPending} onClick={() => void save()}>
            {update.isPending && <Spinner />}
            Salvar configurações
          </button>
        </div>
      </div>
    </Section>
  )
}

export default function SettingsPage() {
  const profile = useProfile()
  return (
    <div className="max-w-5xl space-y-4">
      <h1 className="page-title">Configurações</h1>
      <AppearanceSection />
      <ProfileSection />
      <PasswordSection />
      {isAdmin(profile.role) && <SystemSection />}
    </div>
  )
}
