'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { parseBRLToCents } from '@/lib/format'

const AccountSchema = z.object({
  id: z.string().optional(),
  nome: z.string().min(1, 'Nome é obrigatório').max(50),
  tipo: z.enum(['DINHEIRO', 'BANCO', 'PIX', 'CARTAO']),
  saldoInicial: z.string().default('0,00'),
  cor: z.string().default('emerald'),
  icone: z.string().default('banknote'),
})

export type AccountFormState = {
  ok: boolean
  errors?: Record<string, string>
  message?: string
}

export async function saveAccount(prevState: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const raw = Object.fromEntries(formData)
  const parsed = AccountSchema.safeParse(raw)
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    parsed.error.errors.forEach((e) => {
      errors[e.path.join('.')] = e.message
    })
    return { ok: false, errors }
  }
  const data = parsed.data
  const saldoInicial = parseBRLToCents(data.saldoInicial) / 100

  try {
    if (data.id) {
      await prisma.account.update({
        where: { id: data.id },
        data: {
          nome: data.nome,
          tipo: data.tipo,
          saldoInicial,
          cor: data.cor,
          icone: data.icone,
        },
      })
    } else {
      await prisma.account.create({
        data: {
          nome: data.nome,
          tipo: data.tipo,
          saldoInicial,
          cor: data.cor,
          icone: data.icone,
        },
      })
    }
    revalidatePath('/caixas')
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (e) {
    return { ok: false, message: 'Erro ao salvar caixa' }
  }
}

export async function deleteAccount(id: string): Promise<AccountFormState> {
  const count = await prisma.transaction.count({ where: { accountId: id } })
  if (count > 0) {
    // Não excluir, apenas arquivar — preserva integridade dos lançamentos
    await prisma.account.update({ where: { id }, data: { archived: true } })
    revalidatePath('/caixas')
    return { ok: true, message: `Caixa arquivado (${count} lançamentos vinculados).` }
  }
  await prisma.account.delete({ where: { id } })
  revalidatePath('/caixas')
  revalidatePath('/dashboard')
  return { ok: true }
}
