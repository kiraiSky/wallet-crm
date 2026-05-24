'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/current-user'
import { logAudit } from '@/lib/audit'
import {
  createMoloniInvoiceReceiptForCaucao,
  searchMoloniCustomerByVat,
  createMoloniCustomer,
} from '@/lib/moloni'

const createCaucaoSchema = z.object({
  workOrderId: z.string().min(1),
  valor: z.number().positive('Valor tem de ser positivo'),
  data: z.string().min(1),
  notas: z.string().optional().nullable(),
  // Criar transação ENTRADA (entra logo no saldo da conta)
  criarTransacao: z.boolean().default(false),
  accountId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  // Emitir Fatura-Recibo (FR) no Moloni
  emitirMoloniFR: z.boolean().default(false),
  moloniDocumentSetId: z.number().optional().nullable(),
  // NIF efectivo para a FR (segue o mesmo padrão da fatura final)
  moloniCustomerMode: z.enum(['final', 'identified']).optional(),
  moloniOverrideNif: z.string().optional().nullable(),
})

export type CreateCaucaoInput = z.infer<typeof createCaucaoSchema>

export async function createCaucao(input: CreateCaucaoInput) {
  const user = await requireOwner()
  const parsed = createCaucaoSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, message: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }
  const p = parsed.data

  const wo = await prisma.workOrder.findUnique({
    where: { id: p.workOrderId },
    select: {
      id: true,
      numero: true,
      customerId: true,
      customer: { select: { nome: true, nif: true, email: true, telefone: true, morada: true } },
      caucoes: { select: { valor: true } },
      total: true,
    },
  })
  if (!wo) return { ok: false as const, message: 'Folha não encontrada.' }

  // Validar que a caução não excede o restante a faturar
  const jaPago = wo.caucoes.reduce((acc, c) => acc + Number(c.valor), 0)
  const restante = Number(wo.total) - jaPago
  if (Number(wo.total) > 0 && p.valor > restante + 0.001) {
    return {
      ok: false as const,
      message: `Caução (${p.valor.toFixed(2)} €) excede o restante a pagar (${restante.toFixed(2)} €).`,
    }
  }

  // 1. Opcional: criar Transaction de ENTRADA
  let transactionId: string | undefined
  if (p.criarTransacao) {
    if (!p.accountId) {
      return { ok: false as const, message: 'Conta obrigatória ao criar transação.' }
    }
    const tx = await prisma.transaction.create({
      data: {
        tipo: 'ENTRADA',
        valor: p.valor,
        descricao: `Caução • Folha #${wo.numero}`,
        data: new Date(p.data),
        accountId: p.accountId,
        categoryId: p.categoryId ?? undefined,
        userId: user.id,
        workOrderId: wo.id,
        customerId: wo.customerId,
        observacao: p.notas ?? undefined,
      },
    })
    transactionId = tx.id
  }

  // 2. Opcional: emitir Fatura-Recibo no Moloni
  let moloniDocumentId: number | undefined
  let moloniDocumentType: string | undefined
  if (p.emitirMoloniFR) {
    if (!p.moloniDocumentSetId) {
      return { ok: false as const, message: 'Série documental Moloni obrigatória para emitir FR.' }
    }
    const customerMode = p.moloniCustomerMode ?? (wo.customer.nif ? 'identified' : 'final')
    const overrideNif = p.moloniOverrideNif?.trim() || null
    if (customerMode === 'identified' && (!overrideNif || !/^\d{9}$/.test(overrideNif))) {
      return { ok: false as const, message: 'NIF inválido — deve ter 9 dígitos.' }
    }

    const connection = await prisma.moloniConnection.findFirst({
      where: { companyId: { not: null } },
      orderBy: { connectedAt: 'desc' },
    })
    if (!connection?.companyId) {
      return { ok: false as const, message: 'Moloni não está ligado ou empresa não seleccionada.' }
    }

    try {
      // Resolver cliente Moloni (mesma lógica da fatura final)
      let moloniCustomerId: number
      if (customerMode === 'final') {
        const cf = await searchMoloniCustomerByVat(connection.id, connection.companyId, '999999990')
        moloniCustomerId = cf?.customer_id ?? (await createMoloniCustomer(connection.id, connection.companyId, {
          name: 'Consumidor Final', vat: '999999990',
        }))
      } else {
        const existing = await searchMoloniCustomerByVat(connection.id, connection.companyId, overrideNif!)
        if (existing) {
          moloniCustomerId = existing.customer_id
        } else {
          moloniCustomerId = await createMoloniCustomer(connection.id, connection.companyId, {
            name: wo.customer.nome,
            vat: overrideNif!,
            email: wo.customer.email ?? undefined,
            phone: wo.customer.telefone ?? undefined,
            address: wo.customer.morada ?? undefined,
          })
        }
      }

      const extraNotes = customerMode === 'final' ? `Cliente: ${wo.customer.nome}` : undefined

      moloniDocumentId = await createMoloniInvoiceReceiptForCaucao(
        connection.id,
        connection.companyId,
        p.moloniDocumentSetId,
        moloniCustomerId,
        wo.numero,
        p.valor,
        23, // IVA: assumimos 23% para serviços de oficina. (futuro: configurável)
        extraNotes,
      )
      moloniDocumentType = 'FR'
    } catch (e) {
      // Se a transação já foi criada, mantemos — só falhou o lado Moloni
      const msg = e instanceof Error ? e.message : 'Erro ao emitir FR Moloni'
      return { ok: false as const, message: `Caução não foi guardada: ${msg}` }
    }
  }

  // 3. Guardar caução
  const caucao = await prisma.workOrderCaucao.create({
    data: {
      workOrderId: wo.id,
      valor: p.valor,
      data: new Date(p.data),
      notas: p.notas ?? undefined,
      transactionId,
      moloniDocumentId,
      moloniDocumentType,
    },
  })

  await logAudit({
    entityType: 'WORK_ORDER',
    entityId: wo.id,
    action: 'UPDATE',
    summary: `Caução: ${p.valor.toFixed(2)} €${transactionId ? ' • transação' : ''}${moloniDocumentId ? ` • FR #${moloniDocumentId}` : ''}`,
    after: { caucaoId: caucao.id, valor: p.valor, transactionId, moloniDocumentId },
  })

  revalidatePath(`/folhas/${wo.id}`)
  revalidatePath('/folhas')
  return { ok: true as const, caucaoId: caucao.id, moloniDocumentId }
}

export async function deleteCaucao(caucaoId: string) {
  await requireOwner()
  const c = await prisma.workOrderCaucao.findUnique({
    where: { id: caucaoId },
    select: {
      id: true,
      workOrderId: true,
      transactionId: true,
      valor: true,
      moloniDocumentId: true,
      moloniDocumentType: true,
    },
  })
  if (!c) return { ok: false as const, message: 'Caução não encontrada.' }
  if (c.moloniDocumentId) {
    return {
      ok: false as const,
      message: `Não é possível eliminar — já tem ${c.moloniDocumentType ?? 'FR'} #${c.moloniDocumentId} emitida no Moloni. Anula esse documento primeiro lá.`,
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.workOrderCaucao.delete({ where: { id: caucaoId } })
    if (c.transactionId) {
      // SetNull já estaria em vigor pela FK; mas se a caução foi eliminada, queremos
      // que a transação também desapareça (utilizador espera reverter completamente).
      await tx.transaction.delete({ where: { id: c.transactionId } }).catch(() => null)
    }
  })

  await logAudit({
    entityType: 'WORK_ORDER',
    entityId: c.workOrderId,
    action: 'UPDATE',
    summary: `Caução eliminada: ${Number(c.valor).toFixed(2)} €`,
    before: c,
  })

  revalidatePath(`/folhas/${c.workOrderId}`)
  revalidatePath('/folhas')
  return { ok: true as const }
}
