'use server'

import { signIn } from '@/lib/auth'
import { AuthError } from 'next-auth'
import { redirect } from 'next/navigation'

export async function loginAction(input: {
  email: string
  senha: string
  callbackUrl?: string
}): Promise<{ error?: string } | void> {
  const target = input.callbackUrl && input.callbackUrl.startsWith('/') ? input.callbackUrl : '/dashboard'
  try {
    await signIn('credentials', {
      email: input.email,
      senha: input.senha,
      redirect: false,
    })
  } catch (e) {
    if (e instanceof AuthError) {
      return { error: 'E-mail ou senha inválidos.' }
    }
    throw e
  }
  redirect(target)
}

export async function logoutAction() {
  const { signOut } = await import('@/lib/auth')
  await signOut({ redirectTo: '/login' })
}
