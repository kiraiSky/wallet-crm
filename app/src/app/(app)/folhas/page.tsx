import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { WorkOrdersClient } from './WorkOrdersClient'
import { STATUS_LIST, ACTIVE_STATUSES, ARQUIVO_STATUSES, type WorkOrderStatus } from './status'

export const dynamic = 'force-dynamic'

export type WorkOrderRow = {
  id: string
  numero: number
  estado: WorkOrderStatus
  problema: string
  total: number
  dataAbertura: string
  dataPrevista: string | null
  dataConclusao: string | null
  customer: { id: string; nome: string }
  vehicle: { id: string; matricula: string; marca: string; modelo: string } | null
  responsible: { id: string; nome: string; photoUrl: string | null } | null
  lastMessage: { templateNome: string; webhookOk: boolean; createdAt: string } | null
}

export type CustomerOption = {
  id: string
  nome: string
  telefone: string | null
  nif: string | null
  createdAt: string
}

export type UserOption = {
  id: string
  nome: string
  role: 'OWNER' | 'EMPLOYEE'
  photoUrl: string | null
}

type SearchParams = Record<string, string | undefined>

const WO_INCLUDE = {
  customer: { select: { id: true, nome: true } },
  vehicle: { select: { id: true, matricula: true, marca: true, modelo: true } },
  responsible: { select: { id: true, nome: true, photoStoragePath: true } },
  automationLogs: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: { templateNome: true, webhookOk: true, createdAt: true },
  },
} as const

function toRow(wo: {
  id: string; numero: number; estado: string; problema: string; total: unknown;
  dataAbertura: Date; dataPrevista: Date | null; dataConclusao: Date | null;
  customer: { id: string; nome: string };
  vehicle: { id: string; matricula: string; marca: string; modelo: string } | null;
  responsible: { id: string; nome: string; photoStoragePath: string | null } | null;
  automationLogs: { templateNome: string; webhookOk: boolean; createdAt: Date }[];
}): WorkOrderRow {
  return {
    id: wo.id,
    numero: wo.numero,
    estado: wo.estado as WorkOrderStatus,
    problema: wo.problema,
    total: Number(wo.total),
    dataAbertura: wo.dataAbertura.toISOString(),
    dataPrevista: wo.dataPrevista ? wo.dataPrevista.toISOString() : null,
    dataConclusao: wo.dataConclusao ? wo.dataConclusao.toISOString() : null,
    customer: wo.customer,
    vehicle: wo.vehicle,
    responsible: wo.responsible
      ? {
          id: wo.responsible.id,
          nome: wo.responsible.nome,
          photoUrl: wo.responsible.photoStoragePath ? `/api/users/${wo.responsible.id}/photo` : null,
        }
      : null,
    lastMessage: wo.automationLogs[0]
      ? { ...wo.automationLogs[0], createdAt: wo.automationLogs[0].createdAt.toISOString() }
      : null,
  }
}

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

  const searchWhere: Prisma.WorkOrderWhereInput = {
    ...(customerFilter && { customerId: customerFilter }),
    ...(search && {
      OR: [
        { problema: { contains: search, mode: 'insensitive' } },
        { customer: { nome: { contains: search, mode: 'insensitive' } } },
        { vehicle: { matricula: { contains: search, mode: 'insensitive' } } },
      ],
    }),
  }

  // Obras ativas (no kanban/lista principal)
  const activeWhere: Prisma.WorkOrderWhereInput = {
    estado: estadoFilter ? estadoFilter : { in: ACTIVE_STATUSES },
    ...searchWhere,
  }

  // Obras arquivadas (FINALIZADA + PERDIDA)
  const arquivoWhere: Prisma.WorkOrderWhereInput = {
    estado: { in: ARQUIVO_STATUSES },
    ...searchWhere,
  }

  const [workOrders, archivedOrders, statusCounts, customers, users] = await Promise.all([
    prisma.workOrder.findMany({
      where: activeWhere,
      orderBy: { dataAbertura: 'desc' },
      take: 200,
      include: WO_INCLUDE,
    }),
    prisma.workOrder.findMany({
      where: arquivoWhere,
      orderBy: { dataAbertura: 'desc' },
      take: 200,
      include: WO_INCLUDE,
    }),
    prisma.workOrder.groupBy({ by: ['estado'], _count: true, _sum: { total: true } }),
    prisma.customer.findMany({
      where: { archived: false },
      orderBy: { createdAt: 'desc' },
      select: { id: true, nome: true, telefone: true, nif: true, createdAt: true },
    }),
    prisma.user.findMany({
      where: { active: true },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, role: true, photoStoragePath: true },
    }),
  ])

  const counts: Record<WorkOrderStatus | 'TOTAL' | 'ARQUIVO', number> = {
    ABERTA: 0, EM_DIAGNOSTICO: 0, AGUARDA_PECAS: 0, EM_REPARACAO: 0,
    CONCLUIDA: 0, FATURADA: 0, CANCELADA: 0, FINALIZADA: 0, PERDIDA: 0,
    TOTAL: 0, ARQUIVO: 0,
  }
  let valorEmAberto = 0
  for (const c of statusCounts) {
    const s = c.estado as WorkOrderStatus
    counts[s] = c._count
    if (!ARQUIVO_STATUSES.includes(s)) {
      counts.TOTAL += c._count
      if (s !== 'CANCELADA' && s !== 'FATURADA') {
        valorEmAberto += Number(c._sum.total ?? 0)
      }
    } else {
      counts.ARQUIVO += c._count
    }
  }

  return (
    <WorkOrdersClient
      workOrders={workOrders.map(toRow)}
      archivedOrders={archivedOrders.map(toRow)}
      customers={customers.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))}
      users={users.map((u) => ({
        id: u.id,
        nome: u.nome,
        role: u.role as UserOption['role'],
        photoUrl: u.photoStoragePath ? `/api/users/${u.id}/photo` : null,
      }))}
      counts={counts}
      valorEmAberto={valorEmAberto}
      filters={{ search, estado: estadoFilter, customerId: customerFilter }}
    />
  )
}
