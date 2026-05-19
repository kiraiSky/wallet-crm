import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CustomerDetailClient } from './CustomerDetailClient'
import type { CustomerTag } from '../page'
import type { WorkOrderStatus } from '../../folhas/status'

export const dynamic = 'force-dynamic'

export type CustomerWorkOrderRow = {
  id: string
  numero: number
  estado: WorkOrderStatus
  problema: string
  total: number
  dataAbertura: string
  vehicle: { matricula: string; marca: string; modelo: string } | null
}

export type CustomerTransactionRow = {
  id: string
  tipo: 'ENTRADA' | 'SAIDA'
  valor: number
  descricao: string
  data: string
  observacao: string | null
  accountId: string
  categoryId: string
  workOrderId: string | null
  customerId: string | null
  account: { nome: string }
  category: { nome: string; cor: string; icone: string }
  workOrder: { numero: number } | null
  hasAttachment: boolean
}

export type CustomerDetail = {
  id: string
  nome: string
  telefone: string | null
  email: string | null
  nif: string | null
  morada: string | null
  observacoes: string | null
  aniversario: string | null // ISO
  tag: CustomerTag
  createdAt: string
}

export type VehicleRow = {
  id: string
  matricula: string
  marca: string
  modelo: string
  ano: number | null
  cor: string | null
  km: number | null
  observacoes: string | null
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [customer, workOrders, txList] = await Promise.all([
    prisma.customer.findUnique({
      where: { id },
      include: { vehicles: { orderBy: { createdAt: 'desc' } } },
    }),
    prisma.workOrder.findMany({
      where: { customerId: id },
      orderBy: { dataAbertura: 'desc' },
      take: 50,
      include: {
        vehicle: { select: { matricula: true, marca: true, modelo: true } },
      },
    }),
    prisma.transaction.findMany({
      where: { customerId: id },
      orderBy: { data: 'desc' },
      take: 100,
      include: {
        account: { select: { nome: true } },
        category: { select: { nome: true, cor: true, icone: true } },
        workOrder: { select: { numero: true } },
        _count: { select: { attachments: true } },
      },
    }),
  ])
  if (!customer || customer.archived) notFound()

  const detail: CustomerDetail = {
    id: customer.id,
    nome: customer.nome,
    telefone: customer.telefone,
    email: customer.email,
    nif: customer.nif,
    morada: customer.morada,
    observacoes: customer.observacoes,
    aniversario: customer.aniversario ? customer.aniversario.toISOString() : null,
    tag: customer.tag as CustomerTag,
    createdAt: customer.createdAt.toISOString(),
  }

  const vehicles: VehicleRow[] = customer.vehicles.map((v) => ({
    id: v.id,
    matricula: v.matricula,
    marca: v.marca,
    modelo: v.modelo,
    ano: v.ano,
    cor: v.cor,
    km: v.km,
    observacoes: v.observacoes,
  }))

  const workOrderRows: CustomerWorkOrderRow[] = workOrders.map((wo) => ({
    id: wo.id,
    numero: wo.numero,
    estado: wo.estado as WorkOrderStatus,
    problema: wo.problema,
    total: Number(wo.total),
    dataAbertura: wo.dataAbertura.toISOString(),
    vehicle: wo.vehicle,
  }))

  const transactions: CustomerTransactionRow[] = txList.map((t) => ({
    id: t.id,
    tipo: t.tipo as 'ENTRADA' | 'SAIDA',
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
    workOrder: t.workOrder,
    hasAttachment: t._count.attachments > 0,
  }))

  return (
    <CustomerDetailClient
      customer={detail}
      vehicles={vehicles}
      workOrders={workOrderRows}
      transactions={transactions}
    />
  )
}
