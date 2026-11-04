import { z } from 'zod'
import { passwordRule } from '@/schemas/auth'

export const profileNameSchema = z.object({
  fullName: z.string().trim().min(2, 'Informe seu nome completo.').max(120, 'O nome deve ter no máximo 120 caracteres.'),
})
export type ProfileNameValues = z.infer<typeof profileNameSchema>

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe sua senha atual.'),
    password: passwordRule,
    confirmPassword: z.string().min(1, 'Confirme a nova senha.'),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'As senhas não coincidem.' })
  .refine((d) => d.password !== d.currentPassword, { path: ['password'], message: 'A nova senha deve ser diferente da atual.' })
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>
