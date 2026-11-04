import { z } from 'zod'
import { required } from '@/lib/zodMessages'

const email = z
  .string({ error: required('Informe seu e-mail.') })
  .trim()
  .min(1, 'Informe seu e-mail.')
  .max(254, 'E-mail muito longo.')
  .email('Informe um e-mail válido.')

export const passwordRule = z
  .string({ error: required('Informe uma senha.') })
  .min(8, 'A senha deve ter ao menos 8 caracteres.')
  .max(72, 'A senha deve ter no máximo 72 caracteres.')
  .regex(/[A-Za-zÀ-ÿ]/, 'A senha deve conter ao menos uma letra.')
  .regex(/\d/, 'A senha deve conter ao menos um número.')

export const loginSchema = z.object({
  email,
  password: z.string({ error: required('Informe sua senha.') }).min(1, 'Informe sua senha.'),
})

export const registerSchema = z
  .object({
    fullName: z
      .string({ error: required('Informe seu nome.') })
      .trim()
      .min(2, 'Informe seu nome completo.')
      .max(120, 'O nome deve ter no máximo 120 caracteres.'),
    email,
    password: passwordRule,
    confirmPassword: z.string({ error: required('Confirme sua senha.') }).min(1, 'Confirme sua senha.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não coincidem.',
  })

export const forgotPasswordSchema = z.object({ email })

export const resetPasswordSchema = z
  .object({
    password: passwordRule,
    confirmPassword: z.string({ error: required('Confirme sua senha.') }).min(1, 'Confirme sua senha.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não coincidem.',
  })

export type LoginValues = z.infer<typeof loginSchema>
export type RegisterValues = z.infer<typeof registerSchema>
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>
