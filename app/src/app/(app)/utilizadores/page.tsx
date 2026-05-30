import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/current-user'
import { UsersClient } from './UsersClient'

export const dynamic = 'force-dynamic'

export type UserRow = {
  id: string
  nome: string
  email: string
  role: 'OWNER' | 'EMPLOYEE'
  active: boolean
  photoUrl: string | null
  lastLoginAt: string | null
  createdAt: string
  transactionCount: number
}

export default async function UtilizadoresPage() {
  const me = await getCurrentUser()
  if (me.role !== 'OWNER') redirect('/dashboard')

  const users = await prisma.user.findMany({
    orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
    include: { _count: { select: { transactions: true } } },
  })

  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    role: u.role,
    active: u.active,
    photoUrl: u.photoStoragePath ? `/api/users/${u.id}/photo` : null,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    transactionCount: u._count.transactions,
  }))

  return <UsersClient users={rows} currentUserId={me.id} />
}
