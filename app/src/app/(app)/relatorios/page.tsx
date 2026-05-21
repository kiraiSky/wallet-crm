import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { resolvePeriod } from '@/lib/report-period'
import { formatEUR, formatDate } from '@/lib/format'
import { Donut, Sparkline } from '@/components/Charts'
import { colorHex } from '@/lib/colors'
import { PeriodFilter } from './_components/PeriodFilter'
import { PrintButton } from './_components/PrintButton'
import { STATUS_META, type WorkOrderStatus } from '../folhas/status'
import { Download, TrendingUp, TrendingDown, Wallet, ClipboardList, Users as UsersIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

type SearchParams = Record<string, string | undefined>

const FOLHA_STATUSES: WorkOrderStatus[] = [
  'ABERTA',
  'EM_DIAGNOSTICO',
  'AGUARDA_PECAS',
  'EM_REPARACAO',
  'CONCLUIDA',
  'FATURADA',
  'CANCELADA',
]

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const period = resolvePeriod({
    preset: params.p,
    from: params.from,
    to: params.to,
  })

  const [
    aggByTipo,
    expensesByCategory,
    incomeByCategory,
    txByDay,
    topCustomers,
    woAggByEstado,
    txCount,
    folhasFaturadas,
  ] = await Promise.all([
    prisma.transaction.groupBy({
      by: ['tipo'],
      where: { data: { gte: period.start, lt: period.end }, tipo: { in: ['ENTRADA', 'SAIDA'] } },
      _sum: { valor: true },
      _count: true,
    }),
    prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { tipo: 'SAIDA', data: { gte: period.start, lt: period.end }, categoryId: { not: null } },
      _sum: { valor: true },
      orderBy: { _sum: { valor: 'desc' } },
    }),
    prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { tipo: 'ENTRADA', data: { gte: period.start, lt: period.end }, categoryId: { not: null } },
      _sum: { valor: true },
      orderBy: { _sum: { valor: 'desc' } },
    }),
    prisma.transaction.findMany({
      where: { data: { gte: period.start, lt: period.end }, tipo: { in: ['ENTRADA', 'SAIDA'] } },
      select: { data: true, valor: true, tipo: true },
    }),
    prisma.transaction.groupBy({
      by: ['customerId'],
      where: {
        tipo: 'ENTRADA',
        data: { gte: period.start, lt: period.end },
        customerId: { not: null },
      },
      _sum: { valor: true },
      orderBy: { _sum: { valor: 'desc' } },
      take: 8,
    }),
    prisma.workOrder.groupBy({
      by: ['estado'],
      where: { dataAbertura: { gte: period.start, lt: period.end } },
      _count: true,
      _sum: { total: true },
    }),
    prisma.transaction.count({ where: { data: { gte: period.start, lt: period.end } } }),
    prisma.workOrder.aggregate({
      where: {
        estado: 'FATURADA',
        dataConclusao: { gte: period.start, lt: period.end },
      },
      _sum: { total: true },
      _count: true,
      _avg: { total: true },
    }),
  ])

  const entradas = Number(aggByTipo.find((g) => g.tipo === 'ENTRADA')?._sum.valor ?? 0)
  const saidas = Number(aggByTipo.find((g) => g.tipo === 'SAIDA')?._sum.valor ?? 0)
  const resultado = entradas - saidas
  const margem = entradas > 0 ? (resultado / entradas) * 100 : 0

  // Buscar dados de categorias e clientes para enriquecer
  const categoryIds = [
    ...expensesByCategory.map((e) => e.categoryId),
    ...incomeByCategory.map((e) => e.categoryId),
  ].filter((id): id is string => Boolean(id))
  const categories = await prisma.category.findMany({ where: { id: { in: categoryIds } } })
  const customerIds = topCustomers.map((c) => c.customerId).filter(Boolean) as string[]
  const customers = await prisma.customer.findMany({ where: { id: { in: customerIds } } })

  const totalDespesas = expensesByCategory.reduce((s, e) => s + Number(e._sum.valor ?? 0), 0)
  const top4Despesas = expensesByCategory.slice(0, 4).map((e) => {
    const cat = categories.find((c) => c.id === e.categoryId)
    return {
      id: e.categoryId,
      nome: cat?.nome ?? '?',
      cor: cat?.cor ?? 'zinc',
      valor: Number(e._sum.valor ?? 0),
    }
  })
  const outrosDespesas = Math.max(0, totalDespesas - top4Despesas.reduce((s, c) => s + c.valor, 0))
  const donutDespesas = [
    ...top4Despesas.map((c) => ({ value: c.valor, color: colorHex[c.cor] ?? colorHex.zinc })),
    ...(outrosDespesas > 0 ? [{ value: outrosDespesas, color: colorHex.zinc }] : []),
  ]
  const legendaDespesas = [
    ...top4Despesas.map((c) => ({
      nome: c.nome,
      cor: colorHex[c.cor] ?? colorHex.zinc,
      valor: c.valor,
      pct: totalDespesas > 0 ? (c.valor / totalDespesas) * 100 : 0,
    })),
    ...(outrosDespesas > 0
      ? [
          {
            nome: 'Outros',
            cor: colorHex.zinc,
            valor: outrosDespesas,
            pct: totalDespesas > 0 ? (outrosDespesas / totalDespesas) * 100 : 0,
          },
        ]
      : []),
  ]

  const top4Receitas = incomeByCategory.slice(0, 5).map((e) => {
    const cat = categories.find((c) => c.id === e.categoryId)
    return {
      id: e.categoryId,
      nome: cat?.nome ?? '?',
      cor: cat?.cor ?? 'zinc',
      valor: Number(e._sum.valor ?? 0),
    }
  })
  const totalReceitas = incomeByCategory.reduce((s, e) => s + Number(e._sum.valor ?? 0), 0)

  // Série diária — saldo do dia (entradas - saídas) acumulado
  const days =
    Math.max(1, Math.ceil((period.end.getTime() - period.start.getTime()) / 86400000))
  const dailyResult: number[] = new Array(days).fill(0)
  for (const tx of txByDay) {
    const dayIdx = Math.floor((tx.data.getTime() - period.start.getTime()) / 86400000)
    if (dayIdx < 0 || dayIdx >= days) continue
    dailyResult[dayIdx] += tx.tipo === 'ENTRADA' ? Number(tx.valor) : -Number(tx.valor)
  }
  // Acumulado
  let acc = 0
  const dailyAccum = dailyResult.map((v) => (acc += v))

  // Top clientes
  const topClientesData = topCustomers.map((c) => {
    const cust = customers.find((x) => x.id === c.customerId)
    return {
      id: c.customerId as string,
      nome: cust?.nome ?? 'Cliente removido',
      total: Number(c._sum.valor ?? 0),
    }
  })

  // Folhas: contagem por estado
  const woByEstado = FOLHA_STATUSES.map((s) => {
    const g = woAggByEstado.find((x) => x.estado === s)
    return {
      estado: s,
      count: g?._count ?? 0,
      total: Number(g?._sum.total ?? 0),
    }
  })
  const woMaxCount = Math.max(...woByEstado.map((x) => x.count), 1)
  const woTotal = woByEstado.reduce((s, x) => s + x.count, 0)

  const exportHref = `/relatorios/export?p=${period.key}${
    period.key === 'custom' ? `&from=${period.fromInput}&to=${period.toInput}` : ''
  }`

  return (
    <>
      <div className="mb-5 print:mb-2">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-zinc-900">Relatórios</h1>
            <p className="text-zinc-500 text-sm">
              Período: <span className="font-semibold text-zinc-700">{period.label}</span>
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 print:hidden">
          <Link href={exportHref} className="btn-secondary justify-center">
            <Download className="w-4 h-4" />
            Excel
          </Link>
          <PrintButton />
        </div>
      </div>

      <PeriodFilter
        current={period.key}
        fromInput={period.fromInput}
        toInput={period.toInput}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Kpi icon={TrendingUp} label="Receitas" value={formatEUR(entradas)} hint={`${incomeByCategory.length} categorias`} tone="emerald" />
        <Kpi icon={TrendingDown} label="Despesas" value={formatEUR(saidas)} hint={`${expensesByCategory.length} categorias`} tone="rose" />
        <Kpi
          icon={Wallet}
          label="Resultado"
          value={formatEUR(resultado)}
          hint={`Margem ${margem.toFixed(0)}%`}
          tone={resultado >= 0 ? 'emerald' : 'rose'}
        />
        <Kpi
          icon={ClipboardList}
          label="Faturadas"
          value={folhasFaturadas._count.toString()}
          hint={`${formatEUR(Number(folhasFaturadas._sum.total ?? 0))} no total`}
          tone="violet"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Sparkline resultado acumulado */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-semibold text-zinc-900 mb-2">Resultado acumulado</h3>
          <div className="text-2xl font-bold text-zinc-900 mb-3">{formatEUR(resultado)}</div>
          <Sparkline
            data={dailyAccum.length >= 2 ? dailyAccum : [0, 0]}
            color={resultado >= 0 ? colorHex.emerald : colorHex.rose}
            height={120}
          />
          <div className="text-xs text-zinc-500 mt-2">
            {days} {days === 1 ? 'dia' : 'dias'} · {txCount} movimentos
          </div>
        </div>

        {/* Donut despesas */}
        <div className="card p-5">
          <h3 className="font-semibold text-zinc-900 mb-4">Despesas por categoria</h3>
          {donutDespesas.length === 0 ? (
            <div className="py-8 text-center text-sm text-zinc-400">Sem despesas no período.</div>
          ) : (
            <div className="flex items-center gap-4">
              <Donut segments={donutDespesas} size={120} />
              <div className="flex-1 space-y-2 text-sm">
                {legendaDespesas.map((l) => (
                  <div key={l.nome} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: l.cor }} />
                      <span className="truncate">{l.nome}</span>
                    </span>
                    <span className="font-semibold text-zinc-700 text-xs">
                      {l.pct.toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Top receitas */}
        <div className="card p-5">
          <h3 className="font-semibold text-zinc-900 mb-3">Top receitas (categoria)</h3>
          {top4Receitas.length === 0 ? (
            <div className="py-8 text-center text-sm text-zinc-400">Sem receitas no período.</div>
          ) : (
            <div className="space-y-2.5">
              {top4Receitas.map((c) => {
                const pct = totalReceitas > 0 ? (c.valor / totalReceitas) * 100 : 0
                return (
                  <div key={c.id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-zinc-700 truncate">{c.nome}</span>
                      <span className="font-semibold text-emerald-600">{formatEUR(c.valor)}</span>
                    </div>
                    <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: colorHex[c.cor] ?? colorHex.emerald }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Top clientes */}
        <div className="card p-5">
          <h3 className="font-semibold text-zinc-900 mb-3 flex items-center gap-2">
            <UsersIcon className="w-4 h-4 text-zinc-400" />
            Top clientes (faturação)
          </h3>
          {topClientesData.length === 0 ? (
            <div className="py-8 text-center text-sm text-zinc-400">Sem clientes com entradas no período.</div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {topClientesData.map((c, i) => (
                <Link
                  key={c.id}
                  href={`/clientes/${c.id}`}
                  className="flex items-center gap-3 py-2 hover:bg-zinc-50 -mx-2 px-2 rounded transition"
                >
                  <div className="w-6 h-6 bg-zinc-100 rounded-full flex items-center justify-center text-xs font-bold text-zinc-600">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0 text-sm font-medium text-zinc-900 truncate">{c.nome}</div>
                  <div className="text-sm font-bold text-emerald-600 whitespace-nowrap">
                    {formatEUR(c.total)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Folhas por estado */}
      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-zinc-400" />
            Folhas abertas no período
          </h3>
          <span className="text-xs text-zinc-500">{woTotal} folhas</span>
        </div>
        {woTotal === 0 ? (
          <div className="py-8 text-center text-sm text-zinc-400">Sem folhas abertas no período.</div>
        ) : (
          <div className="space-y-2.5">
            {woByEstado.map((row) => {
              const meta = STATUS_META[row.estado]
              const pct = (row.count / woMaxCount) * 100
              return (
                <div key={row.estado}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', meta.chip)}>
                      <span className={cn('w-1.5 h-1.5 rounded-full', meta.dot)} />
                      {meta.label}
                    </span>
                    <span className="text-zinc-700">
                      <span className="font-semibold">{row.count}</span>
                      {row.total > 0 && <span className="text-zinc-500 ml-2 text-xs">{formatEUR(row.total)}</span>}
                    </span>
                  </div>
                  <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', meta.dot)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <p className="text-[11px] text-zinc-400 text-center print:block hidden">
        Carteira · Relatório gerado a {formatDate(new Date(), 'dd/MM/yyyy HH:mm')}
      </p>
    </>
  )
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Wallet
  label: string
  value: string
  hint: string
  tone: 'emerald' | 'rose' | 'violet'
}) {
  const toneClass: Record<typeof tone, string> = {
    emerald: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-600',
    violet: 'bg-violet-50 text-violet-600',
  }
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', toneClass[tone])}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs text-zinc-500 uppercase tracking-wide font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold text-zinc-900">{value}</div>
      <div className="text-xs text-zinc-500 mt-0.5">{hint}</div>
    </div>
  )
}
