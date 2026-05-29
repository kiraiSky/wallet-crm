'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

const CustomerSchema = z.object({
  id: z.string().optional(),
  nome: z.string().min(1, 'Nome é obrigatório').max(120),
  telefone: z.string().max(40).optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  nif: z
    .string()
    .regex(/^\d{9}$/u, 'NIF deve ter 9 dígitos')
    .optional()
    .or(z.literal('')),
  morada: z.string().max(300).optional(),
  observacoes: z.string().max(2000).optional(),
  aniversario: z.string().optional(),
  tag: z.enum(['VIP', 'RECORRENTE', 'NOVO', 'INATIVO']),
  linguagem: z.enum(['pt', 'en']).default('pt'),
})

export type CustomerFormState = {
  ok: boolean
  errors?: Record<string, string>
  message?: string
  id?: string
}

export async function saveCustomer(
  prevState: CustomerFormState,
  formData: FormData
): Promise<CustomerFormState> {
  const raw = {
    id: formData.get('id')?.toString() || undefined,
    nome: formData.get('nome')?.toString() || '',
    telefone: formData.get('telefone')?.toString() || undefined,
    email: formData.get('email')?.toString() || undefined,
    nif: formData.get('nif')?.toString() || undefined,
    morada: formData.get('morada')?.toString() || undefined,
    observacoes: formData.get('observacoes')?.toString() || undefined,
    aniversario: formData.get('aniversario')?.toString() || undefined,
    tag: formData.get('tag')?.toString() || 'NOVO',
    linguagem: formData.get('linguagem')?.toString() || 'pt',
  }
  const parsed = CustomerSchema.safeParse(raw)
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    parsed.error.errors.forEach((e) => {
      errors[e.path.join('.')] = e.message
    })
    return { ok: false, errors }
  }
  const data = parsed.data

  const payload = {
    nome: data.nome,
    telefone: data.telefone || null,
    email: data.email || null,
    nif: data.nif || null,
    morada: data.morada || null,
    observacoes: data.observacoes || null,
    aniversario: data.aniversario ? new Date(data.aniversario) : null,
    tag: data.tag,
    linguagem: data.linguagem,
  }

  try {
    if (data.id) {
      const before = await prisma.customer.findUnique({ where: { id: data.id } })
      const updated = await prisma.customer.update({ where: { id: data.id }, data: payload })
      await logAudit({
        entityType: 'CUSTOMER',
        entityId: updated.id,
        action: 'UPDATE',
        summary: `Cliente • ${updated.nome}`,
        before,
        after: updated,
      })
      revalidatePath('/clientes')
      revalidatePath(`/clientes/${data.id}`)
      return { ok: true, id: data.id }
    }
    const created = await prisma.customer.create({ data: payload })
    await logAudit({
      entityType: 'CUSTOMER',
      entityId: created.id,
      action: 'CREATE',
      summary: `Cliente • ${created.nome}`,
      after: created,
    })
    revalidatePath('/clientes')
    return { ok: true, id: created.id }
  } catch (e) {
    console.error(e)
    return { ok: false, message: 'Erro ao guardar cliente' }
  }
}

export async function deleteCustomer(id: string): Promise<CustomerFormState> {
  try {
    const before = await prisma.customer.findUnique({ where: { id } })
    await prisma.customer.delete({ where: { id } })
    if (before) {
      await logAudit({
        entityType: 'CUSTOMER',
        entityId: id,
        action: 'DELETE',
        summary: `Cliente • ${before.nome}`,
        before,
      })
    }
    revalidatePath('/clientes')
    return { ok: true }
  } catch (e) {
    console.error(e)
    return { ok: false, message: 'Erro ao eliminar cliente' }
  }
}

export async function archiveCustomer(id: string): Promise<CustomerFormState> {
  try {
    const updated = await prisma.customer.update({ where: { id }, data: { archived: true } })
    await logAudit({
      entityType: 'CUSTOMER',
      entityId: id,
      action: 'ARCHIVE',
      summary: `Cliente arquivado • ${updated.nome}`,
    })
    revalidatePath('/clientes')
    return { ok: true }
  } catch (e) {
    return { ok: false, message: 'Erro ao arquivar cliente' }
  }
}

// === Veículos ===

const VehicleSchema = z.object({
  id: z.string().optional(),
  customerId: z.string().min(1),
  matricula: z
    .string()
    .min(1, 'Matrícula é obrigatória')
    .max(20)
    .transform((s) => s.toUpperCase().trim()),
  marca: z.string().min(1, 'Marca é obrigatória').max(60),
  modelo: z.string().min(1, 'Modelo é obrigatório').max(60),
  ano: z
    .string()
    .optional()
    .transform((v) => (v && /^\d{4}$/.test(v) ? parseInt(v, 10) : null)),
  cor: z.string().max(40).optional(),
  km: z
    .string()
    .optional()
    .transform((v) => (v && /^\d+$/.test(v.replace(/\D/g, '')) ? parseInt(v.replace(/\D/g, ''), 10) : null)),
  observacoes: z.string().max(1000).optional(),
})

export type VehicleFormState = {
  ok: boolean
  errors?: Record<string, string>
  message?: string
  id?: string
}

export async function saveVehicle(
  prevState: VehicleFormState,
  formData: FormData
): Promise<VehicleFormState> {
  const raw = {
    id: formData.get('id')?.toString() || undefined,
    customerId: formData.get('customerId')?.toString() || '',
    matricula: formData.get('matricula')?.toString() || '',
    marca: formData.get('marca')?.toString() || '',
    modelo: formData.get('modelo')?.toString() || '',
    ano: formData.get('ano')?.toString() || undefined,
    cor: formData.get('cor')?.toString() || undefined,
    km: formData.get('km')?.toString() || undefined,
    observacoes: formData.get('observacoes')?.toString() || undefined,
  }
  const parsed = VehicleSchema.safeParse(raw)
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    parsed.error.errors.forEach((e) => {
      errors[e.path.join('.')] = e.message
    })
    return { ok: false, errors }
  }
  const data = parsed.data

  const payload = {
    matricula: data.matricula,
    marca: data.marca,
    modelo: data.modelo,
    ano: data.ano,
    cor: data.cor || null,
    km: data.km,
    observacoes: data.observacoes || null,
  }

  try {
    if (data.id) {
      const before = await prisma.vehicle.findUnique({ where: { id: data.id } })
      const updated = await prisma.vehicle.update({ where: { id: data.id }, data: payload })
      await logAudit({
        entityType: 'VEHICLE',
        entityId: updated.id,
        action: 'UPDATE',
        summary: `Viatura • ${updated.matricula} ${updated.marca} ${updated.modelo}`,
        before,
        after: updated,
      })
      revalidatePath(`/clientes/${data.customerId}`)
      return { ok: true, id: updated.id }
    } else {
      const created = await prisma.vehicle.create({
        data: { ...payload, customerId: data.customerId },
      })
      await logAudit({
        entityType: 'VEHICLE',
        entityId: created.id,
        action: 'CREATE',
        summary: `Viatura • ${created.matricula} ${created.marca} ${created.modelo}`,
        after: created,
      })
      revalidatePath(`/clientes/${data.customerId}`)
      return { ok: true, id: created.id }
    }
  } catch (e) {
    console.error(e)
    return { ok: false, message: 'Erro ao guardar viatura' }
  }
}

export async function deleteVehicle(id: string, customerId: string): Promise<VehicleFormState> {
  try {
    const before = await prisma.vehicle.findUnique({ where: { id } })
    await prisma.vehicle.delete({ where: { id } })
    if (before) {
      await logAudit({
        entityType: 'VEHICLE',
        entityId: id,
        action: 'DELETE',
        summary: `Viatura • ${before.matricula} ${before.marca} ${before.modelo}`,
        before,
      })
    }
    revalidatePath(`/clientes/${customerId}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, message: 'Erro ao eliminar viatura' }
  }
}

// === Quick summary (for the customer modal opened from any page) ===

export type CustomerQuickSummary = {
  id: string
  nome: string
  telefone: string | null
  email: string | null
  nif: string | null
  morada: string | null
  observacoes: string | null
  tag: 'VIP' | 'RECORRENTE' | 'NOVO' | 'INATIVO'
  vehicles: { id: string; matricula: string; marca: string; modelo: string; ano: number | null }[]
  recentWorkOrders: {
    id: string
    numero: number
    estado: string
    problema: string
    total: number
    dataAbertura: string
  }[]
  totalReceitas: number
  totalDespesas: number
  contagemFolhas: number
}

export async function getCustomerSummary(id: string): Promise<CustomerQuickSummary | null> {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      vehicles: { orderBy: { createdAt: 'desc' }, take: 10 },
      _count: { select: { workOrders: true } },
    },
  })
  if (!customer || customer.archived) return null

  const [recentWOs, txAgg] = await Promise.all([
    prisma.workOrder.findMany({
      where: { customerId: id },
      orderBy: { dataAbertura: 'desc' },
      take: 5,
      select: {
        id: true,
        numero: true,
        estado: true,
        problema: true,
        total: true,
        dataAbertura: true,
      },
    }),
    prisma.transaction.groupBy({
      by: ['tipo'],
      where: { customerId: id },
      _sum: { valor: true },
    }),
  ])

  return {
    id: customer.id,
    nome: customer.nome,
    telefone: customer.telefone,
    email: customer.email,
    nif: customer.nif,
    morada: customer.morada,
    observacoes: customer.observacoes,
    tag: customer.tag as CustomerQuickSummary['tag'],
    vehicles: customer.vehicles.map((v) => ({
      id: v.id,
      matricula: v.matricula,
      marca: v.marca,
      modelo: v.modelo,
      ano: v.ano,
    })),
    recentWorkOrders: recentWOs.map((wo) => ({
      id: wo.id,
      numero: wo.numero,
      estado: wo.estado as string,
      problema: wo.problema,
      total: Number(wo.total),
      dataAbertura: wo.dataAbertura.toISOString(),
    })),
    totalReceitas: Number(txAgg.find((a) => a.tipo === 'ENTRADA')?._sum.valor ?? 0),
    totalDespesas: Number(txAgg.find((a) => a.tipo === 'SAIDA')?._sum.valor ?? 0),
    contagemFolhas: customer._count.workOrders,
  }
}
