import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Camera, Monitor, Moon, Sun, Trash2 } from 'lucide-react'
import { z } from 'zod'
import { Alert } from '@/components/ui/Alert'
import { Avatar } from '@/components/ui/Avatar'
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
import { PROFILE_AVATAR_MAX_BYTES, PROFILE_AVATAR_MIME_TYPES, removeProfileAvatar, uploadProfileAvatar } from '@/services/profileAvatars'
import { useProfileAvatar } from '@/hooks/useProfileAvatar'

const profileEmailSchema = z.object({ email: z.email('Informe um endereço de e-mail válido.') })
type ProfileEmailValues = z.infer<typeof profileEmailSchema>

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
  const icons = { system: Monitor, light: Sun, dark: Moon }
  const descriptions = { system: 'Respeita o dispositivo', light: 'Fundo claro', dark: 'Fundo escuro' }
  return (
    <Section title="Aparência" description="Fica salvo apenas neste navegador.">
      <fieldset>
        <legend className="sr-only">Tema da interface</legend>
        <div className="grid gap-2 md:grid-cols-3">
          {THEME_OPTIONS.map((o) => {
            const Icon = icons[o.value]
            return (
              <label
                key={o.value}
                className="group flex min-h-[3.5rem] cursor-pointer items-center gap-3 rounded-control border border-line px-3 py-2.5 text-sm transition-colors hover:bg-surface-muted has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand"
              >
                <input type="radio" aria-label={o.label} className="accent-brand-action" name="theme" value={o.value} checked={preference === o.value} onChange={() => setPreference(o.value)} />
                <Icon className="h-4 w-4 text-fg-muted" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block font-medium text-fg">{o.label}</span>
                  <span className="block text-xs text-fg-muted">{descriptions[o.value]}</span>
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>
    </Section>
  )
}

function ProfileSection() {
  const profile = useProfile()
  const { refetchProfile, updateEmail } = useAuth()
  const queryClient = useQueryClient()
  const nameInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailNotice, setEmailNotice] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [photoPending, setPhotoPending] = useState(false)
  const avatarQuery = useProfileAvatar(profile.id)
  const emailForm = useForm<ProfileEmailValues>({
    resolver: zodResolver(profileEmailSchema),
    defaultValues: { email: profile.email },
  })
  const currentEmail = useWatch({ control: emailForm.control, name: 'email' })
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<ProfileNameValues>({ resolver: zodResolver(profileNameSchema), defaultValues: { fullName: profile.full_name } })
  const fullNameRegistration = register('fullName')

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

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

  function onChoosePhoto(file?: File) {
    setPhotoError(null)
    if (!file) return
    if (!(PROFILE_AVATAR_MIME_TYPES as readonly string[]).includes(file.type)) {
      setPhotoError('Use uma imagem JPEG, PNG ou WebP.')
      if (fileInput.current) fileInput.current.value = ''
      return
    }
    if (file.size > PROFILE_AVATAR_MAX_BYTES) {
      setPhotoError('A foto deve ter no máximo 5 MB.')
      if (fileInput.current) fileInput.current.value = ''
      return
    }
    setSelectedPhoto(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  async function savePhoto() {
    if (!selectedPhoto) return
    setPhotoError(null)
    setPhotoPending(true)
    try {
      await uploadProfileAvatar(profile.id, selectedPhoto)
      setSelectedPhoto(null)
      setPreviewUrl(null)
      if (fileInput.current) fileInput.current.value = ''
      await queryClient.invalidateQueries({ queryKey: ['profile-avatar', profile.id] })
      toast.success('Foto de perfil atualizada.')
    } catch (e) {
      setPhotoError(e instanceof Error && /indisponível na demonstração/i.test(e.message) ? e.message : dbErrorMessage(e))
    } finally {
      setPhotoPending(false)
    }
  }

  async function deletePhoto() {
    setPhotoError(null)
    setPhotoPending(true)
    try {
      await removeProfileAvatar(profile.id)
      setSelectedPhoto(null)
      setPreviewUrl(null)
      if (fileInput.current) fileInput.current.value = ''
      await queryClient.invalidateQueries({ queryKey: ['profile-avatar', profile.id] })
      toast.success('Foto removida. As iniciais serão exibidas.')
    } catch (e) {
      setPhotoError(e instanceof Error && /indisponível na demonstração/i.test(e.message) ? e.message : dbErrorMessage(e))
    } finally {
      setPhotoPending(false)
    }
  }

  async function onEmailSubmit(values: ProfileEmailValues) {
    setEmailError(null)
    setEmailNotice(null)
    const result = await updateEmail(values.email)
    if (result.error) {
      setEmailError(result.error instanceof Error && /indisponível na demonstração/i.test(result.error.message) ? result.error.message : authErrorMessage(result.error))
      return
    }
    if (result.needsConfirmation) {
      setEmailNotice('Pedido enviado. Confirme a alteração no novo endereço; o e-mail atual continuará ativo até a confirmação.')
      return
    }
    setEmailNotice('E-mail de acesso atualizado.')
  }

  return (
    <section className="card overflow-hidden" aria-labelledby="sec-Perfil">
      <div className="border-b border-line px-5 py-4 sm:px-6">
        <h2 id="sec-Perfil" className="text-base font-semibold text-fg">Perfil</h2>
        <p className="mt-1 text-sm text-fg-muted">Identificação e informações da sua conta.</p>
      </div>
      <div className="p-5 sm:p-6">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar name={profile.full_name} profileId={profile.id} imageUrl={previewUrl ?? avatarQuery.data} size="lg" className="ring-4 ring-brand-soft" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold text-fg">{profile.full_name}</p>
            <p className="truncate text-sm text-fg-muted">{profile.email}</p>
            <span className="mt-2 inline-flex rounded-chip bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-fg">{ROLE_LABEL[profile.role]}</span>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Selecionar foto de perfil" onChange={(event) => onChoosePhoto(event.target.files?.[0])} />
            <button type="button" className="btn-secondary" onClick={() => fileInput.current?.click()}>
              <Camera className="h-4 w-4" aria-hidden="true" />
              {avatarQuery.data ? 'Alterar foto' : 'Adicionar foto'}
            </button>
            {selectedPhoto && <button type="button" className="btn-primary" disabled={photoPending} onClick={() => void savePhoto()}>{photoPending && <Spinner />}Salvar foto</button>}
            {(avatarQuery.data || selectedPhoto) && <button type="button" className="btn-ghost" disabled={photoPending} onClick={() => void deletePhoto()}><Trash2 className="h-4 w-4" aria-hidden="true" />Remover</button>}
          </div>
        </div>
        {photoError && <Alert variant="danger" className="mb-4">{photoError}</Alert>}
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 pt-5">
          {error && <Alert variant="danger">{error}</Alert>}
          <TextField
            id="profile-name"
            label="Nome completo"
            required
            maxLength={120}
            error={errors.fullName?.message}
            {...fullNameRegistration}
            ref={(element) => {
              fullNameRegistration.ref(element)
              nameInput.current = element
            }}
          />
          <div className="flex justify-end">
            <button type="submit" className="btn-primary disabled:opacity-100 disabled:text-fg-muted" disabled={isSubmitting || !isDirty}>
              {isSubmitting && <Spinner />}
              Salvar nome
            </button>
          </div>
        </form>
        <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} noValidate className="space-y-4 border-t border-line pt-5">
          {emailError && <Alert variant="danger">{emailError}</Alert>}
          {emailNotice && <Alert variant="info">{emailNotice}</Alert>}
          <TextField
            id="profile-email"
            label="E-mail de acesso"
            type="email"
            required
            autoComplete="email"
            error={emailForm.formState.errors.email?.message}
            {...emailForm.register('email')}
          />
          <div className="flex justify-end">
            <button type="submit" className="btn-secondary disabled:opacity-100 disabled:text-fg" disabled={emailForm.formState.isSubmitting || currentEmail.trim().toLowerCase() === profile.email.toLowerCase()}>
              {emailForm.formState.isSubmitting && <Spinner />}
              Atualizar e-mail
            </button>
          </div>
        </form>
      </div>
    </section>
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
          <button type="button" className="btn-primary disabled:opacity-100 disabled:text-fg-muted" disabled={!dirty || update.isPending} onClick={() => void save()}>
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
    <div className="space-y-5">
      <header>
        <h1 className="page-title">Configurações</h1>
        <p className="page-lead">Gerencie sua conta, segurança e preferências do Fluxdesk.</p>
      </header>
      <div className="space-y-4">
        <ProfileSection />
        <PasswordSection />
        <AppearanceSection />
        {isAdmin(profile.role) && <SystemSection />}
      </div>
    </div>
  )
}
