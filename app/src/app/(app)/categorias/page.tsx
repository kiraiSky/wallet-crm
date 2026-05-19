import { prisma } from '@/lib/prisma'
import { CategoriesClient } from './CategoriesClient'

export const dynamic = 'force-dynamic'

export type CategoryWithStats = {
  id: string
  nome: string
  tipo: 'ENTRADA' | 'SAIDA'
  cor: string
  icone: string
  count: number
  total: number
}

export default async function CategoriasPage() {
  const cats = await prisma.category.findMany({
    where: { archived: false },
    orderBy: { nome: 'asc' },
    include: {
      _count: { select: { transactions: true } },
      transactions: { select: { valor: true } },
    },
  })

  const data: CategoryWithStats[] = cats.map((c) => ({
    id: c.id,
    nome: c.nome,
    tipo: c.tipo,
    cor: c.cor,
    icone: c.icone,
    count: c._count.transactions,
    total: c.transactions.reduce((s, t) => s + Number(t.valor), 0),
  }))

  return <CategoriesClient categories={data} />
}
