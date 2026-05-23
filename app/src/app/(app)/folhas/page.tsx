import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { WorkOrdersClient } from './WorkOrdersClient'
import { STATUS_LIST, type WorkOrderStatus } from './status'

export const dynamic = 'force-dynamic'

export type WorkOrderRow = {
  id: string
  numero: number
  estado: WorkOrderStatus
  problema: string
  total: number
  dataAbertura: string
  dataPrevista: string | null
  customer: { id: string; nome: string }
  vehicle: { id: string; matricula: string; marca: string; modelo: string } | null
  lastMessage: { templateNome: string; webhookOk: boolean; createdAt: string } | null
}

export type CustomerOption = {
  id: string
  nome: string
  telefone: string | null
  nif: string | null
  createdAt: string
}

type SearchParams = Record<string, string | undefined>

export default async function FolhasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const search = params.q?.trim() || undefined
  const estadoFilter = STATUS_LIST.includes(params.estado as WorkOrderStatus)
    ? (params.estado as WorkOrderStatus)
    : undefined
  const customerFilter = params.customer || undefined

  const where: Prisma.WorkOrderWhereInput = {
    ...(estadoFilter && { estado: estadoFilter }),
    ...(customerFilter && { customerId: customerFilter }),
    ...(search && {
      OR: [
        { problema: { contains: search, mode: 'insensitive' } },
        { customer: { nome: { contains: search, mode: 'insensitive' } } },
        { vehicle: { matricula: { contains: search, mode: 'insensitive' } } },
      ],
    }),
  }

  const [workOrders, statusCounts, customers] = await Promise.all([
    prisma.workOrder.findMany({
      where,
      orderBy: { dataAbertura: 'desc' },
      take: 200,
      include: {
        customer: { select: { id: true, nome: true } },
        vehicle: { select: { id: true, matricula: true, marca: true, modelo: true } },
        automationLogs: {
          orderBy: { createdAt: 'desc' as const },
          take: 1,
          select: { templateNome: true, webhookOk: true, createdAt: true },
        },
      },
    }),
    prisma.workOrder.groupBy({ by: ['estado'], _count: true, _sum: { total: true } }),
    prisma.customer.findMany({
      where: { archived: false },
      orderBy: { createdAt: 'desc' },
      select: { id: true, nome: true, telefone: true, nif: true, createdAt: true },
    }),
  ])

  const rows: WorkOrderRow[] = workOrders.map((wo) => ({
    id: wo.id,
    numero: wo.numero,
    estado: wo.estado as WorkOrderStatus,
    problema: wo.problema,
    total: Number(wo.total),
    dataAbertura: wo.dataAbertura.toISOString(),
    dataPrevista: wo.dataPrevista ? wo.dataPrevista.toISOString() : null,
    customer: wo.customer,
    vehicle: wo.vehicle,
    lastMessage: wo.automationLogs[0]
      ? { ...wo.automationLogs[0], createdAt: wo.automationLogs[0].createdAt.toISOString() }
      : null,
  }))

  const counts: Record<WorkOrderStatus | 'TOTAL', number> = {
    ABERTA: 0,
    EM_DIAGNOSTICO: 0,
    AGUARDA_PECAS: 0,
    EM_REPARACAO: 0,
    CONCLUIDA: 0,
    FATURADA: 0,
    CANCELADA: 0,
    TOTAL: 0,
  }
  let valorEmAberto = 0
  for (const c of statusCounts) {
    counts[c.estado as WorkOrderStatus] = c._count
    counts.TOTAL += c._count
    if (c.estado !== 'CANCELADA' && c.estado !== 'FATURADA') {
      valorEmAberto += Number(c._sum.total ?? 0)
    }
  }

  return (
    <WorkOrdersClient
      workOrders={rows}
      customers={customers.map((customer) => ({
        ...customer,
        createdAt: customer.createdAt.toISOString(),
      }))}
      counts={counts}
      valorEmAberto={valorEmAberto}
      filters={{ search, estado: estadoFilter, customerId: customerFilter }}
    />
  )
}
