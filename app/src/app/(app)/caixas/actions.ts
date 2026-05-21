'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { parseEURToCents } from '@/lib/format'
import { getCurrentUser } from '@/lib/current-user'
import { logAudit } from '@/lib/audit'

const AccountSchema = z.object({
  id: z.string().optional(),
  nome: z.string().min(1, 'Nome é obrigatório').max(50),
  tipo: z.enum(['DINHEIRO', 'BANCO', 'CARTAO']),
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
  const saldoInicial = parseEURToCents(data.saldoInicial) / 100

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
    return { ok: false, message: 'Erro ao guardar conta' }
  }
}

async function getOrCreateCategory(nome: string, tipo: 'ENTRADA' | 'SAIDA' | 'TRANSFERENCIA', cor: string, icone: string) {
  const existing = await prisma.category.findFirst({ where: { nome, tipo, parentId: null } })
  if (existing) return existing
  return prisma.category.create({ data: { nome, tipo, cor, icone } })
}

export async function createTransfer(
  prevState: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  const fromAccountId = formData.get('fromAccountId') as string
  const toAccountId = formData.get('toAccountId') as string
  const valor = formData.get('valor') as string
  const descricao = (formData.get('descricao') as string) || 'Transferência entre contas'
  const data = formData.get('data') as string

  if (!fromAccountId || !toAccountId || !valor || !data) {
    return { ok: false, errors: { geral: 'Preenche todos os campos' } }
  }
  if (fromAccountId === toAccountId) {
    return { ok: false, errors: { toAccountId: 'Conta de destino deve ser diferente da origem' } }
  }

  const valorCents = parseEURToCents(valor)
  if (valorCents <= 0) {
    return { ok: false, errors: { valor: 'Valor deve ser maior que zero' } }
  }

  const user = await getCurrentUser()

  try {
    const tx = await prisma.transaction.create({
      data: {
        tipo: 'TRANSFERENCIA',
        valor: valorCents / 100,
        descricao,
        data: new Date(data),
        accountId: fromAccountId,
        toAccountId,
        userId: user.id,
      },
    })
    await logAudit({
      entityType: 'TRANSACTION',
      entityId: tx.id,
      action: 'CREATE',
      summary: `Transferência • ${descricao}`,
      after: tx,
    })

    revalidatePath('/caixas')
    revalidatePath('/lancamentos')
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (e) {
    console.error(e)
    return { ok: false, message: 'Erro ao criar transferência' }
  }
}

export async function adjustBalance(
  prevState: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  const accountId = formData.get('accountId') as string
  const saldoReal = formData.get('saldoReal') as string
  const saldoAtualStr = formData.get('saldoAtual') as string

  if (!accountId || !saldoReal || !saldoAtualStr) {
    return { ok: false, message: 'Dados inválidos' }
  }

  const saldoRealCents = parseEURToCents(saldoReal)
  const saldoAtualCents = Math.round(parseFloat(saldoAtualStr) * 100)
  const diff = saldoRealCents - saldoAtualCents

  if (Math.abs(diff) < 1) {
    return { ok: false, message: 'O saldo já está correto' }
  }

  const user = await getCurrentUser()
  // diff > 0 → real > atual → adicionar dinheiro → ENTRADA
  // diff < 0 → real < atual → remover dinheiro → SAIDA
  const tipo: 'ENTRADA' | 'SAIDA' = diff > 0 ? 'ENTRADA' : 'SAIDA'
  const valorAjuste = Math.abs(diff) / 100

  const cat = await getOrCreateCategory('Ajuste de saldo', tipo, 'amber', 'sliders-horizontal')

  try {
    const tx = await prisma.transaction.create({
      data: {
        tipo,
        valor: valorAjuste,
        descricao: 'Ajuste de saldo',
        data: new Date(),
        accountId,
        categoryId: cat.id,
        userId: user.id,
      },
    })
    await logAudit({
      entityType: 'TRANSACTION',
      entityId: tx.id,
      action: 'CREATE',
      summary: `Ajuste de saldo • ${tipo === 'ENTRADA' ? '+' : '-'}${valorAjuste.toFixed(2)}€`,
      after: tx,
    })

    revalidatePath('/caixas')
    revalidatePath('/lancamentos')
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (e) {
    console.error(e)
    return { ok: false, message: 'Erro ao ajustar saldo' }
  }
}

export async function deleteAccount(id: string): Promise<AccountFormState> {
  const count = await prisma.transaction.count({ where: { accountId: id } })
  if (count > 0) {
    // Não eliminar, apenas arquivar — preserva integridade dos movimentos
    await prisma.account.update({ where: { id }, data: { archived: true } })
    revalidatePath('/caixas')
    return { ok: true, message: `Conta arquivada (${count} movimentos associados).` }
  }
  await prisma.account.delete({ where: { id } })
  revalidatePath('/caixas')
  revalidatePath('/dashboard')
  return { ok: true }
}
