'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { parseEURToCents } from '@/lib/format'
import { logAudit } from '@/lib/audit'

const STATUSES = [
  'ABERTA',
  'EM_DIAGNOSTICO',
  'AGUARDA_PECAS',
  'EM_REPARACAO',
  'CONCLUIDA',
  'FATURADA',
  'CANCELADA',
] as const

const WorkOrderSchema = z.object({
  id: z.string().optional(),
  customerId: z.string().min(1, 'Cliente é obrigatório'),
  vehicleId: z.string().optional(),
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
      const updated = await prisma.workOrder.update({ where: { id: data.id }, data: payload })
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
    const created = await prisma.workOrder.create({ data: payload })
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

// === Preview ===

export async function getWorkOrderPreview(id: string) {
  const wo = await prisma.workOrder.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, nome: true, telefone: true } },
      vehicle: { select: { id: true, matricula: true, marca: true, modelo: true, ano: true } },
      items: { orderBy: { createdAt: 'asc' } },
    },
  })
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
    dataAbertura: wo.dataAbertura.toISOString(),
    dataPrevista: wo.dataPrevista?.toISOString() ?? null,
    dataConclusao: wo.dataConclusao?.toISOString() ?? null,
    totalPecas: Number(wo.totalPecas),
    totalMaoObra: Number(wo.totalMaoObra),
    total: Number(wo.total),
    customer: wo.customer,
    vehicle: wo.vehicle,
    items: wo.items.map((i) => ({
      id: i.id,
      tipo: i.tipo as string,
      descricao: i.descricao,
      quantidade: Number(i.quantidade),
      precoUnit: Number(i.precoUnit),
      total: Number(i.total),
    })),
  }
}

// === Items ===

const ItemSchema = z.object({
  id: z.string().optional(),
  workOrderId: z.string().min(1),
  tipo: z.enum(['PECA', 'MAO_OBRA']),
  descricao: z.string().min(1, 'Descrição é obrigatória').max(200),
  quantidade: z.string().min(1, 'Quantidade obrigatória'),
  precoUnit: z.string().min(1, 'Preço obrigatório'),
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
    quantidade: formData.get('quantidade')?.toString() || '1',
    precoUnit: formData.get('precoUnit')?.toString() || '0',
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
  const total = +(qtd * precoUnit).toFixed(2)

  if (qtd <= 0) return { ok: false, errors: { quantidade: 'Quantidade deve ser maior que zero' } }
  if (precoUnit < 0) return { ok: false, errors: { precoUnit: 'Preço não pode ser negativo' } }

  try {
    if (data.id) {
      await prisma.workOrderItem.update({
        where: { id: data.id },
        data: {
          tipo: data.tipo,
          descricao: data.descricao,
          quantidade: qtd,
          precoUnit,
          total,
        },
      })
    } else {
      await prisma.workOrderItem.create({
        data: {
          workOrderId: data.workOrderId,
          tipo: data.tipo,
          descricao: data.descricao,
          quantidade: qtd,
          precoUnit,
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
