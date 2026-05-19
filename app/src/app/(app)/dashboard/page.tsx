import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatBRL, formatDateTime } from '@/lib/format'
import { DynamicIcon } from '@/components/DynamicIcon'
import { colorIconBg, colorGradient, colorBgSolid } from '@/lib/colors'
import { TrendingDown, TrendingUp, ArrowRight, Wallet, Plus, Paperclip } from 'lucide-react'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const [accounts, monthAgg, lastMonthAgg, recentTxs, expensesByCategory, totalAgg] = await Promise.all([
    prisma.account.findMany({ where: { archived: false }, orderBy: { createdAt: 'asc' } }),
    prisma.transaction.groupBy({
      by: ['tipo'],
      where: { data: { gte: startOfMonth } },
      _sum: { valor: true },
    }),
    prisma.transaction.groupBy({
      by: ['tipo'],
      where: { data: { gte: startOfLastMonth, lt: startOfMonth } },
      _sum: { valor: true },
    }),
    prisma.transaction.findMany({
      orderBy: { data: 'desc' },
      take: 8,
      include: {
        account: { select: { nome: true } },
        category: { select: { nome: true, cor: true, icone: true } },
        user: { select: { nome: true } },
        _count: { select: { attachments: true } },
      },
    }),
    prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { tipo: 'SAIDA', data: { gte: startOfMonth } },
      _sum: { valor: true },
      orderBy: { _sum: { valor: 'desc' } },
      take: 5,
    }),
    prisma.transaction.groupBy({ by: ['tipo', 'accountId'], _sum: { valor: true } }),
  ])

  // Saldo por caixa
  const balancesByAccount = new Map<string, number>()
  for (const acc of accounts) {
    const entradas = Number(
      totalAgg.find((g) => g.accountId === acc.id && g.tipo === 'ENTRADA')?._sum.valor ?? 0
    )
    const saidas = Number(
      totalAgg.find((g) => g.accountId === acc.id && g.tipo === 'SAIDA')?._sum.valor ?? 0
    )
    balancesByAccount.set(acc.id, Number(acc.saldoInicial) + entradas - saidas)
  }
  const saldoTotal = Array.from(balancesByAccount.values()).reduce((s, v) => s + v, 0)

  const entradasMes = Number(monthAgg.find((g) => g.tipo === 'ENTRADA')?._sum.valor ?? 0)
  const saidasMes = Number(monthAgg.find((g) => g.tipo === 'SAIDA')?._sum.valor ?? 0)
  const resultadoMes = entradasMes - saidasMes

  const saidasMesAnterior = Number(lastMonthAgg.find((g) => g.tipo === 'SAIDA')?._sum.valor ?? 0)
  const varDespesa =
    saidasMesAnterior > 0 ? ((saidasMes - saidasMesAnterior) / saidasMesAnterior) * 100 : 0

  // Top categorias de despesa
  const categoryIds = expensesByCategory.map((e) => e.categoryId)
  const categories = await prisma.category.findMany({ where: { id: { in: categoryIds } } })
  const totalDespesasMes = expensesByCategory.reduce((s, e) => s + Number(e._sum.valor ?? 0), 0)
  const topCats = expensesByCategory.map((e) => {
    const cat = categories.find((c) => c.id === e.categoryId)
    const valor = Number(e._sum.valor ?? 0)
    return {
      id: e.categoryId,
      nome: cat?.nome ?? '?',
      cor: cat?.cor ?? 'zinc',
      icone: cat?.icone ?? 'package',
      valor,
      pct: totalDespesasMes > 0 ? (valor / totalDespesasMes) * 100 : 0,
    }
  })

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Olá, João 👋</h1>
        <p className="text-zinc-500 text-sm">
          Resumo do caixa da oficina em {now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}.
        </p>
      </div>

      {/* Caixas */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">Caixas</h2>
          <Link href="/caixas" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
            Gerenciar →
          </Link>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          {accounts.length === 0 ? (
            <Link
              href="/caixas?new=1"
              className="flex-shrink-0 w-56 border-2 border-dashed border-zinc-300 rounded-2xl p-4 text-zinc-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/50 transition flex items-center justify-center gap-2 font-medium text-sm min-h-[100px]"
            >
              <Plus className="w-4 h-4" /> Criar primeiro caixa
            </Link>
          ) : (
            <>
              {accounts.map((acc) => (
                <Link
                  key={acc.id}
                  href="/caixas"
                  className={cn(
                    'flex-shrink-0 w-56 bg-gradient-to-br rounded-2xl p-4 text-white shadow-lg transition hover:scale-[1.02]',
                    colorGradient[acc.cor] || colorGradient.emerald
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                      <DynamicIcon name={acc.icone} className="w-4 h-4" />
                    </div>
                    <span className="text-xs text-white/70">
                      {acc.tipo.charAt(0) + acc.tipo.slice(1).toLowerCase()}
                    </span>
                  </div>
                  <div className="text-xs text-white/80 mb-0.5">{acc.nome}</div>
                  <div className="text-xl font-bold">{formatBRL(balancesByAccount.get(acc.id) ?? 0)}</div>
                </Link>
              ))}
              <Link
                href="/caixas?new=1"
                className="flex-shrink-0 w-56 border-2 border-dashed border-zinc-300 rounded-2xl p-4 text-zinc-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/50 transition flex items-center justify-center gap-2 font-medium text-sm"
              >
                <Plus className="w-4 h-4" /> Adicionar caixa
              </Link>
            </>
          )}
        </div>
      </div>

      {/* KPIs do mês */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="card p-4">
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1.5">
            <Wallet className="w-3.5 h-3.5 text-zinc-500" /> Saldo total
          </div>
          <div className="text-lg font-bold text-zinc-900">{formatBRL(saldoTotal)}</div>
          <div className="text-xs text-zinc-500 mt-0.5">{accounts.length} caixas</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Entradas (mês)
          </div>
          <div className="text-lg font-bold text-emerald-600">{formatBRL(entradasMes)}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1.5">
            <TrendingDown className="w-3.5 h-3.5 text-red-500" /> Despesas (mês)
          </div>
          <div className="text-lg font-bold text-red-500">{formatBRL(saidasMes)}</div>
          {saidasMesAnterior > 0 && (
            <div
              className={cn(
                'text-xs mt-0.5',
                varDespesa > 0 ? 'text-red-600' : 'text-emerald-600'
              )}
            >
              {varDespesa > 0 ? '↑' : '↓'} {Math.abs(varDespesa).toFixed(0)}% vs mês anterior
            </div>
          )}
        </div>
        <div className="card p-4">
          <div className="text-xs text-zinc-500 mb-1.5">Resultado (mês)</div>
          <div
            className={cn(
              'text-lg font-bold',
              resultadoMes >= 0 ? 'text-zinc-900' : 'text-red-500'
            )}
          >
            {formatBRL(resultadoMes)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top despesas */}
        <div className="card p-5 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-zinc-900">Top despesas do mês</h3>
            <Link
              href="/lancamentos?tipo=SAIDA"
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Ver →
            </Link>
          </div>
          {topCats.length === 0 ? (
            <div className="text-center text-sm text-zinc-400 py-8">Nenhuma despesa este mês.</div>
          ) : (
            <div className="space-y-3">
              {topCats.map((c) => (
                <div key={c.id}>
                  <div className="flex justify-between text-sm mb-1 items-center">
                    <span className="flex items-center gap-2 min-w-0">
                      <div
                        className={cn(
                          'w-6 h-6 rounded flex items-center justify-center flex-shrink-0',
                          colorIconBg[c.cor] || colorIconBg.violet
                        )}
                      >
                        <DynamicIcon name={c.icone} className="w-3 h-3" />
                      </div>
                      <span className="text-zinc-700 font-medium truncate">{c.nome}</span>
                    </span>
                    <span className="font-semibold text-zinc-900 text-xs whitespace-nowrap ml-2">
                      {formatBRL(c.valor)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', colorBgSolid[c.cor])}
                      style={{ width: `${c.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Últimos lançamentos */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-zinc-900">Últimos lançamentos</h3>
            <Link
              href="/lancamentos"
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium inline-flex items-center gap-1"
            >
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {recentTxs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-zinc-500 mb-3">Nenhum lançamento ainda.</p>
              <Link href="/lancamentos?new=despesa" className="btn-primary inline-flex">
                <Plus className="w-4 h-4" /> Primeira despesa
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {recentTxs.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 py-2.5">
                  <div
                    className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center',
                      colorIconBg[tx.category.cor] || colorIconBg.violet
                    )}
                  >
                    <DynamicIcon name={tx.category.icone} className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-zinc-900 truncate flex items-center gap-1">
                      {tx.descricao}
                      {tx._count.attachments > 0 && <Paperclip className="w-3 h-3 text-zinc-400" />}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {tx.category.nome} · {tx.account.nome} · {formatDateTime(tx.data)}
                    </div>
                  </div>
                  <div
                    className={cn(
                      'text-sm font-bold whitespace-nowrap',
                      tx.tipo === 'ENTRADA' ? 'text-emerald-600' : 'text-red-500'
                    )}
                  >
                    {tx.tipo === 'ENTRADA' ? '+ ' : '- '}
                    {formatBRL(Number(tx.valor))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
