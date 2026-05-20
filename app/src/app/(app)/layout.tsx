import { TopNav } from './_components/TopNav'
import { MobileBottomNav } from './_components/MobileBottomNav'
import { GlobalNewTxModal } from './_components/GlobalNewTxModal'
import { CustomerQuickModal } from './_components/CustomerQuickModal'
import { getCurrentUser } from '@/lib/current-user'
import { prisma } from '@/lib/prisma'

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  const [accounts, categories, workOrders] = await Promise.all([
    prisma.account.findMany({
      where: { archived: false },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, cor: true, icone: true },
    }),
    prisma.category.findMany({
      where: { archived: false },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, cor: true, icone: true, tipo: true, parentId: true },
    }),
    prisma.workOrder.findMany({
      where: { estado: { notIn: ['CANCELADA'] } },
      orderBy: { numero: 'desc' },
      take: 200,
      select: {
        id: true,
        numero: true,
        problema: true,
        customerId: true,
        customer: { select: { nome: true } },
      },
    }),
  ])

  const workOrderOptions = workOrders.map((wo) => ({
    id: wo.id,
    numero: wo.numero,
    customerNome: wo.customer.nome,
    problema: wo.problema,
    customerId: wo.customerId,
  }))

  return (
    <>
      <TopNav
        userName={user.nome}
        userInitials={initialsOf(user.nome)}
        userRole={user.role}
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-6">
        {children}
      </main>
      <MobileBottomNav isOwner={user.role === 'OWNER'} />
      <GlobalNewTxModal
        accounts={accounts}
        categories={categories}
        workOrderOptions={workOrderOptions}
      />
      <CustomerQuickModal />
    </>
  )
}
