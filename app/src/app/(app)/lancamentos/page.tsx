import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { TransactionsClient } from './TransactionsClient'

export const dynamic = 'force-dynamic'

type SearchParams = Record<string, string | undefined>

export type TransactionRow = {
  id: string
  tipo: 'ENTRADA' | 'SAIDA'
  valor: number
  descricao: string
  data: string // ISO
  observacao: string | null
  accountId: string
  categoryId: string
  account: { nome: string; cor: string }
  category: { nome: string; cor: string; icone: string }
  user: { nome: string }
  hasAttachment: boolean
}

export default async function LancamentosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const tipoFilter: 'ENTRADA' | 'SAIDA' | undefined =
    params.tipo === 'ENTRADA' ? 'ENTRADA' : params.tipo === 'SAIDA' ? 'SAIDA' : undefined
  const accountFilter = params.account || undefined
  const categoryFilter = params.category || undefined
  const search = params.q?.trim() || undefined
  const openNew = params.new // "despesa" | "receita" | undefined

  const where: Prisma.TransactionWhereInput = {
    ...(tipoFilter && { tipo: tipoFilter }),
    ...(accountFilter && { accountId: accountFilter }),
    ...(categoryFilter && { categoryId: categoryFilter }),
    ...(search && {
      OR: [
        { descricao: { contains: search, mode: 'insensitive' } },
        { observacao: { contains: search, mode: 'insensitive' } },
      ],
    }),
  }

  const [transactions, accounts, categories, agg] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { data: 'desc' },
      take: 100,
      include: {
        account: { select: { nome: true, cor: true } },
        category: { select: { nome: true, cor: true, icone: true } },
        user: { select: { nome: true } },
        _count: { select: { attachments: true } },
      },
    }),
    prisma.account.findMany({
      where: { archived: false },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, cor: true, icone: true, tipo: true },
    }),
    prisma.category.findMany({
      where: { archived: false },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, cor: true, icone: true, tipo: true },
    }),
    prisma.transaction.groupBy({
      by: ['tipo'],
      where,
      _sum: { valor: true },
      _count: true,
    }),
  ])

  const rows: TransactionRow[] = transactions.map((t) => ({
    id: t.id,
    tipo: t.tipo,
    valor: Number(t.valor),
    descricao: t.descricao,
    data: t.data.toISOString(),
    observacao: t.observacao,
    accountId: t.accountId,
    categoryId: t.categoryId,
    account: t.account,
    category: t.category,
    user: t.user,
    hasAttachment: t._count.attachments > 0,
  }))

  const totalEntradas = Number(agg.find((a) => a.tipo === 'ENTRADA')?._sum.valor ?? 0)
  const totalSaidas = Number(agg.find((a) => a.tipo === 'SAIDA')?._sum.valor ?? 0)
  const count = agg.reduce((s, a) => s + a._count, 0)

  return (
    <TransactionsClient
      transactions={rows}
      accounts={accounts}
      categories={categories}
      filters={{
        tipo: tipoFilter,
        accountId: accountFilter,
        categoryId: categoryFilter,
        search,
      }}
      kpis={{ totalEntradas, totalSaidas, count }}
      openNew={openNew === 'despesa' ? 'SAIDA' : openNew === 'receita' ? 'ENTRADA' : null}
    />
  )
}
