import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/current-user'
import { WorkOrderDetailClient } from './WorkOrderDetailClient'
import type { WorkOrderStatus } from '../status'
import type { UserOption } from '../page'

export const dynamic = 'force-dynamic'

export type WorkOrderItemRow = {
  id: string
  tipo: 'PECA' | 'MAO_OBRA'
  descricao: string
  referencia: string | null
  quantidade: number
  precoUnit: number
  margem: number | null
  iva: number | null
  total: number
}

export type WorkOrderCaucaoRow = {
  id: string
  valor: number
  data: string
  notas: string | null
  transactionId: string | null
  moloniDocumentId: number | null
  moloniDocumentType: string | null
  createdAt: string
}

export type WorkOrderPhotoRow = {
  id: string
  slot: 'FRONT' | 'LEFT_SIDE' | 'RIGHT_SIDE' | 'REAR' | 'INTERIOR' | 'ODOMETER' | 'DAMAGE' | 'EXTRA'
  filename: string
  mimeType: string
  note: string | null
  uploadedAt: string
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
  attachments: { id: string; filename: string; mimeType: string }[]
  agendado: boolean
  dataAgendada: string | null
}

export type WorkOrderDetail = {
  id: string
  numero: number
  estado: WorkOrderStatus
  shareToken: string | null
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
  moloniDocumentId: number | null
  moloniDocumentType: string | null
  responsibleId: string | null
  responsible: { id: string; nome: string; photoUrl: string | null } | null
  customer: { id: string; nome: string; telefone: string | null; nif: string | null; createdAt: string }
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
  caucoes: WorkOrderCaucaoRow[]
  photos: WorkOrderPhotoRow[]
  totalCaucoes: number
  totalRestante: number
}

export default async function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const me = await getCurrentUser()
  const isOwner = me.role === 'OWNER'
  const [wo, txList, accounts, categories, templates, automationLogs, users] = await Promise.all([
    prisma.workOrder.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, nome: true, telefone: true, nif: true, createdAt: true } },
        vehicle: true,
        responsible: { select: { id: true, nome: true, photoStoragePath: true } },
        items: { orderBy: { createdAt: 'asc' } },
        caucoes: { orderBy: { data: 'asc' } },
        photos: { orderBy: { uploadedAt: 'desc' } },
      },
    }),
    prisma.transaction.findMany({
      where: { workOrderId: id, tipo: { in: ['ENTRADA', 'SAIDA'] } },
      orderBy: { data: 'desc' },
      include: {
        account: { select: { nome: true } },
        category: { select: { nome: true, cor: true, icone: true } },
        attachments: { select: { id: true, filename: true, mimeType: true } },
        _count: { select: { attachments: true } },
      },
    }),
    prisma.account.findMany({
      where: { archived: false },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, cor: true, icone: true },
    }),
    prisma.category.findMany({
      where: { archived: false, tipo: { in: ['ENTRADA', 'SAIDA'] } },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, tipo: true, cor: true, icone: true, parentId: true },
    }),
    prisma.automationTemplate.findMany({
      where: { ativo: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, nome: true, tipo: true, trigger: true, triggerEstados: true, mensagem: true },
    }),
    prisma.automationLog.findMany({
      where: { workOrderId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, templateNome: true, mensagemEnviada: true, webhookOk: true, webhookResponse: true, createdAt: true },
    }),
    prisma.user.findMany({
      where: { active: true },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, role: true, photoStoragePath: true },
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
    moloniDocumentId: wo.moloniDocumentId,
    moloniDocumentType: wo.moloniDocumentType,
    responsibleId: wo.responsibleId,
    responsible: wo.responsible
      ? {
          id: wo.responsible.id,
          nome: wo.responsible.nome,
          photoUrl: wo.responsible.photoStoragePath ? `/api/users/${wo.responsible.id}/photo` : null,
        }
      : null,
    shareToken: wo.shareToken,
    customer: { ...wo.customer, createdAt: wo.customer.createdAt.toISOString() },
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
      referencia: it.referencia,
      quantidade: Number(it.quantidade),
      precoUnit: Number(it.precoUnit),
      margem: it.margem !== null ? Number(it.margem) : null,
      iva: it.iva !== null ? Number(it.iva) : null,
      total: Number(it.total),
    })),
    caucoes: wo.caucoes.map((c) => ({
      id: c.id,
      valor: Number(c.valor),
      data: c.data.toISOString(),
      notas: c.notas,
      transactionId: c.transactionId,
      moloniDocumentId: c.moloniDocumentId,
      moloniDocumentType: c.moloniDocumentType,
      createdAt: c.createdAt.toISOString(),
    })),
    photos: wo.photos.map((photo) => ({
      id: photo.id,
      slot: photo.slot as WorkOrderPhotoRow['slot'],
      filename: photo.filename,
      mimeType: photo.mimeType,
      note: photo.note,
      uploadedAt: photo.uploadedAt.toISOString(),
    })),
    totalCaucoes: wo.caucoes.reduce((acc, c) => acc + Number(c.valor), 0),
    totalRestante: Number(wo.total) - wo.caucoes.reduce((acc, c) => acc + Number(c.valor), 0),
  }

  const transactions: WorkOrderTransactionRow[] = txList.map((t) => ({
    id: t.id,
    tipo: t.tipo as 'ENTRADA' | 'SAIDA',
    valor: Number(t.valor),
    descricao: t.descricao,
    data: t.data.toISOString(),
    observacao: t.observacao,
    accountId: t.accountId,
    categoryId: t.categoryId!,
    workOrderId: t.workOrderId,
    customerId: t.customerId,
    account: t.account,
    category: t.category!,
    hasAttachment: t._count.attachments > 0,
    attachments: t.attachments,
    agendado: t.agendado,
    dataAgendada: t.dataAgendada ? t.dataAgendada.toISOString() : null,
  }))

  return (
    <WorkOrderDetailClient
      workOrder={detail}
      transactions={transactions}
      accounts={accounts}
      categories={categories.map((c) => ({ ...c, tipo: c.tipo as 'ENTRADA' | 'SAIDA' }))}
      isOwner={isOwner}
      templates={templates}
      users={users.map((u) => ({
        id: u.id,
        nome: u.nome,
        role: u.role as UserOption['role'],
        photoUrl: u.photoStoragePath ? `/api/users/${u.id}/photo` : null,
      }))}
      automationLogs={automationLogs.map((l) => ({
        ...l,
        createdAt: l.createdAt.toISOString(),
        webhookResponse: l.webhookResponse ?? null,
      }))}
    />
  )
}
