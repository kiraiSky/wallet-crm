import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatEUR, formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  ClipboardList,
  UserPlus,
  ArrowLeftRight,
  Cake,
  AlertTriangle,
  Activity,
} from 'lucide-react'
import { STATUS_META } from '../../folhas/status'

export const dynamic = 'force-dynamic'

type EventKind = 'customer-new' | 'wo-new' | 'wo-status' | 'tx' | 'birthday' | 'inactive'

type TimelineEvent = {
  id: string
  kind: EventKind
  at: Date
  title: string
  hint: string
  href?: string
  amount?: number
  amountTone?: 'positive' | 'negative'
}

const kindMeta: Record<EventKind, { icon: typeof Activity; tone: string; ring: string }> = {
  'customer-new': { icon: UserPlus, tone: 'bg-sky-100 text-sky-700', ring: 'ring-sky-200' },
  'wo-new': { icon: ClipboardList, tone: 'bg-violet-100 text-violet-700', ring: 'ring-violet-200' },
  'wo-status': { icon: Activity, tone: 'bg-amber-100 text-amber-700', ring: 'ring-amber-200' },
  tx: { icon: ArrowLeftRight, tone: 'bg-emerald-100 text-emerald-700', ring: 'ring-emerald-200' },
  birthday: { icon: Cake, tone: 'bg-rose-100 text-rose-700', ring: 'ring-rose-200' },
  inactive: { icon: AlertTriangle, tone: 'bg-zinc-100 text-zinc-600', ring: 'ring-zinc-200' },
}

const groupLabels = {
  hoje: 'Hoje',
  ontem: 'Ontem',
  semana: 'Esta semana',
  antes: 'Antes',
} as const

function groupFor(date: Date): keyof typeof groupLabels {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diff = (start.getTime() - dStart.getTime()) / (1000 * 60 * 60 * 24)
  if (diff <= 0) return 'hoje'
  if (diff < 2) return 'ontem'
  if (diff < 7) return 'semana'
  return 'antes'
}

type SearchParams = Record<string, string | undefined>

export default async function AtividadePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const filter = params.kind as EventKind | undefined

  const since = new Date()
  since.setDate(since.getDate() - 60)

  const [newCustomers, workOrders, statusEvents, recentTxs] = await Promise.all([
    prisma.customer.findMany({
      where: { archived: false, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 80,
      select: { id: true, nome: true, tag: true, createdAt: true },
    }),
    prisma.workOrder.findMany({
      where: { dataAbertura: { gte: since } },
      orderBy: { dataAbertura: 'desc' },
      take: 80,
      include: { customer: { select: { id: true, nome: true } } },
    }),
    prisma.auditLog.findMany({
      where: {
        entityType: 'WORK_ORDER',
        action: 'STATUS_CHANGE',
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      take: 80,
    }),
    prisma.transaction.findMany({
      where: {
        data: { gte: since },
        OR: [{ customerId: { not: null } }, { workOrderId: { not: null } }],
      },
      orderBy: { data: 'desc' },
      take: 80,
      include: {
        customer: { select: { id: true, nome: true } },
        workOrder: { select: { numero: true } },
        category: { select: { nome: true } },
      },
    }),
  ])

  const events: TimelineEvent[] = []

  for (const c of newCustomers) {
    events.push({
      id: `c-${c.id}`,
      kind: 'customer-new',
      at: c.createdAt,
      title: `Novo cliente: ${c.nome}`,
      hint: `Marcado como ${c.tag.toLowerCase()}`,
      href: `/clientes/${c.id}`,
    })
  }

  for (const wo of workOrders) {
    events.push({
      id: `wo-${wo.id}`,
      kind: 'wo-new',
      at: wo.dataAbertura,
      title: `Folha #${wo.numero} aberta`,
      hint: `${wo.customer.nome} · ${wo.problema.slice(0, 60)}${wo.problema.length > 60 ? '…' : ''}`,
      href: `/folhas/${wo.id}`,
    })
  }

  for (const s of statusEvents) {
    const novoEstado = (s.after as { estado?: string } | null)?.estado
    if (!novoEstado) continue
    const meta = STATUS_META[novoEstado as keyof typeof STATUS_META]
    events.push({
      id: `s-${s.id}`,
      kind: 'wo-status',
      at: s.createdAt,
      title: s.summary ?? `Folha → ${novoEstado}`,
      hint: meta?.label ?? novoEstado,
      href: `/folhas/${s.entityId}`,
    })
  }

  for (const tx of recentTxs) {
    const isEntrada = tx.tipo === 'ENTRADA'
    events.push({
      id: `tx-${tx.id}`,
      kind: 'tx',
      at: tx.data,
      title: `${isEntrada ? 'Entrada' : 'Saída'}: ${tx.descricao}`,
      hint: [
        tx.customer?.nome,
        tx.workOrder ? `Folha #${tx.workOrder.numero}` : null,
        tx.category.nome,
      ]
        .filter(Boolean)
        .join(' · '),
      href: tx.customer ? `/clientes/${tx.customer.id}` : `/lancamentos`,
      amount: Number(tx.valor),
      amountTone: isEntrada ? 'positive' : 'negative',
    })
  }

  // Aniversariantes — pseudo evento (próximos 14 dias)
  const proximos = await prisma.customer.findMany({
    where: { archived: false, aniversario: { not: null } },
    select: { id: true, nome: true, aniversario: true },
  })
  const today = new Date()
  for (const c of proximos) {
    if (!c.aniversario) continue
    const aniv = new Date(c.aniversario)
    const thisYear = new Date(today.getFullYear(), aniv.getMonth(), aniv.getDate())
    const diff = (thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    if (diff >= -1 && diff <= 14) {
      events.push({
        id: `bd-${c.id}`,
        kind: 'birthday',
        at: thisYear,
        title: `🎂 ${c.nome} faz anos`,
        hint:
          diff < 0
            ? 'Foi ontem'
            : diff < 1
              ? 'Hoje!'
              : `Em ${Math.round(diff)} dias`,
        href: `/clientes/${c.id}`,
      })
    }
  }

  events.sort((a, b) => b.at.getTime() - a.at.getTime())

  const visible = filter ? events.filter((e) => e.kind === filter) : events

  const grouped: Record<keyof typeof groupLabels, TimelineEvent[]> = {
    hoje: [],
    ontem: [],
    semana: [],
    antes: [],
  }
  for (const ev of visible) grouped[groupFor(ev.at)].push(ev)

  const filterChips: { key: string; label: string; value?: EventKind }[] = [
    { key: 'all', label: 'Tudo' },
    { key: 'wo-new', label: 'Folhas', value: 'wo-new' },
    { key: 'tx', label: 'Movimentos', value: 'tx' },
    { key: 'customer-new', label: 'Clientes', value: 'customer-new' },
    { key: 'wo-status', label: 'Estados', value: 'wo-status' },
    { key: 'birthday', label: 'Aniversários', value: 'birthday' },
  ]

  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-zinc-900">CRM · Atividade</h1>
        <p className="text-zinc-500 text-sm">
          Timeline dos últimos 60 dias.
        </p>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {filterChips.map((f) => {
          const active = (!filter && f.key === 'all') || filter === f.value
          const href = f.value ? `/crm/atividade?kind=${f.value}` : '/crm/atividade'
          return (
            <Link
              key={f.key}
              href={href}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition',
                active
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-300'
              )}
            >
              {f.label}
            </Link>
          )
        })}
      </div>

      {visible.length === 0 ? (
        <div className="card p-10 text-center text-sm text-zinc-500">
          Sem atividade no período.
        </div>
      ) : (
        <div className="space-y-6">
          {(Object.keys(grouped) as Array<keyof typeof groupLabels>).map((groupKey) => {
            const items = grouped[groupKey]
            if (items.length === 0) return null
            return (
              <div key={groupKey}>
                <h3 className="text-xs uppercase tracking-wide font-semibold text-zinc-500 mb-2 px-1">
                  {groupLabels[groupKey]} <span className="text-zinc-400">· {items.length}</span>
                </h3>
                <div className="card divide-y divide-zinc-100">
                  {items.map((ev) => {
                    const meta = kindMeta[ev.kind]
                    const Icon = meta.icon
                    const row = (
                      <div className="flex items-start gap-3 p-3 hover:bg-zinc-50/60 transition">
                        <div
                          className={cn(
                            'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ring-2 ring-inset',
                            meta.tone,
                            meta.ring
                          )}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-zinc-900 truncate">
                            {ev.title}
                          </div>
                          <div className="text-xs text-zinc-500 mt-0.5 truncate">
                            {ev.hint} · {formatDateTime(ev.at)}
                          </div>
                        </div>
                        {ev.amount !== undefined && (
                          <div
                            className={cn(
                              'text-sm font-bold whitespace-nowrap',
                              ev.amountTone === 'positive' ? 'text-emerald-600' : 'text-rose-500'
                            )}
                          >
                            {ev.amountTone === 'positive' ? '+ ' : '- '}
                            {formatEUR(ev.amount)}
                          </div>
                        )}
                      </div>
                    )
                    return ev.href ? (
                      <Link key={ev.id} href={ev.href}>
                        {row}
                      </Link>
                    ) : (
                      <div key={ev.id}>{row}</div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
