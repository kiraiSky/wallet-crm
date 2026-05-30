import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { formatEUR, formatDate } from '@/lib/format'
import { Sparkline, Donut } from '@/components/Charts'
import { colorHex } from '@/lib/colors'
import { Users, Award, TrendingUp, AlertTriangle, Cake, ArrowRight, ClipboardList, Wrench, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MechanicFilterSelect } from './MechanicFilterSelect'
import { PeriodFilterSelect, type CrmPeriod } from './PeriodFilterSelect'
import { getCurrentUser } from '@/lib/current-user'
import type { UserOption } from '../folhas/page'
import type { WorkOrderStatus } from '../folhas/status'

export const dynamic = 'force-dynamic'

const MONTHS_IN_SERIES = 6
const INACTIVE_THRESHOLD_DAYS = 90

type Tag = 'VIP' | 'RECORRENTE' | 'NOVO' | 'INATIVO'
type SearchParams = { mechanic?: string; period?: string }

const periodLabels: Record<CrmPeriod, string> = {
  week: 'esta semana',
  month: 'este mes',
  quarter: 'este trimestre',
  year: 'este ano',
}

const periodOptions: CrmPeriod[] = ['week', 'month', 'quarter', 'year']

const statusChartMeta: Record<WorkOrderStatus, { label: string; color: string }> = {
  ABERTA: { label: 'Aberta', color: colorHex.sky },
  EM_DIAGNOSTICO: { label: 'Em diagnostico', color: colorHex.violet },
  AGUARDA_PECAS: { label: 'Aguarda pecas', color: colorHex.amber },
  EM_REPARACAO: { label: 'Em reparacao', color: colorHex.orange },
  CONCLUIDA: { label: 'Concluida', color: colorHex.emerald },
  FATURADA: { label: 'Faturada', color: colorHex.teal },
  CANCELADA: { label: 'Cancelada', color: colorHex.zinc },
  FINALIZADA: { label: 'Finalizada', color: colorHex.emerald },
  PERDIDA: { label: 'Perdida', color: colorHex.rose },
}

const statusChartOrder = Object.keys(statusChartMeta) as WorkOrderStatus[]

function getPeriodRange(period: CrmPeriod, now: Date) {
  if (period === 'week') {
    const start = new Date(now)
    const day = start.getDay() || 7
    start.setDate(start.getDate() - day + 1)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    return { start, end }
  }

  if (period === 'quarter') {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3
    const start = new Date(now.getFullYear(), quarterStartMonth, 1)
    const end = new Date(now.getFullYear(), quarterStartMonth + 3, 1)
    return { start, end }
  }

  if (period === 'year') {
    const start = new Date(now.getFullYear(), 0, 1)
    const end = new Date(now.getFullYear() + 1, 0, 1)
    return { start, end }
  }

  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return { start, end }
}

function getPreviousPeriodRange(period: CrmPeriod, current: { start: Date; end: Date }) {
  const start = new Date(current.start)
  const end = new Date(current.end)

  if (period === 'week') {
    start.setDate(start.getDate() - 7)
    end.setDate(end.getDate() - 7)
  } else if (period === 'month') {
    start.setMonth(start.getMonth() - 1)
    end.setMonth(end.getMonth() - 1)
  } else if (period === 'quarter') {
    start.setMonth(start.getMonth() - 3)
    end.setMonth(end.getMonth() - 3)
  } else {
    start.setFullYear(start.getFullYear() - 1)
    end.setFullYear(end.getFullYear() - 1)
  }

  return { start, end }
}

const tagMeta: Record<Tag, { label: string; tone: string; hex: string }> = {
  VIP: { label: 'VIP', tone: 'bg-amber-100 text-amber-700', hex: colorHex.amber },
  RECORRENTE: { label: 'Recorrente', tone: 'bg-violet-100 text-violet-700', hex: colorHex.violet },
  NOVO: { label: 'Novo', tone: 'bg-sky-100 text-sky-700', hex: colorHex.sky },
  INATIVO: { label: 'Inativo', tone: 'bg-zinc-100 text-zinc-600', hex: colorHex.zinc },
}

export default async function CrmOverviewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const currentUser = await getCurrentUser()
  if (currentUser.role === 'EMPLOYEE') redirect('/folhas')

  const params = await searchParams
  const now = new Date()
  const selectedPeriod = periodOptions.includes(params.period as CrmPeriod)
    ? (params.period as CrmPeriod)
    : 'month'
  const periodRange = getPeriodRange(selectedPeriod, now)
  const previousPeriodRange = getPreviousPeriodRange(selectedPeriod, periodRange)
  const seriesStart = new Date(now.getFullYear(), now.getMonth() - (MONTHS_IN_SERIES - 1), 1)
  const inactiveCutoff = new Date()
  inactiveCutoff.setDate(inactiveCutoff.getDate() - INACTIVE_THRESHOLD_DAYS)

  const users = await prisma.user.findMany({
    where: { active: true },
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true, role: true, photoStoragePath: true },
  })
  const userOptions = users.map((u) => ({
    id: u.id,
    nome: u.nome,
    role: u.role as UserOption['role'],
    photoUrl: u.photoStoragePath ? `/api/users/${u.id}/photo` : null,
  }))
  const selectedMechanicId = users.some((u) => u.id === params.mechanic) ? params.mechanic : undefined
  const selectedMechanic = users.find((u) => u.id === selectedMechanicId) ?? null
  const mechanicWhere: Prisma.WorkOrderWhereInput = selectedMechanicId
    ? { responsibleId: selectedMechanicId }
    : {}
  const workOrderPeriodWhere: Prisma.WorkOrderWhereInput = {
    ...mechanicWhere,
    dataAbertura: { gte: periodRange.start, lt: periodRange.end },
  }
  const completedInPeriodWhere: Prisma.WorkOrderWhereInput = {
    ...mechanicWhere,
    estado: { in: ['CONCLUIDA', 'FATURADA', 'FINALIZADA'] },
    total: { gt: 0 },
    OR: [
      { dataConclusao: { gte: periodRange.start, lt: periodRange.end } },
      {
        dataConclusao: null,
        dataAbertura: { gte: periodRange.start, lt: periodRange.end },
      },
    ],
  }
  const completedAnyResponsibleInPeriodWhere: Prisma.WorkOrderWhereInput = {
    estado: { in: ['CONCLUIDA', 'FATURADA', 'FINALIZADA'] },
    total: { gt: 0 },
    OR: [
      { dataConclusao: { gte: periodRange.start, lt: periodRange.end } },
      {
        dataConclusao: null,
        dataAbertura: { gte: periodRange.start, lt: periodRange.end },
      },
    ],
  }

  const [
    customersTotal,
    customersThisPeriod,
    customersPreviousPeriod,
    tagCounts,
    aquisicaoSeries,
    ticketAgg,
    workOrdersTotalCount,
    mechanicStatusCounts,
    mechanicCompletedAgg,
    customersWithRecentWO,
    allCustomersWithWOs,
    aniversariantes,
    latestCustomers,
    productionByResponsible,
  ] = await Promise.all([
    prisma.customer.count({ where: { archived: false } }),
    prisma.customer.count({
      where: { archived: false, createdAt: { gte: periodRange.start, lt: periodRange.end } },
    }),
    prisma.customer.count({
      where: {
        archived: false,
        createdAt: { gte: previousPeriodRange.start, lt: previousPeriodRange.end },
      },
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
      where: completedInPeriodWhere,
      _avg: { total: true },
      _count: true,
    }),
    prisma.workOrder.count({ where: workOrderPeriodWhere }),
    prisma.workOrder.groupBy({
      by: ['estado'],
      where: workOrderPeriodWhere,
      _count: true,
      _sum: { total: true },
    }),
    prisma.workOrder.aggregate({
      where: completedInPeriodWhere,
      _avg: { total: true },
      _sum: { total: true },
      _count: true,
    }),
    prisma.workOrder.findMany({
      where: { ...mechanicWhere, dataAbertura: { gte: inactiveCutoff } },
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
    prisma.workOrder.groupBy({
      by: ['responsibleId'],
      where: completedAnyResponsibleInPeriodWhere,
      _count: true,
      _sum: { total: true },
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
    customersPreviousPeriod === 0
      ? customersThisPeriod > 0
        ? 100
        : 0
      : ((customersThisPeriod - customersPreviousPeriod) / customersPreviousPeriod) * 100

  // Taxa de retorno: clientes com >=2 folhas / clientes com >=1 folha
  const comAlgumaFolha = allCustomersWithWOs.filter((c) => c._count.workOrders >= 1).length
  const comDuasOuMais = allCustomersWithWOs.filter((c) => c._count.workOrders >= 2).length
  const taxaRetorno = comAlgumaFolha > 0 ? (comDuasOuMais / comAlgumaFolha) * 100 : 0

  // Ticket médio (folhas concluídas/faturadas)
  const ticketMedio = Number(ticketAgg._avg.total ?? 0)

  const mechanicCounts = {
    total: 0,
    emCurso: 0,
    concluidas: 0,
    valorAberto: 0,
  }
  for (const c of mechanicStatusCounts) {
    const estado = c.estado as string
    mechanicCounts.total += c._count
    if (['ABERTA', 'EM_DIAGNOSTICO', 'AGUARDA_PECAS', 'EM_REPARACAO'].includes(estado)) {
      mechanicCounts.emCurso += c._count
      mechanicCounts.valorAberto += Number(c._sum.total ?? 0)
    }
    if (['CONCLUIDA', 'FATURADA', 'FINALIZADA'].includes(estado)) {
      mechanicCounts.concluidas += c._count
    }
  }
  const mechanicTicketMedio = Number(mechanicCompletedAgg._avg.total ?? 0)
  const mechanicTotalFaturado = Number(mechanicCompletedAgg._sum.total ?? 0)
  const statusRows = statusChartOrder.map((status) => {
    const found = mechanicStatusCounts.find((item) => item.estado === status)
    return {
      label: statusChartMeta[status].label,
      value: found?._count ?? 0,
      color: statusChartMeta[status].color,
    }
  })
  const productionRows = users.map((user) => {
    const found = productionByResponsible.find((item) => item.responsibleId === user.id)
    return {
      label: user.nome,
      value: Number(found?._sum.total ?? 0),
      count: found?._count ?? 0,
      color: user.id === selectedMechanicId ? '#6366f1' : colorHex.emerald,
    }
  })

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
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">CRM · Visão geral</h1>
          <p className="text-zinc-500 text-sm">
            Saúde da carteira de clientes em {now.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}.
            {selectedMechanic && <span> Filtro: {selectedMechanic.nome}.</span>}
            <span> Periodo: {periodLabels[selectedPeriod]}.</span>
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <PeriodFilterSelect selected={selectedPeriod} />
          <MechanicFilterSelect users={userOptions} selectedId={selectedMechanicId} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          icon={Wrench}
          label="Folhas"
          value={mechanicCounts.total.toString()}
          hint={selectedMechanic ? `Atribuidas a ${selectedMechanic.nome}` : `Abertas ${periodLabels[selectedPeriod]}`}
          tone="emerald"
        />
        <KpiCard
          icon={ClipboardList}
          label="Em curso"
          value={mechanicCounts.emCurso.toString()}
          hint={`${formatEUR(mechanicCounts.valorAberto)} em aberto`}
          tone="amber"
        />
        <KpiCard
          icon={Award}
          label="Concluidas"
          value={mechanicCounts.concluidas.toString()}
          hint={`${mechanicCompletedAgg._count} com valor ${periodLabels[selectedPeriod]}`}
          tone="emerald"
        />
        <KpiCard
          icon={TrendingUp}
          label="Ticket medio"
          value={formatEUR(mechanicTicketMedio)}
          hint={`${formatEUR(mechanicTotalFaturado)} total`}
          tone="violet"
        />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          icon={Users}
          label="Clientes"
          value={customersTotal.toString()}
          hint={`${customersThisPeriod} novos ${periodLabels[selectedPeriod]}`}
          tone="emerald"
        />
        <KpiCard
          icon={TrendingUp}
          label="Novos no periodo"
          value={`${customersThisPeriod}`}
          hint={
            variacaoMoM === 0
              ? 'vs periodo anterior'
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

      <div className="space-y-4 mb-4">
        {/* Aquisição */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-zinc-900">Aquisição de clientes</h3>
            <span className="text-xs text-zinc-500">{totalNoPeriodo} nos últimos {MONTHS_IN_SERIES} meses</span>
          </div>
          <Sparkline data={seriesData.length >= 2 ? seriesData : [0, 0]} color={colorHex.emerald} height={130} />
          <div className="grid grid-cols-6 gap-1 mt-3">
            {aquisicao.map((m, i) => (
              <div key={i} className="text-center">
                <div className="text-sm font-semibold text-zinc-800">{m.count}</div>
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
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex-shrink-0">
                <Donut segments={donutSegments} size={136} strokeWidth={18} />
              </div>
              <div className="flex-1 grid gap-2 text-sm">
                {(Object.keys(counts) as Tag[]).map((tag) => (
                  <div key={tag} className="grid grid-cols-[1fr_auto] items-center gap-4">
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tagMeta[tag].hex }}
                      />
                      <span className="text-zinc-700 truncate">{tagMeta[tag].label}</span>
                    </span>
                    <span className="font-semibold text-zinc-800 tabular-nums">{counts[tag]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BarChartCard
            title="Folhas por estado"
            subtitle={`Abertas ${periodLabels[selectedPeriod]}`}
            rows={statusRows}
          />
          <BarChartCard
            title="Producao por colaborador"
            subtitle={`Folhas concluidas/faturadas ${periodLabels[selectedPeriod]}`}
            rows={productionRows}
            formatValue={(value, row) => `${formatEUR(value)} - ${row.count} folhas`}
          />
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

type BarChartRow = {
  label: string
  value: number
  color: string
  count?: number
}

function BarChartCard({
  title,
  subtitle,
  rows,
  formatValue,
}: {
  title: string
  subtitle: string
  rows: BarChartRow[]
  formatValue?: (value: number, row: BarChartRow) => string
}) {
  const max = Math.max(...rows.map((row) => row.value), 1)

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h3 className="font-semibold text-zinc-900">{title}</h3>
        <span className="text-xs text-zinc-500 text-right">{subtitle}</span>
      </div>
      <div className="space-y-3">
        {rows.map((row) => {
          const width = row.value === 0 ? 0 : Math.max(6, (row.value / max) * 100)
          return (
            <div key={row.label} className="grid grid-cols-[120px_1fr_auto] items-center gap-3 text-sm">
              <div className="truncate text-zinc-600">{row.label}</div>
              <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${width}%`, backgroundColor: row.color }}
                />
              </div>
              <div className="min-w-16 text-right font-semibold tabular-nums text-zinc-800">
                {formatValue ? formatValue(row.value, row) : row.value}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: LucideIcon
  label: string
  value: string
  hint: string
  tone: 'emerald' | 'rose' | 'amber' | 'violet'
}) {
  const toneClass: Record<typeof tone, string> = {
    emerald: 'bg-emerald-50 text-emerald-600',
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
