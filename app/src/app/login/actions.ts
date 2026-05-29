'use server'

import { signIn } from '@/lib/auth'
import { AuthError } from 'next-auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { canAccess, EMPLOYEE_HOME, type Role } from '@/lib/access'

export async function loginAction(input: {
  email: string
  senha: string
  callbackUrl?: string
}): Promise<{ error?: string } | void> {
  let target = input.callbackUrl && input.callbackUrl.startsWith('/') ? input.callbackUrl : '/dashboard'
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

  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase().trim() },
    select: { role: true },
  })
  const role = user?.role as Role | undefined
  const targetPath = target.split('?')[0] || '/'
  if (role === 'EMPLOYEE' && !canAccess(role, targetPath)) {
    target = EMPLOYEE_HOME
  }

  redirect(target)
}

export async function logoutAction() {
  const { signOut } = await import('@/lib/auth')
  await signOut({ redirectTo: '/login' })
}
