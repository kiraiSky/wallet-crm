'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { parseEURToCents } from '@/lib/format'
import { getCurrentUser } from '@/lib/current-user'
import { saveUpload, deleteUpload } from '@/lib/uploads'

const TransactionSchema = z.object({
  id: z.string().optional(),
  tipo: z.enum(['ENTRADA', 'SAIDA']),
  valor: z.string().min(1, 'Valor é obrigatório'),
  descricao: z.string().min(1, 'Descrição é obrigatória').max(200),
  data: z.string().min(1, 'Data é obrigatória'),
  accountId: z.string().min(1, 'Conta é obrigatória'),
  categoryId: z.string().min(1, 'Categoria é obrigatória'),
  observacao: z.string().optional(),
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

  try {
    if (data.id) {
      await prisma.transaction.update({
        where: { id: data.id },
        data: {
          tipo: data.tipo,
          valor: valorCents / 100,
          descricao: data.descricao,
          data: new Date(data.data),
          accountId: data.accountId,
          categoryId: data.categoryId,
          observacao: data.observacao || null,
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
        },
      })
    } else {
      await prisma.transaction.create({
        data: {
          tipo: data.tipo,
          valor: valorCents / 100,
          descricao: data.descricao,
          data: new Date(data.data),
          accountId: data.accountId,
          categoryId: data.categoryId,
          observacao: data.observacao || null,
          userId: user.id,
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
        },
      })
    }
    revalidatePath('/lancamentos')
    revalidatePath('/dashboard')
    revalidatePath('/caixas')
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
