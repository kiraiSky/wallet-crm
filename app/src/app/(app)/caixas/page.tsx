import { prisma } from '@/lib/prisma'
import { AccountsClient } from './AccountsClient'

export const dynamic = 'force-dynamic'

export type AccountWithBalance = {
  id: string
  nome: string
  tipo: 'DINHEIRO' | 'BANCO' | 'CARTAO'
  saldoInicial: number
  saldoAtual: number
  entradasMes: number
  saidasMes: number
  cor: string
  icone: string
  totalTransacoes: number
}

export default async function CaixasPage() {
  const accounts = await prisma.account.findMany({
    where: { archived: false },
    orderBy: { createdAt: 'asc' },
    include: {
      _count: { select: { transactions: true } },
    },
  })

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const accountsWithBalance: AccountWithBalance[] = await Promise.all(
    accounts.map(async (acc) => {
      const [agg, monthAgg] = await Promise.all([
        prisma.transaction.groupBy({
          by: ['tipo'],
          where: { accountId: acc.id },
          _sum: { valor: true },
        }),
        prisma.transaction.groupBy({
          by: ['tipo'],
          where: { accountId: acc.id, data: { gte: startOfMonth } },
          _sum: { valor: true },
        }),
      ])

      const entradas = Number(agg.find((g) => g.tipo === 'ENTRADA')?._sum.valor ?? 0)
      const saidas = Number(agg.find((g) => g.tipo === 'SAIDA')?._sum.valor ?? 0)
      const entradasMes = Number(monthAgg.find((g) => g.tipo === 'ENTRADA')?._sum.valor ?? 0)
      const saidasMes = Number(monthAgg.find((g) => g.tipo === 'SAIDA')?._sum.valor ?? 0)

      return {
        id: acc.id,
        nome: acc.nome,
        tipo: acc.tipo,
        saldoInicial: Number(acc.saldoInicial),
        saldoAtual: Number(acc.saldoInicial) + entradas - saidas,
        entradasMes,
        saidasMes,
        cor: acc.cor,
        icone: acc.icone,
        totalTransacoes: acc._count.transactions,
      }
    })
  )

  const totalConsolidado = accountsWithBalance.reduce((s, a) => s + a.saldoAtual, 0)

  return (
    <AccountsClient accounts={accountsWithBalance} totalConsolidado={totalConsolidado} />
  )
}
