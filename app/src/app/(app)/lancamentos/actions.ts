'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { parseEURToCents } from '@/lib/format'
import { getCurrentUser } from '@/lib/current-user'
import { saveUpload, deleteUpload } from '@/lib/uploads'
import { logAudit } from '@/lib/audit'

const TransactionSchema = z.object({
  id: z.string().optional(),
  tipo: z.enum(['ENTRADA', 'SAIDA']),
  valor: z.string().min(1, 'Valor é obrigatório'),
  descricao: z.string().min(1, 'Descrição é obrigatória').max(200),
  data: z.string().min(1, 'Data é obrigatória'),
  accountId: z.string().min(1, 'Conta é obrigatória'),
  categoryId: z.string().min(1, 'Categoria é obrigatória'),
  observacao: z.string().optional(),
  workOrderId: z.string().optional(),
  customerId: z.string().optional(),
  agendado: z.string().optional(),
  dataAgendada: z.string().optional(),
})

export type TransactionFormState = {
  ok: boolean
  errors?: Record<string, string>
  message?: string
}

const MAX_UPLOAD_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

export async function saveTransaction(
  prevState: TransactionFormState,
  formData: FormData
): Promise<TransactionFormState> {
  const parsed = TransactionSchema.safeParse({
    id: formData.get('id') || undefined,
    tipo: formData.get('tipo'),
    valor: formData.get('valor'),
    descricao: formData.get('descricao'),
    data: formData.get('data'),
    accountId: formData.get('accountId'),
    categoryId: formData.get('categoryId'),
    observacao: formData.get('observacao') || undefined,
    workOrderId: formData.get('workOrderId') || undefined,
    customerId: formData.get('customerId') || undefined,
    agendado: formData.get('agendado') || undefined,
    dataAgendada: formData.get('dataAgendada') || undefined,
  })

  if (!parsed.success) {
    const errors: Record<string, string> = {}
    parsed.error.errors.forEach((e) => {
      errors[e.path.join('.')] = e.message
    })
    return { ok: false, errors }
  }

  const data = parsed.data
  const valorCents = parseEURToCents(data.valor)
  if (valorCents <= 0) {
    return { ok: false, errors: { valor: 'Valor deve ser maior que zero' } }
  }

  const user = await getCurrentUser()

  // Validar coerência: tipo da categoria deve casar com tipo do lançamento
  const category = await prisma.category.findUnique({ where: { id: data.categoryId } })
  if (!category || category.tipo !== data.tipo) {
    return { ok: false, errors: { categoryId: 'Categoria não corresponde ao tipo do movimento' } }
  }

  // Anexo (opcional)
  const file = formData.get('attachment') as File | null
  let savedFile: Awaited<ReturnType<typeof saveUpload>> | null = null
  if (file && file.size > 0) {
    if (file.size > MAX_UPLOAD_SIZE) {
      return { ok: false, errors: { attachment: 'Ficheiro maior que 5MB' } }
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      return { ok: false, errors: { attachment: 'Formato não suportado (usa JPG, PNG, WebP ou PDF)' } }
    }
    savedFile = await saveUpload(file)
  }

  const isAgendado = data.agendado === 'true' || data.agendado === 'on' || data.agendado === '1'
  if (isAgendado && !data.dataAgendada) {
    return { ok: false, errors: { dataAgendada: 'Indica a data prevista do pagamento' } }
  }
  const dataAgendada = isAgendado && data.dataAgendada ? new Date(data.dataAgendada) : null

  try {
    const baseData = {
      tipo: data.tipo,
      valor: valorCents / 100,
      descricao: data.descricao,
      data: new Date(data.data),
      accountId: data.accountId,
      categoryId: data.categoryId,
      observacao: data.observacao || null,
      workOrderId: data.workOrderId || null,
      customerId: data.customerId || null,
      agendado: isAgendado,
      dataAgendada,
      ...(savedFile && {
        attachments: {
          create: {
            filename: savedFile.filename,
            storagePath: savedFile.storagePath,
            mimeType: savedFile.mimeType,
            size: savedFile.size,
          },
        },
      }),
    }

    let workOrder: { customerId: string } | null = null
    if (data.workOrderId) {
      workOrder = await prisma.workOrder.findUnique({
        where: { id: data.workOrderId },
        select: { customerId: true },
      })
    }

    if (data.id) {
      const before = await prisma.transaction.findUnique({ where: { id: data.id } })
      const updated = await prisma.transaction.update({ where: { id: data.id }, data: baseData })
      await logAudit({
        entityType: 'TRANSACTION',
        entityId: updated.id,
        action: 'UPDATE',
        summary: `${updated.tipo === 'ENTRADA' ? 'Entrada' : 'Saída'} • ${updated.descricao}`,
        before,
        after: updated,
      })
    } else {
      const created = await prisma.transaction.create({
        data: { ...baseData, userId: user.id },
      })
      await logAudit({
        entityType: 'TRANSACTION',
        entityId: created.id,
        action: 'CREATE',
        summary: `${created.tipo === 'ENTRADA' ? 'Entrada' : 'Saída'} • ${created.descricao}`,
        after: created,
      })
    }

    revalidatePath('/lancamentos')
    revalidatePath('/dashboard')
    revalidatePath('/caixas')
    if (workOrder) {
      revalidatePath(`/folhas`)
      revalidatePath(`/clientes/${workOrder.customerId}`)
    }
    if (data.customerId) revalidatePath(`/clientes/${data.customerId}`)
    return { ok: true }
  } catch (e) {
    console.error(e)
    if (savedFile) await deleteUpload(savedFile.storagePath).catch(() => {})
    return { ok: false, message: 'Erro ao guardar movimento' }
  }
}

export async function deleteTransaction(id: string): Promise<TransactionFormState> {
  const tx = await prisma.transaction.findUnique({
    where: { id },
    include: { attachments: true },
  })
  if (!tx) return { ok: false, message: 'Movimento não encontrado' }

  // Apaga anexos do disco
  for (const att of tx.attachments) {
    await deleteUpload(att.storagePath).catch(() => {})
  }
  await prisma.transaction.delete({ where: { id } })
  await logAudit({
    entityType: 'TRANSACTION',
    entityId: id,
    action: 'DELETE',
    summary: `${tx.tipo === 'ENTRADA' ? 'Entrada' : 'Saída'} • ${tx.descricao}`,
    before: tx,
  })

  revalidatePath('/lancamentos')
  revalidatePath('/dashboard')
  revalidatePath('/caixas')
  return { ok: true }
}

export async function duplicateTransaction(id: string): Promise<TransactionFormState> {
  const tx = await prisma.transaction.findUnique({ where: { id } })
  if (!tx) return { ok: false, message: 'Movimento não encontrado' }
  const user = await getCurrentUser()

  await prisma.transaction.create({
    data: {
      tipo: tx.tipo,
      valor: tx.valor,
      descricao: `${tx.descricao} (cópia)`,
      data: new Date(),
      accountId: tx.accountId,
      categoryId: tx.categoryId,
      observacao: tx.observacao,
      userId: user.id,
    },
  })
  revalidatePath('/lancamentos')
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function confirmScheduledTransaction(id: string): Promise<TransactionFormState> {
  const tx = await prisma.transaction.findUnique({ where: { id } })
  if (!tx) return { ok: false, message: 'Movimento não encontrado' }
  if (!tx.agendado) return { ok: false, message: 'Este movimento já está confirmado' }

  const updated = await prisma.transaction.update({
    where: { id },
    data: {
      agendado: false,
      confirmadoEm: new Date(),
      data: new Date(),
    },
  })
  await logAudit({
    entityType: 'TRANSACTION',
    entityId: id,
    action: 'UPDATE',
    summary: `Agendado confirmado • ${tx.descricao}`,
    before: tx,
    after: updated,
  })

  revalidatePath('/lancamentos')
  revalidatePath('/dashboard')
  revalidatePath('/caixas')
  if (tx.workOrderId) revalidatePath(`/folhas/${tx.workOrderId}`)
  return { ok: true }
}

export async function rescheduleTransaction(
  id: string,
  novaData: string
): Promise<TransactionFormState> {
  if (!novaData) return { ok: false, message: 'Indica a nova data' }
  const tx = await prisma.transaction.findUnique({ where: { id } })
  if (!tx) return { ok: false, message: 'Movimento não encontrado' }
  if (!tx.agendado) return { ok: false, message: 'Apenas movimentos agendados podem ser reagendados' }

  const updated = await prisma.transaction.update({
    where: { id },
    data: { dataAgendada: new Date(novaData) },
  })
  await logAudit({
    entityType: 'TRANSACTION',
    entityId: id,
    action: 'UPDATE',
    summary: `Agendado reagendado • ${tx.descricao}`,
    before: tx,
    after: updated,
  })

  revalidatePath('/lancamentos')
  revalidatePath('/dashboard')
  if (tx.workOrderId) revalidatePath(`/folhas/${tx.workOrderId}`)
  return { ok: true }
}
