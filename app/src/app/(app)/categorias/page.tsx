import { prisma } from '@/lib/prisma'
import { CategoriesClient } from './CategoriesClient'

export const dynamic = 'force-dynamic'

export type CategoryWithStats = {
  id: string
  nome: string
  tipo: 'ENTRADA' | 'SAIDA'
  cor: string
  icone: string
  parentId: string | null
  count: number
  total: number
}

export default async function CategoriasPage() {
  const cats = await prisma.category.findMany({
    where: { archived: false, tipo: { in: ['ENTRADA', 'SAIDA'] } },
    orderBy: { nome: 'asc' },
    include: {
      _count: { select: { transactions: true } },
      transactions: { select: { valor: true } },
    },
  })

  const data: CategoryWithStats[] = cats.map((c) => ({
    id: c.id,
    nome: c.nome,
    tipo: c.tipo as 'ENTRADA' | 'SAIDA',
    cor: c.cor,
    icone: c.icone,
    parentId: c.parentId,
    count: c._count.transactions,
    total: c.transactions.reduce((s, t) => s + Number(t.valor), 0),
  }))

  return <CategoriesClient categories={data} />
}
