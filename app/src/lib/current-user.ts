import { redirect } from 'next/navigation'
import { auth } from './auth'
import { prisma } from './prisma'

// Devolve o utilizador da sessão. Se não houver sessão, redireciona para /login.
export async function getCurrentUser() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user || !user.active) redirect('/login')
  return user
}

export async function requireOwner() {
  const user = await getCurrentUser()
  if (user.role !== 'OWNER') {
    throw new Error('Apenas o OWNER pode executar esta ação.')
  }
  return user
}
