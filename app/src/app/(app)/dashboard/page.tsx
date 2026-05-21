import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatEUR, formatDateTime } from '@/lib/format'
import { getCurrentUser } from '@/lib/current-user'
import { DynamicIcon } from '@/components/DynamicIcon'
import { Gauge, Sparkline, Donut } from '@/components/Charts'
import { colorGradient, colorHex, colorIconBg } from '@/lib/colors'
import { ArrowRight, Plus, Paperclip, ArrowRightLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScheduledBlock, type ScheduledItem } from './ScheduledBlock'

export const dynamic = 'force-dynamic'

const DAYS_IN_SERIES = 30

export default async function DashboardPage() {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const seriesStart = new Date(today)
  seriesStart.setDate(seriesStart.getDate() - (DAYS_IN_SERIES - 1))

  const user = await getCurrentUser()
  const primeiroNome = user.nome.split(' ')[0]

  const in7Days = new Date(today)
  in7Days.setDate(in7Days.getDate() + 7)

  const [accounts, monthAgg, lastMonthAgg, recentTxs, expensesByCategory, totalAgg, incomingTransfers, allTxs, scheduledTxs] =
    await Promise.all([
      prisma.account.findMany({ where: { archived: false }, orderBy: { createdAt: 'asc' } }),
      prisma.transaction.groupBy({
        by: ['tipo'],
        where: { agendado: false, data: { gte: startOfMonth }, tipo: { in: ['ENTRADA', 'SAIDA'] } },
        _sum: { valor: true },
      }),
      prisma.transaction.groupBy({
        by: ['tipo'],
        where: { agendado: false, data: { gte: startOfLastMonth, lt: startOfMonth }, tipo: { in: ['ENTRADA', 'SAIDA'] } },
        _sum: { valor: true },
      }),
      prisma.transaction.findMany({
        where: { agendado: false },
        orderBy: { data: 'desc' },
        take: 8,
        include: {
          account: { select: { nome: true } },
          category: { select: { nome: true, cor: true, icone: true } },
          toAccount: { select: { nome: true } },
          user: { select: { nome: true } },
          _count: { select: { attachments: true } },
        },
      }),
      prisma.transaction.groupBy({
        by: ['categoryId'],
        where: { agendado: false, tipo: 'SAIDA', data: { gte: startOfMonth }, categoryId: { not: null } },
        _sum: { valor: true },
        orderBy: { _sum: { valor: 'desc' } },
        take: 5,
      }),
      prisma.transaction.groupBy({
        by: ['tipo', 'accountId'],
        where: { agendado: false },
        _sum: { valor: true },
      }),
      prisma.transaction.groupBy({
        by: ['toAccountId'],
        where: { tipo: 'TRANSFERENCIA', agendado: false, toAccountId: { not: null } },
        _sum: { valor: true },
      }),
      prisma.transaction.findMany({
        where: { agendado: false, tipo: { in: ['ENTRADA', 'SAIDA'] } },
        orderBy: { data: 'asc' },
        select: { tipo: true, valor: true, data: true },
      }),
      prisma.transaction.findMany({
        where: { agendado: true, tipo: { in: ['ENTRADA', 'SAIDA'] }, categoryId: { not: null } },
        orderBy: { dataAgendada: 'asc' },
        include: {
          account: { select: { nome: true } },
          category: { select: { nome: true, cor: true, icone: true } },
          workOrder: { select: { id: true, numero: true } },
        },
      }),
    ])

  // Saldo por conta (inclui transferências in/out)
  const balancesByAccount = new Map<string, number>()
  for (const acc of accounts) {
    const entradas = Number(
      totalAgg.find((g) => g.accountId === acc.id && g.tipo === 'ENTRADA')?._sum.valor ?? 0
    )
    const saidas = Number(
      totalAgg.find((g) => g.accountId === acc.id && g.tipo === 'SAIDA')?._sum.valor ?? 0
    )
    const transfersOut = Number(
      totalAgg.find((g) => g.accountId === acc.id && g.tipo === 'TRANSFERENCIA')?._sum.valor ?? 0
    )
    const transfersIn = Number(
      incomingTransfers.find((g) => g.toAccountId === acc.id)?._sum.valor ?? 0
    )
    balancesByAccount.set(acc.id, Number(acc.saldoInicial) + entradas - saidas - transfersOut + transfersIn)
  }
  const saldoTotal = Array.from(balancesByAccount.values()).reduce((s, v) => s + v, 0)

  const entradasMes = Number(monthAgg.find((g) => g.tipo === 'ENTRADA')?._sum.valor ?? 0)
  const saidasMes = Number(monthAgg.find((g) => g.tipo === 'SAIDA')?._sum.valor ?? 0)
  const resultadoMes = entradasMes - saidasMes

  const entradasMesAnterior = Number(lastMonthAgg.find((g) => g.tipo === 'ENTRADA')?._sum.valor ?? 0)
  const saidasMesAnterior = Number(lastMonthAgg.find((g) => g.tipo === 'SAIDA')?._sum.valor ?? 0)

  // Série de saldo dos últimos 30 dias
  const initialAccountsSaldo = accounts.reduce((s, a) => s + Number(a.saldoInicial), 0)
  let cumulative = initialAccountsSaldo
  let txIdx = 0
  // Adiciona transações anteriores ao início da série
  while (txIdx < allTxs.length && allTxs[txIdx].data < seriesStart) {
    const t = allTxs[txIdx]
    cumulative += t.tipo === 'ENTRADA' ? Number(t.valor) : -Number(t.valor)
    txIdx++
  }
  const series: number[] = []
  for (let i = 0; i < DAYS_IN_SERIES; i++) {
    const dayEnd = new Date(seriesStart)
    dayEnd.setDate(dayEnd.getDate() + i)
    dayEnd.setHours(23, 59, 59, 999)
    while (txIdx < allTxs.length && allTxs[txIdx].data <= dayEnd) {
      const t = allTxs[txIdx]
      cumulative += t.tipo === 'ENTRADA' ? Number(t.valor) : -Number(t.valor)
      txIdx++
    }
    series.push(cumulative)
  }
  const saldoInicioSerie = series[0]
  const variacaoSerie =
    saldoInicioSerie !== 0
      ? ((saldoTotal - saldoInicioSerie) / Math.abs(saldoInicioSerie)) * 100
      : 0

  // Gauges (% normalizadas)
  const gaugeSaldo =
    saldoTotal > 0
      ? Math.min(100, Math.max(0, (saldoTotal / Math.max(saldoTotal + saidasMes, 1)) * 100))
      : 0
  const gaugeEntradas =
    entradasMes === 0 && entradasMesAnterior === 0
      ? 0
      : Math.min(
          100,
          (entradasMes / Math.max(entradasMes, entradasMesAnterior, 1)) * 100
        )
  const gaugeSaidas =
    entradasMes === 0
      ? saidasMes > 0
        ? 100
        : 0
      : Math.min(100, (saidasMes / Math.max(entradasMes, 1)) * 100)

  // Donut de categorias (top 4 + Outros)
  const categoryIds = expensesByCategory
    .map((e) => e.categoryId)
    .filter((id): id is string => Boolean(id))
  const categories = await prisma.category.findMany({ where: { id: { in: categoryIds } } })
  const totalDespesasMes = expensesByCategory.reduce((s, e) => s + Number(e._sum.valor ?? 0), 0)
  const allExpensesAgg = await prisma.transaction.groupBy({
    by: ['categoryId'],
    where: { agendado: false, tipo: 'SAIDA', data: { gte: startOfMonth }, categoryId: { not: null } },
    _sum: { valor: true },
  })
  const totalMesGeral = allExpensesAgg.reduce((s, e) => s + Number(e._sum.valor ?? 0), 0)
  const top4 = expensesByCategory.slice(0, 4).map((e) => {
    const cat = categories.find((c) => c.id === e.categoryId)
    const valor = Number(e._sum.valor ?? 0)
    return {
      id: e.categoryId,
      nome: cat?.nome ?? '?',
      cor: cat?.cor ?? 'zinc',
      valor,
      pct: totalMesGeral > 0 ? (valor / totalMesGeral) * 100 : 0,
    }
  })
  const outrosValor = Math.max(0, totalMesGeral - top4.reduce((s, c) => s + c.valor, 0))

  // Cores visualmente distintas para os segmentos do donut.
  // Ignoramos a `cor` da categoria aqui porque categorias diferentes podem partilhar
  // cores ou usar tons demasiado próximos (ex: sky vs cyan), tornando o gráfico
  // ilegível. A cor da categoria continua presente noutros sítios (cards, badges).
  const DONUT_PALETTE = [
    colorHex.violet,
    colorHex.orange,
    colorHex.emerald,
    colorHex.sky,
    colorHex.rose,
    colorHex.amber,
    colorHex.teal,
    colorHex.pink,
  ]
  const donutColors = top4.map((_c, i) => DONUT_PALETTE[i % DONUT_PALETTE.length])

  const donutSegments = [
    ...top4.map((c, i) => ({ value: c.valor, color: donutColors[i] })),
    ...(outrosValor > 0 ? [{ value: outrosValor, color: colorHex.zinc }] : []),
  ]
  const legenda = [
    ...top4.map((c, i) => ({
      nome: c.nome,
      cor: donutColors[i],
      pct: totalMesGeral > 0 ? (c.valor / totalMesGeral) * 100 : 0,
    })),
    ...(outrosValor > 0
      ? [{ nome: 'Outros', cor: colorHex.zinc, pct: (outrosValor / totalMesGeral) * 100 }]
      : []),
  ]

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Olá, {primeiroNome} 👋</h1>
        <p className="text-zinc-500 text-sm">
          Resumo das tuas finanças em {now.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}.
        </p>
      </div>

      {/* Contas */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">Contas</h2>
          <Link href="/caixas" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
            Gerir →
          </Link>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          {accounts.length === 0 ? (
            <Link
              href="/caixas?new=1"
              className="flex-shrink-0 w-56 border-2 border-dashed border-zinc-300 rounded-2xl p-4 text-zinc-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/50 transition flex items-center justify-center gap-2 font-medium text-sm min-h-[100px]"
            >
              <Plus className="w-4 h-4" /> Criar primeira conta
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
                  <div className="text-xl font-bold">{formatEUR(balancesByAccount.get(acc.id) ?? 0)}</div>
                </Link>
              ))}
              <Link
                href="/caixas?new=1"
                className="flex-shrink-0 w-56 border-2 border-dashed border-zinc-300 rounded-2xl p-4 text-zinc-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/50 transition flex items-center justify-center gap-2 font-medium text-sm"
              >
                <Plus className="w-4 h-4" /> Adicionar conta
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Pagamentos agendados */}
      <ScheduledBlock
        items={scheduledTxs.map<ScheduledItem>((t) => ({
          id: t.id,
          tipo: t.tipo as 'ENTRADA' | 'SAIDA',
          valor: Number(t.valor),
          descricao: t.descricao,
          dataAgendada: (t.dataAgendada ?? t.data).toISOString(),
          account: t.account,
          category: t.category!,
          workOrder: t.workOrder
            ? { id: t.workOrder.id, numero: t.workOrder.numero }
            : null,
        }))}
      />

      {/* Linha de widgets: gauges + sparkline + fluxo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-zinc-900">Resumo do mês</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="flex justify-center"><Gauge value={gaugeSaldo} color="#10b981" /></div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wide mt-1 font-medium">Saldo</div>
              <div className="text-sm font-bold text-zinc-900">{formatEUR(saldoTotal)}</div>
            </div>
            <div>
              <div className="flex justify-center"><Gauge value={gaugeEntradas} color="#10b981" /></div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wide mt-1 font-medium">Entradas</div>
              <div className="text-sm font-bold text-emerald-600">{formatEUR(entradasMes)}</div>
            </div>
            <div>
              <div className="flex justify-center"><Gauge value={gaugeSaidas} color="#ef4444" /></div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wide mt-1 font-medium">Saídas</div>
              <div className="text-sm font-bold text-red-500">{formatEUR(saidasMes)}</div>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-zinc-900">Evolução do saldo</h3>
            {variacaoSerie !== 0 && (
              <span
                className={cn(
                  'text-xs px-2 py-0.5 rounded-full font-semibold',
                  variacaoSerie >= 0
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-red-50 text-red-600'
                )}
              >
                {variacaoSerie >= 0 ? '+' : ''}
                {variacaoSerie.toFixed(0)}%
              </span>
            )}
          </div>
          <div className="text-2xl font-bold text-zinc-900 mb-0.5">{formatEUR(saldoTotal)}</div>
          <div className="text-xs text-zinc-500 mb-3">últimos 30 dias</div>
          <Sparkline data={series} color="#10b981" height={96} />
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-zinc-900">Fluxo do mês</h3>
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-zinc-500">Entradas</span>
                <span className="font-semibold text-emerald-600">+ {formatEUR(entradasMes)}</span>
              </div>
              <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{
                    width: `${entradasMes === 0 && saidasMes === 0 ? 0 : (entradasMes / Math.max(entradasMes, saidasMes, 1)) * 100}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-zinc-500">Saídas</span>
                <span className="font-semibold text-red-500">- {formatEUR(saidasMes)}</span>
              </div>
              <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full"
                  style={{
                    width: `${entradasMes === 0 && saidasMes === 0 ? 0 : (saidasMes / Math.max(entradasMes, saidasMes, 1)) * 100}%`,
                  }}
                />
              </div>
            </div>
            <div className="pt-3 border-t border-zinc-100">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Resultado líquido</span>
                <span
                  className={cn(
                    'text-lg font-bold',
                    resultadoMes >= 0 ? 'text-zinc-900' : 'text-red-500'
                  )}
                >
                  {formatEUR(resultadoMes)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Linha inferior: donut + últimos movimentos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-zinc-900">Despesas por categoria</h3>
            <Link
              href="/lancamentos?tipo=SAIDA"
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Ver →
            </Link>
          </div>
          {donutSegments.length === 0 ? (
            <div className="text-center text-sm text-zinc-400 py-8">Sem despesas este mês.</div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <Donut segments={donutSegments} size={128} />
              </div>
              <div className="flex-1 space-y-2 text-sm">
                {legenda.map((l) => (
                  <div key={l.nome} className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: l.cor }}
                    />
                    <span className="truncate flex-1 min-w-0" title={l.nome}>{l.nome}</span>
                    <span className="font-semibold text-zinc-700 flex-shrink-0 ml-2">
                      {l.pct.toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-zinc-900">Últimos movimentos</h3>
            <Link
              href="/lancamentos"
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium inline-flex items-center gap-1"
            >
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {recentTxs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-zinc-500 mb-3">Sem movimentos ainda.</p>
              <Link href="/lancamentos?new=despesa" className="btn-primary inline-flex">
                <Plus className="w-4 h-4" /> Primeira despesa
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {recentTxs.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 py-2.5">
                  {tx.tipo === 'TRANSFERENCIA' ? (
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-zinc-100">
                      <ArrowRightLeft className="w-4 h-4 text-zinc-500" />
                    </div>
                  ) : (
                    <div
                      className={cn(
                        'w-9 h-9 rounded-lg flex items-center justify-center',
                        colorIconBg[tx.category?.cor ?? 'zinc'] || colorIconBg.zinc
                      )}
                    >
                      <DynamicIcon name={tx.category?.icone ?? 'circle'} className="w-4 h-4" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-zinc-900 truncate flex items-center gap-1">
                      {tx.descricao}
                      {tx._count.attachments > 0 && <Paperclip className="w-3 h-3 text-zinc-400" />}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {tx.tipo === 'TRANSFERENCIA'
                        ? `${tx.account.nome} -> ${tx.toAccount?.nome ?? '?'}`
                        : `${tx.category?.nome ?? 'Sem categoria'} · ${tx.account.nome}`} · {formatDateTime(tx.data)}
                    </div>
                  </div>
                  <div className="text-sm font-bold whitespace-nowrap">
                    {tx.tipo === 'TRANSFERENCIA' ? (
                      <span className="text-zinc-400">{formatEUR(Number(tx.valor))}</span>
                    ) : tx.tipo === 'ENTRADA' ? (
                      <span className="text-emerald-600">+ {formatEUR(Number(tx.valor))}</span>
                    ) : (
                      <span className="text-red-500">- {formatEUR(Number(tx.valor))}</span>
                    )}
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
