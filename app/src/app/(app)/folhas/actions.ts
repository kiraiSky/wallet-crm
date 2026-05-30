'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { parseEURToCents } from '@/lib/format'
import { logAudit } from '@/lib/audit'
import { getCurrentUser } from '@/lib/current-user'

const STATUSES = [
  'ABERTA',
  'EM_DIAGNOSTICO',
  'AGUARDA_PECAS',
  'EM_REPARACAO',
  'CONCLUIDA',
  'FATURADA',
  'CANCELADA',
  'FINALIZADA',
  'PERDIDA',
] as const

const WorkOrderSchema = z.object({
  id: z.string().optional(),
  customerId: z.string().min(1, 'Cliente é obrigatório'),
  vehicleId: z.string().optional(),
  responsibleId: z.string().optional(),
  problema: z.string().min(1, 'Descreve o problema reportado').max(2000),
  diagnostico: z.string().max(2000).optional(),
  trabalho: z.string().max(2000).optional(),
  observacoes: z.string().max(2000).optional(),
  kmEntrada: z.string().optional(),
  dataPrevista: z.string().optional(),
  estado: z.enum(STATUSES).optional(),
})

export type WorkOrderFormState = {
  ok: boolean
  errors?: Record<string, string>
  message?: string
  id?: string
}

export async function saveWorkOrder(
  prevState: WorkOrderFormState,
  formData: FormData
): Promise<WorkOrderFormState> {
  const raw = {
    id: formData.get('id')?.toString() || undefined,
    customerId: formData.get('customerId')?.toString() || '',
    vehicleId: formData.get('vehicleId')?.toString() || undefined,
    responsibleId: formData.get('responsibleId')?.toString() || undefined,
    problema: formData.get('problema')?.toString() || '',
    diagnostico: formData.get('diagnostico')?.toString() || undefined,
    trabalho: formData.get('trabalho')?.toString() || undefined,
    observacoes: formData.get('observacoes')?.toString() || undefined,
    kmEntrada: formData.get('kmEntrada')?.toString() || undefined,
    dataPrevista: formData.get('dataPrevista')?.toString() || undefined,
    estado: formData.get('estado')?.toString() || undefined,
  }
  const parsed = WorkOrderSchema.safeParse(raw)
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    parsed.error.errors.forEach((e) => {
      errors[e.path.join('.')] = e.message
    })
    return { ok: false, errors }
  }
  const data = parsed.data
  const currentUser = await getCurrentUser()

  const km =
    data.kmEntrada && /^\d+$/.test(data.kmEntrada.replace(/\D/g, ''))
      ? parseInt(data.kmEntrada.replace(/\D/g, ''), 10)
      : null

  const payload = {
    customerId: data.customerId,
    vehicleId: data.vehicleId || null,
    problema: data.problema,
    diagnostico: data.diagnostico || null,
    trabalho: data.trabalho || null,
    observacoes: data.observacoes || null,
    kmEntrada: km,
    dataPrevista: data.dataPrevista ? new Date(data.dataPrevista) : null,
    ...(data.estado && { estado: data.estado }),
  }

  try {
    if (data.id) {
      const before = await prisma.workOrder.findUnique({ where: { id: data.id } })
      const updated = await prisma.workOrder.update({
        where: { id: data.id },
        data: {
          ...payload,
          ...(data.responsibleId && { responsibleId: data.responsibleId }),
        },
      })
      await logAudit({
        entityType: 'WORK_ORDER',
        entityId: updated.id,
        action: 'UPDATE',
        summary: `Folha #${updated.numero} • ${updated.problema.slice(0, 60)}`,
        before,
        after: updated,
      })
      revalidatePath('/folhas')
      revalidatePath(`/folhas/${data.id}`)
      return { ok: true, id: data.id }
    }
    const created = await prisma.workOrder.create({
      data: {
        ...payload,
        responsibleId: data.responsibleId || currentUser.id,
      },
    })
    await logAudit({
      entityType: 'WORK_ORDER',
      entityId: created.id,
      action: 'CREATE',
      summary: `Folha #${created.numero} • ${created.problema.slice(0, 60)}`,
      after: created,
    })
    revalidatePath('/folhas')
    revalidatePath(`/clientes/${data.customerId}`)
    return { ok: true, id: created.id }
  } catch (e) {
    console.error(e)
    return { ok: false, message: 'Erro ao guardar folha de obra' }
  }
}

export async function deleteWorkOrder(id: string): Promise<WorkOrderFormState> {
  try {
    const wo = await prisma.workOrder.findUnique({ where: { id } })
    await prisma.workOrder.delete({ where: { id } })
    if (wo) {
      await logAudit({
        entityType: 'WORK_ORDER',
        entityId: id,
        action: 'DELETE',
        summary: `Folha #${wo.numero} • ${wo.problema.slice(0, 60)}`,
        before: wo,
      })
      revalidatePath(`/clientes/${wo.customerId}`)
    }
    revalidatePath('/folhas')
    return { ok: true }
  } catch (e) {
    console.error(e)
    return { ok: false, message: 'Erro ao eliminar folha de obra' }
  }
}

const StatusSchema = z.enum(STATUSES)

export async function changeStatus(
  id: string,
  estado: string
): Promise<WorkOrderFormState> {
  const parsed = StatusSchema.safeParse(estado)
  if (!parsed.success) return { ok: false, message: 'Estado inválido' }
  try {
    const dataConclusao =
      parsed.data === 'CONCLUIDA' || parsed.data === 'FATURADA'
        ? new Date()
        : null
    const before = await prisma.workOrder.findUnique({ where: { id } })
    const updated = await prisma.workOrder.update({
      where: { id },
      data: {
        estado: parsed.data,
        ...(dataConclusao !== null && { dataConclusao }),
      },
    })
    await logAudit({
      entityType: 'WORK_ORDER',
      entityId: id,
      action: 'STATUS_CHANGE',
      summary: `Folha #${updated.numero} → ${parsed.data}`,
      before: before ? { estado: before.estado } : undefined,
      after: { estado: updated.estado },
    })
    revalidatePath('/folhas')
    revalidatePath(`/folhas/${id}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, message: 'Erro ao atualizar estado' }
  }
}

const ResponsibleSchema = z.object({
  workOrderId: z.string().min(1),
  responsibleId: z.string().min(1),
})

export async function changeResponsible(formData: FormData): Promise<WorkOrderFormState> {
  const parsed = ResponsibleSchema.safeParse({
    workOrderId: formData.get('workOrderId')?.toString() || '',
    responsibleId: formData.get('responsibleId')?.toString() || '',
  })
  if (!parsed.success) return { ok: false, message: 'Responsavel invalido' }

  const { workOrderId, responsibleId } = parsed.data

  try {
    const [before, responsible] = await Promise.all([
      prisma.workOrder.findUnique({
        where: { id: workOrderId },
        select: { id: true, numero: true, customerId: true, responsibleId: true },
      }),
      prisma.user.findUnique({
        where: { id: responsibleId },
        select: { id: true, nome: true, active: true },
      }),
    ])

    if (!before) return { ok: false, message: 'Folha nao encontrada' }
    if (!responsible || !responsible.active) return { ok: false, message: 'Colaborador invalido' }

    const updated = await prisma.workOrder.update({
      where: { id: workOrderId },
      data: { responsibleId },
      select: { id: true, numero: true, responsibleId: true },
    })

    await logAudit({
      entityType: 'WORK_ORDER',
      entityId: workOrderId,
      action: 'UPDATE',
      summary: `Folha #${updated.numero} - responsavel ${responsible.nome}`,
      before: { responsibleId: before.responsibleId },
      after: { responsibleId: updated.responsibleId },
    })

    revalidatePath('/folhas')
    revalidatePath(`/folhas/${workOrderId}`)
    revalidatePath(`/clientes/${before.customerId}`)
    return { ok: true, id: workOrderId }
  } catch (e) {
    console.error(e)
    return { ok: false, message: 'Erro ao trocar responsavel' }
  }
}

// === Preview ===

export async function getWorkOrderPreview(id: string) {
  const [wo, txList, accounts, categories, templates, automationLogs] = await Promise.all([
    prisma.workOrder.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, nome: true, telefone: true, nif: true, createdAt: true } },
        vehicle: { select: { id: true, matricula: true, marca: true, modelo: true, ano: true } },
        responsible: { select: { id: true, nome: true, photoStoragePath: true } },
        items: { orderBy: { createdAt: 'asc' } },
      },
    }),
    prisma.transaction.findMany({
      where: { workOrderId: id, tipo: { in: ['ENTRADA', 'SAIDA'] }, categoryId: { not: null } },
      orderBy: { data: 'desc' },
      include: {
        account: { select: { nome: true } },
        category: { select: { nome: true, cor: true, icone: true } },
      },
    }),
    prisma.account.findMany({ where: { archived: false }, orderBy: { nome: 'asc' }, select: { id: true, nome: true, cor: true, icone: true } }),
    prisma.category.findMany({ where: { archived: false, tipo: { in: ['ENTRADA', 'SAIDA'] } }, orderBy: { nome: 'asc' }, select: { id: true, nome: true, tipo: true, cor: true, icone: true, parentId: true } }),
    prisma.automationTemplate.findMany({ where: { ativo: true }, orderBy: { createdAt: 'asc' }, select: { id: true, nome: true, tipo: true, trigger: true, triggerEstados: true, mensagem: true } }),
    prisma.automationLog.findMany({ where: { workOrderId: id }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, templateNome: true, mensagemEnviada: true, webhookOk: true, webhookResponse: true, createdAt: true } }),
  ])
  if (!wo) return null
  return {
    id: wo.id,
    numero: wo.numero,
    estado: wo.estado as string,
    problema: wo.problema,
    diagnostico: wo.diagnostico,
    trabalho: wo.trabalho,
    observacoes: wo.observacoes,
    kmEntrada: wo.kmEntrada,
    responsibleId: wo.responsibleId,
    responsible: wo.responsible
      ? {
          id: wo.responsible.id,
          nome: wo.responsible.nome,
          photoUrl: wo.responsible.photoStoragePath ? `/api/users/${wo.responsible.id}/photo` : null,
        }
      : null,
    dataAbertura: wo.dataAbertura.toISOString(),
    dataPrevista: wo.dataPrevista?.toISOString() ?? null,
    dataConclusao: wo.dataConclusao?.toISOString() ?? null,
    totalPecas: Number(wo.totalPecas),
    totalMaoObra: Number(wo.totalMaoObra),
    total: Number(wo.total),
    customer: { ...wo.customer, createdAt: wo.customer.createdAt.toISOString() },
    vehicle: wo.vehicle,
    items: wo.items.map((i) => ({ id: i.id, tipo: i.tipo as 'PECA' | 'MAO_OBRA', descricao: i.descricao, referencia: i.referencia, quantidade: Number(i.quantidade), precoUnit: Number(i.precoUnit), margem: i.margem !== null ? Number(i.margem) : null, iva: i.iva !== null ? Number(i.iva) : null, total: Number(i.total) })),
    transactions: txList.map((t) => ({ id: t.id, tipo: t.tipo as 'ENTRADA' | 'SAIDA', valor: Number(t.valor), descricao: t.descricao, data: t.data.toISOString(), accountId: t.accountId, categoryId: t.categoryId!, account: t.account, category: t.category!, agendado: t.agendado })),
    accounts,
    categories: categories.map((c) => ({ ...c, tipo: c.tipo as 'ENTRADA' | 'SAIDA' })),
    templates,
    automationLogs: automationLogs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString(), webhookResponse: l.webhookResponse ?? null })),
  }
}

// === Items ===

const ItemSchema = z.object({
  id: z.string().optional(),
  workOrderId: z.string().min(1),
  tipo: z.enum(['PECA', 'MAO_OBRA']),
  descricao: z.string().min(1, 'Descrição é obrigatória').max(200),
  referencia: z.string().max(100).optional(),
  quantidade: z.string().min(1, 'Quantidade obrigatória'),
  precoUnit: z.string().min(1, 'Preço obrigatório'),
  margem: z.string().optional(),
  iva: z.string().optional(),
})

export type ItemFormState = {
  ok: boolean
  errors?: Record<string, string>
  message?: string
}

function parseDec(value: string): number {
  // Aceita "1.234,56" ou "1234.56"
  const cleaned = value.replace(/\s/g, '').replace(/[^\d,.-]/g, '')
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned
  const num = parseFloat(normalized)
  return isNaN(num) ? 0 : num
}

function computeItemTotal(qtd: number, precoUnit: number, margem: number | null, iva: number | null): number {
  const m = margem ?? 0
  const i = iva ?? 0
  return +(qtd * precoUnit * (1 + m / 100) * (1 + i / 100)).toFixed(2)
}

async function recomputeTotals(workOrderId: string) {
  const items = await prisma.workOrderItem.findMany({ where: { workOrderId } })
  let totalPecas = new Prisma.Decimal(0)
  let totalMaoObra = new Prisma.Decimal(0)
  for (const it of items) {
    if (it.tipo === 'PECA') totalPecas = totalPecas.add(it.total)
    else totalMaoObra = totalMaoObra.add(it.total)
  }
  await prisma.workOrder.update({
    where: { id: workOrderId },
    data: {
      totalPecas,
      totalMaoObra,
      total: totalPecas.add(totalMaoObra),
    },
  })
}

export async function saveWorkOrderItem(
  prevState: ItemFormState,
  formData: FormData
): Promise<ItemFormState> {
  const raw = {
    id: formData.get('id')?.toString() || undefined,
    workOrderId: formData.get('workOrderId')?.toString() || '',
    tipo: formData.get('tipo')?.toString() || 'PECA',
    descricao: formData.get('descricao')?.toString() || '',
    referencia: formData.get('referencia')?.toString() || undefined,
    quantidade: formData.get('quantidade')?.toString() || '1',
    precoUnit: formData.get('precoUnit')?.toString() || '0',
    margem: formData.get('margem')?.toString() || undefined,
    iva: formData.get('iva')?.toString() || undefined,
  }
  const parsed = ItemSchema.safeParse(raw)
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    parsed.error.errors.forEach((e) => {
      errors[e.path.join('.')] = e.message
    })
    return { ok: false, errors }
  }
  const data = parsed.data
  const qtd = parseDec(data.quantidade)
  const precoUnit = parseEURToCents(data.precoUnit) / 100
  const referencia = data.referencia?.trim() || null
  const margem = data.margem && data.margem.trim() !== '' ? parseDec(data.margem) : null
  const iva = data.iva && data.iva.trim() !== '' ? parseDec(data.iva) : null
  const total = computeItemTotal(qtd, precoUnit, margem, iva)

  if (qtd <= 0) return { ok: false, errors: { quantidade: 'Quantidade deve ser maior que zero' } }
  if (precoUnit < 0) return { ok: false, errors: { precoUnit: 'Preço não pode ser negativo' } }
  if (margem !== null && (margem < 0 || margem > 999.99)) return { ok: false, errors: { margem: 'Margem inválida' } }
  if (iva !== null && (iva < 0 || iva > 100)) return { ok: false, errors: { iva: 'IVA deve estar entre 0 e 100' } }

  try {
    if (data.id) {
      await prisma.workOrderItem.update({
        where: { id: data.id },
        data: {
          tipo: data.tipo,
          descricao: data.descricao,
          referencia,
          quantidade: qtd,
          precoUnit,
          margem,
          iva,
          total,
        },
      })
    } else {
      await prisma.workOrderItem.create({
        data: {
          workOrderId: data.workOrderId,
          tipo: data.tipo,
          descricao: data.descricao,
          referencia,
          quantidade: qtd,
          precoUnit,
          margem,
          iva,
          total,
        },
      })
    }
    await recomputeTotals(data.workOrderId)
    revalidatePath(`/folhas/${data.workOrderId}`)
    revalidatePath('/folhas')
    return { ok: true }
  } catch (e) {
    console.error(e)
    return { ok: false, message: 'Erro ao guardar item' }
  }
}

type ItemFieldPatch = {
  descricao?: string
  referencia?: string | null
  quantidade?: number
  precoUnit?: number
  margem?: number | null
  iva?: number | null
}

export async function updateWorkOrderItemField(
  id: string,
  patch: ItemFieldPatch
): Promise<ItemFormState> {
  try {
    const item = await prisma.workOrderItem.findUnique({ where: { id } })
    if (!item) return { ok: false, message: 'Item não encontrado' }

    if (patch.quantidade !== undefined && patch.quantidade <= 0) {
      return { ok: false, errors: { quantidade: 'Quantidade deve ser maior que zero' } }
    }
    if (patch.precoUnit !== undefined && patch.precoUnit < 0) {
      return { ok: false, errors: { precoUnit: 'Preço não pode ser negativo' } }
    }
    if (patch.margem != null && (patch.margem < 0 || patch.margem > 999.99)) {
      return { ok: false, errors: { margem: 'Margem inválida' } }
    }
    if (patch.iva != null && (patch.iva < 0 || patch.iva > 100)) {
      return { ok: false, errors: { iva: 'IVA deve estar entre 0 e 100' } }
    }
    if (patch.descricao !== undefined && patch.descricao.trim() === '') {
      return { ok: false, errors: { descricao: 'Descrição é obrigatória' } }
    }

    const newQtd = patch.quantidade ?? Number(item.quantidade)
    const newPreco = patch.precoUnit ?? Number(item.precoUnit)
    const newMargem = patch.margem !== undefined ? patch.margem : (item.margem !== null ? Number(item.margem) : null)
    const newIva = patch.iva !== undefined ? patch.iva : (item.iva !== null ? Number(item.iva) : null)
    const total = computeItemTotal(newQtd, newPreco, newMargem, newIva)

    await prisma.workOrderItem.update({
      where: { id },
      data: {
        ...(patch.descricao !== undefined && { descricao: patch.descricao.trim() }),
        ...(patch.referencia !== undefined && { referencia: patch.referencia }),
        ...(patch.quantidade !== undefined && { quantidade: patch.quantidade }),
        ...(patch.precoUnit !== undefined && { precoUnit: patch.precoUnit }),
        ...(patch.margem !== undefined && { margem: patch.margem }),
        ...(patch.iva !== undefined && { iva: patch.iva }),
        total,
      },
    })
    await recomputeTotals(item.workOrderId)
    revalidatePath(`/folhas/${item.workOrderId}`)
    revalidatePath('/folhas')
    return { ok: true }
  } catch (e) {
    console.error(e)
    return { ok: false, message: 'Erro ao atualizar item' }
  }
}

export async function deleteWorkOrderItem(id: string): Promise<ItemFormState> {
  try {
    const item = await prisma.workOrderItem.findUnique({ where: { id } })
    if (!item) return { ok: false, message: 'Item não encontrado' }
    await prisma.workOrderItem.delete({ where: { id } })
    await recomputeTotals(item.workOrderId)
    revalidatePath(`/folhas/${item.workOrderId}`)
    revalidatePath('/folhas')
    return { ok: true }
  } catch (e) {
    return { ok: false, message: 'Erro ao eliminar item' }
  }
}
