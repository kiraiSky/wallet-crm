import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatEUR, formatDate } from '@/lib/format'
import { Sparkline, Donut } from '@/components/Charts'
import { colorHex } from '@/lib/colors'
import { Users, Award, TrendingUp, AlertTriangle, Cake, ArrowRight, ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const MONTHS_IN_SERIES = 6
const INACTIVE_THRESHOLD_DAYS = 90

type Tag = 'VIP' | 'RECORRENTE' | 'NOVO' | 'INATIVO'

const tagMeta: Record<Tag, { label: string; tone: string; hex: string }> = {
  VIP: { label: 'VIP', tone: 'bg-amber-100 text-amber-700', hex: colorHex.amber },
  RECORRENTE: { label: 'Recorrente', tone: 'bg-violet-100 text-violet-700', hex: colorHex.violet },
  NOVO: { label: 'Novo', tone: 'bg-sky-100 text-sky-700', hex: colorHex.sky },
  INATIVO: { label: 'Inativo', tone: 'bg-zinc-100 text-zinc-600', hex: colorHex.zinc },
}

export default async function CrmOverviewPage() {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const seriesStart = new Date(now.getFullYear(), now.getMonth() - (MONTHS_IN_SERIES - 1), 1)
  const inactiveCutoff = new Date()
  inactiveCutoff.setDate(inactiveCutoff.getDate() - INACTIVE_THRESHOLD_DAYS)

  const [
    customersTotal,
    customersThisMonth,
    customersLastMonth,
    tagCounts,
    aquisicaoSeries,
    ticketAgg,
    workOrdersTotalCount,
    customersWithRecentWO,
    allCustomersWithWOs,
    aniversariantes,
    latestCustomers,
  ] = await Promise.all([
    prisma.customer.count({ where: { archived: false } }),
    prisma.customer.count({ where: { archived: false, createdAt: { gte: startOfMonth } } }),
    prisma.customer.count({
      where: { archived: false, createdAt: { gte: startOfLastMonth, lt: startOfMonth } },
    }),
    prisma.customer.groupBy({
      by: ['tag'],
      where: { archived: false },
      _count: true,
    }),
    prisma.customer.findMany({
      where: { archived: false, createdAt: { gte: seriesStart } },
      select: { createdAt: true },
    }),
    prisma.workOrder.aggregate({
      where: { estado: { in: ['CONCLUIDA', 'FATURADA'] }, total: { gt: 0 } },
      _avg: { total: true },
      _count: true,
    }),
    prisma.workOrder.count(),
    prisma.workOrder.findMany({
      where: { dataAbertura: { gte: inactiveCutoff } },
      select: { customerId: true },
      distinct: ['customerId'],
    }),
    prisma.customer.findMany({
      where: { archived: false },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { workOrders: true } },
        workOrders: {
          orderBy: { dataAbertura: 'desc' },
          take: 1,
          select: { dataAbertura: true },
        },
      },
      take: 500,
    }),
    prisma.customer.findMany({
      where: { archived: false, aniversario: { not: null } },
      select: { id: true, nome: true, aniversario: true, tag: true },
    }),
    prisma.customer.findMany({
      where: { archived: false },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, nome: true, tag: true, createdAt: true, telefone: true },
    }),
  ])

  // Counts por tag (preencher tags em falta)
  const counts: Record<Tag, number> = { VIP: 0, RECORRENTE: 0, NOVO: 0, INATIVO: 0 }
  for (const c of tagCounts) counts[c.tag as Tag] = c._count

  // Série de aquisição (6 meses)
  const aquisicao: { label: string; count: number }[] = []
  for (let i = 0; i < MONTHS_IN_SERIES; i++) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - (MONTHS_IN_SERIES - 1 - i), 1)
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1)
    const cnt = aquisicaoSeries.filter((c) => c.createdAt >= monthStart && c.createdAt < monthEnd).length
    aquisicao.push({
      label: monthStart.toLocaleDateString('pt-PT', { month: 'short' }).replace('.', ''),
      count: cnt,
    })
  }
  const seriesData = aquisicao.map((m) => m.count)
  const totalNoPeriodo = seriesData.reduce((s, n) => s + n, 0)

  // Variação mês a mês
  const variacaoMoM =
    customersLastMonth === 0
      ? customersThisMonth > 0
        ? 100
        : 0
      : ((customersThisMonth - customersLastMonth) / customersLastMonth) * 100

  // Taxa de retorno: clientes com >=2 folhas / clientes com >=1 folha
  const comAlgumaFolha = allCustomersWithWOs.filter((c) => c._count.workOrders >= 1).length
  const comDuasOuMais = allCustomersWithWOs.filter((c) => c._count.workOrders >= 2).length
  const taxaRetorno = comAlgumaFolha > 0 ? (comDuasOuMais / comAlgumaFolha) * 100 : 0

  // Ticket médio (folhas concluídas/faturadas)
  const ticketMedio = Number(ticketAgg._avg.total ?? 0)

  // Inativos: clientes que têm folhas mas nenhuma nos últimos 90 dias
  const clientesAtivosIds = new Set(customersWithRecentWO.map((c) => c.customerId))
  const inactivos = allCustomersWithWOs.filter((c) => {
    if (c._count.workOrders === 0) return false
    const last = c.workOrders[0]?.dataAbertura
    if (!last) return true
    return last < inactiveCutoff && !clientesAtivosIds.has(c.id)
  })
  const inactivosCount = inactivos.length

  // Donut segmentação
  const donutSegments = (Object.keys(counts) as Tag[]).map((tag) => ({
    value: counts[tag],
    color: tagMeta[tag].hex,
  }))

  // Aniversariantes deste mês
  const mesAtual = now.getMonth()
  const aniversariantesMes = aniversariantes
    .filter((c) => c.aniversario && new Date(c.aniversario).getMonth() === mesAtual)
    .map((c) => ({
      id: c.id,
      nome: c.nome,
      tag: c.tag as Tag,
      dia: new Date(c.aniversario as Date).getDate(),
    }))
    .sort((a, b) => a.dia - b.dia)

  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-zinc-900">CRM · Visão geral</h1>
        <p className="text-zinc-500 text-sm">
          Saúde da carteira de clientes em {now.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          icon={Users}
          label="Clientes"
          value={customersTotal.toString()}
          hint={`${customersThisMonth} novos este mês`}
          tone="emerald"
        />
        <KpiCard
          icon={TrendingUp}
          label="Novos no mês"
          value={`${customersThisMonth}`}
          hint={
            variacaoMoM === 0
              ? 'vs mês passado'
              : `${variacaoMoM > 0 ? '+' : ''}${variacaoMoM.toFixed(0)}% vs anterior`
          }
          tone={variacaoMoM >= 0 ? 'emerald' : 'rose'}
        />
        <KpiCard
          icon={Award}
          label="Retorno"
          value={`${taxaRetorno.toFixed(0)}%`}
          hint={`${comDuasOuMais}/${comAlgumaFolha} com 2+ folhas`}
          tone="violet"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Inativos"
          value={inactivosCount.toString()}
          hint={`>${INACTIVE_THRESHOLD_DAYS}d sem visitar`}
          tone="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Aquisição */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-zinc-900">Aquisição de clientes</h3>
            <span className="text-xs text-zinc-500">{totalNoPeriodo} nos últimos {MONTHS_IN_SERIES} meses</span>
          </div>
          <Sparkline data={seriesData.length >= 2 ? seriesData : [0, 0]} color={colorHex.emerald} height={100} />
          <div className="grid grid-cols-6 gap-1 mt-2">
            {aquisicao.map((m, i) => (
              <div key={i} className="text-center">
                <div className="text-xs font-semibold text-zinc-700">{m.count}</div>
                <div className="text-[10px] text-zinc-500 uppercase">{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Donut de segmentação */}
        <div className="card p-5">
          <h3 className="font-semibold text-zinc-900 mb-4">Segmentação</h3>
          {customersTotal === 0 ? (
            <div className="py-8 text-center text-sm text-zinc-400">Sem clientes ainda.</div>
          ) : (
            <div className="flex items-center gap-4">
              <Donut segments={donutSegments} size={120} />
              <div className="flex-1 space-y-2 text-sm">
                {(Object.keys(counts) as Tag[]).map((tag) => (
                  <div key={tag} className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: tagMeta[tag].hex }}
                      />
                      <span className="text-zinc-700">{tagMeta[tag].label}</span>
                    </span>
                    <span className="font-semibold text-zinc-700">{counts[tag]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Aniversariantes */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
                <Cake className="w-4 h-4 text-rose-500" />
                Aniversariantes do mês
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Oportunidade para uma mensagem personalizada.
              </p>
            </div>
          </div>
          {aniversariantesMes.length === 0 ? (
            <div className="py-8 text-center text-sm text-zinc-400">Ninguém faz anos este mês.</div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {aniversariantesMes.map((p) => (
                <Link
                  key={p.id}
                  href={`/clientes/${p.id}`}
                  className="flex items-center gap-3 py-2.5 hover:bg-zinc-50 -mx-2 px-2 rounded transition"
                >
                  <div className="w-8 h-8 bg-rose-100 rounded-full flex items-center justify-center text-rose-700 text-sm font-bold">
                    {p.dia}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-zinc-900 truncate">{p.nome}</div>
                  </div>
                  <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', tagMeta[p.tag].tone)}>
                    {tagMeta[p.tag].label}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* A reativar */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                A reactivar
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Mais de {INACTIVE_THRESHOLD_DAYS} dias sem aparecer.
              </p>
            </div>
            <Link
              href="/clientes?tag=INATIVO"
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium inline-flex items-center gap-1"
            >
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {inactivos.length === 0 ? (
            <div className="py-8 text-center text-sm text-zinc-400">Sem clientes inativos. 🎉</div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {inactivos.slice(0, 5).map((c) => {
                const last = c.workOrders[0]?.dataAbertura
                return (
                  <Link
                    key={c.id}
                    href={`/clientes/${c.id}`}
                    className="flex items-center gap-3 py-2.5 hover:bg-zinc-50 -mx-2 px-2 rounded transition"
                  >
                    <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-700">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-zinc-900 truncate">{c.nome}</div>
                      <div className="text-xs text-zinc-500">
                        {last ? `Última visita: ${formatDate(last)}` : 'Sem visitas'}
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-zinc-900">Ticket médio</h3>
            <ClipboardList className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-900">{formatEUR(ticketMedio)}</div>
          <div className="text-xs text-zinc-500 mt-1">
            Em {ticketAgg._count} folhas concluídas. Total: {workOrdersTotalCount}
          </div>
        </div>

        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-zinc-900">Últimos clientes</h3>
            <Link
              href="/clientes"
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium inline-flex items-center gap-1"
            >
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {latestCustomers.length === 0 ? (
            <div className="py-8 text-center text-sm text-zinc-400">Sem clientes ainda.</div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {latestCustomers.map((c) => (
                <Link
                  key={c.id}
                  href={`/clientes/${c.id}`}
                  className="flex items-center gap-3 py-2.5 hover:bg-zinc-50 -mx-2 px-2 rounded transition"
                >
                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 text-xs font-bold">
                    {c.nome
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((p) => p[0])
                      .join('')
                      .toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-zinc-900 truncate">{c.nome}</div>
                    <div className="text-xs text-zinc-500">
                      {c.telefone ?? '—'} · {formatDate(c.createdAt)}
                    </div>
                  </div>
                  <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', tagMeta[c.tag as Tag].tone)}>
                    {tagMeta[c.tag as Tag].label}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Users
  label: string
  value: string
  hint: string
  tone: 'emerald' | 'rose' | 'amber' | 'violet'
}) {
  const toneClass: Record<typeof tone, string> = {
    emerald: 'bg-indigo-50 text-indigo-600',
    rose: 'bg-rose-50 text-rose-600',
    amber: 'bg-amber-50 text-amber-600',
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
