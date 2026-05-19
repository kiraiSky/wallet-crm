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
  workOrderId: string | null
  customerId: string | null
  account: { nome: string; cor: string }
  category: { nome: string; cor: string; icone: string }
  user: { nome: string }
  workOrder: { numero: number; customer: { nome: string } } | null
  hasAttachment: boolean
}

export type WorkOrderOption = {
  id: string
  numero: number
  customerNome: string
  problema: string
  customerId: string
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

  const [transactions, accounts, categories, agg, workOrders] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { data: 'desc' },
      take: 100,
      include: {
        account: { select: { nome: true, cor: true } },
        category: { select: { nome: true, cor: true, icone: true } },
        user: { select: { nome: true } },
        workOrder: { select: { numero: true, customer: { select: { nome: true } } } },
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

  const rows: TransactionRow[] = transactions.map((t) => ({
    id: t.id,
    tipo: t.tipo,
    valor: Number(t.valor),
    descricao: t.descricao,
    data: t.data.toISOString(),
    observacao: t.observacao,
    accountId: t.accountId,
    categoryId: t.categoryId,
    workOrderId: t.workOrderId,
    customerId: t.customerId,
    account: t.account,
    category: t.category,
    user: t.user,
    workOrder: t.workOrder,
    hasAttachment: t._count.attachments > 0,
  }))

  const workOrderOptions: WorkOrderOption[] = workOrders.map((wo) => ({
    id: wo.id,
    numero: wo.numero,
    customerNome: wo.customer.nome,
    problema: wo.problema,
    customerId: wo.customerId,
  }))

  const totalEntradas = Number(agg.find((a) => a.tipo === 'ENTRADA')?._sum.valor ?? 0)
  const totalSaidas = Number(agg.find((a) => a.tipo === 'SAIDA')?._sum.valor ?? 0)
  const count = agg.reduce((s, a) => s + a._count, 0)

  return (
    <TransactionsClient
      transactions={rows}
      accounts={accounts}
      categories={categories}
      workOrderOptions={workOrderOptions}
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
