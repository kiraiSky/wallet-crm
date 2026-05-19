import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { WorkOrderDetailClient } from './WorkOrderDetailClient'
import type { WorkOrderStatus } from '../status'

export const dynamic = 'force-dynamic'

export type WorkOrderItemRow = {
  id: string
  tipo: 'PECA' | 'MAO_OBRA'
  descricao: string
  quantidade: number
  precoUnit: number
  total: number
}

export type WorkOrderTransactionRow = {
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
  hasAttachment: boolean
}

export type WorkOrderDetail = {
  id: string
  numero: number
  estado: WorkOrderStatus
  problema: string
  diagnostico: string | null
  trabalho: string | null
  observacoes: string | null
  kmEntrada: number | null
  dataAbertura: string
  dataPrevista: string | null
  dataConclusao: string | null
  totalPecas: number
  totalMaoObra: number
  total: number
  customer: { id: string; nome: string; telefone: string | null }
  vehicle: {
    id: string
    matricula: string
    marca: string
    modelo: string
    ano: number | null
    cor: string | null
    km: number | null
  } | null
  items: WorkOrderItemRow[]
}

export default async function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [wo, txList, accounts, categories] = await Promise.all([
    prisma.workOrder.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, nome: true, telefone: true } },
        vehicle: true,
        items: { orderBy: { createdAt: 'asc' } },
      },
    }),
    prisma.transaction.findMany({
      where: { workOrderId: id },
      orderBy: { data: 'desc' },
      include: {
        account: { select: { nome: true } },
        category: { select: { nome: true, cor: true, icone: true } },
        _count: { select: { attachments: true } },
      },
    }),
    prisma.account.findMany({
      where: { archived: false },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, cor: true, icone: true },
    }),
    prisma.category.findMany({
      where: { archived: false },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, tipo: true, cor: true, icone: true },
    }),
  ])
  if (!wo) notFound()

  const detail: WorkOrderDetail = {
    id: wo.id,
    numero: wo.numero,
    estado: wo.estado as WorkOrderStatus,
    problema: wo.problema,
    diagnostico: wo.diagnostico,
    trabalho: wo.trabalho,
    observacoes: wo.observacoes,
    kmEntrada: wo.kmEntrada,
    dataAbertura: wo.dataAbertura.toISOString(),
    dataPrevista: wo.dataPrevista ? wo.dataPrevista.toISOString() : null,
    dataConclusao: wo.dataConclusao ? wo.dataConclusao.toISOString() : null,
    totalPecas: Number(wo.totalPecas),
    totalMaoObra: Number(wo.totalMaoObra),
    total: Number(wo.total),
    customer: wo.customer,
    vehicle: wo.vehicle
      ? {
          id: wo.vehicle.id,
          matricula: wo.vehicle.matricula,
          marca: wo.vehicle.marca,
          modelo: wo.vehicle.modelo,
          ano: wo.vehicle.ano,
          cor: wo.vehicle.cor,
          km: wo.vehicle.km,
        }
      : null,
    items: wo.items.map((it) => ({
      id: it.id,
      tipo: it.tipo as 'PECA' | 'MAO_OBRA',
      descricao: it.descricao,
      quantidade: Number(it.quantidade),
      precoUnit: Number(it.precoUnit),
      total: Number(it.total),
    })),
  }

  const transactions: WorkOrderTransactionRow[] = txList.map((t) => ({
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
    hasAttachment: t._count.attachments > 0,
  }))

  return (
    <WorkOrderDetailClient
      workOrder={detail}
      transactions={transactions}
      accounts={accounts}
      categories={categories.map((c) => ({ ...c, tipo: c.tipo as 'ENTRADA' | 'SAIDA' }))}
    />
  )
}
