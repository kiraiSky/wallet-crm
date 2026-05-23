'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/current-user'
import {
  fetchMoloniDocumentSets,
  searchMoloniCustomerByVat,
  createMoloniCustomer,
  createMoloniInvoiceFromWorkOrder,
} from '@/lib/moloni'
import { logAudit } from '@/lib/audit'

export type MoloniDocumentSetOption = {
  document_set_id: number
  name: string
}

/** Carrega os document sets disponíveis para o utilizador escolher */
export async function getMoloniDocumentSets(): Promise<{
  ok: boolean
  sets?: MoloniDocumentSetOption[]
  message?: string
}> {
  await requireOwner()

  const connection = await prisma.moloniConnection.findFirst({
    where: { companyId: { not: null } },
    orderBy: { connectedAt: 'desc' },
  })
  if (!connection?.companyId) {
    return { ok: false, message: 'Moloni não está ligado ou empresa não seleccionada.' }
  }

  try {
    const sets = await fetchMoloniDocumentSets(connection.id, connection.companyId)
    return { ok: true, sets: sets.map((s) => ({ document_set_id: s.document_set_id, name: s.name })) }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Erro ao carregar séries Moloni' }
  }
}

/** Cria a fatura Moloni para uma Folha de Obra */
export async function createMoloniInvoice(
  workOrderId: string,
  documentSetId: number,
  docType: 'invoices' | 'receipts',
) {
  await requireOwner()

  const wo = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: {
      customer: true,
      items: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!wo) return { ok: false, message: 'Folha de obra não encontrada.' }
  if (wo.moloniDocumentId) return { ok: false, message: 'Esta folha já tem uma fatura Moloni criada.' }
  if (wo.items.length === 0) return { ok: false, message: 'A folha não tem itens para faturar.' }

  const connection = await prisma.moloniConnection.findFirst({
    where: { companyId: { not: null } },
    orderBy: { connectedAt: 'desc' },
  })
  if (!connection?.companyId) {
    return { ok: false, message: 'Moloni não está ligado ou empresa não seleccionada.' }
  }

  try {
    // 1. Encontrar ou criar cliente Moloni por NIF
    let moloniCustomerId: number

    if (wo.customer.nif) {
      const existing = await searchMoloniCustomerByVat(connection.id, connection.companyId, wo.customer.nif)
      if (existing) {
        moloniCustomerId = existing.customer_id
      } else {
        moloniCustomerId = await createMoloniCustomer(connection.id, connection.companyId, {
          name: wo.customer.nome,
          vat: wo.customer.nif,
          email: wo.customer.email ?? undefined,
          phone: wo.customer.telefone ?? undefined,
          address: wo.customer.morada ?? undefined,
        })
      }
    } else {
      // Sem NIF — usar consumidor final
      moloniCustomerId = await createMoloniCustomer(connection.id, connection.companyId, {
        name: wo.customer.nome,
        phone: wo.customer.telefone ?? undefined,
      })
    }

    // 2. Mapear itens da folha para produtos Moloni
    const items = wo.items.map((item) => ({
      descricao: item.referencia ? `[${item.referencia}] ${item.descricao}` : item.descricao,
      quantidade: Number(item.quantidade),
      precoUnit: Number(item.precoUnit),
      iva: item.iva !== null ? Number(item.iva) : null,
    }))

    // 3. Criar documento Moloni
    const documentId = await createMoloniInvoiceFromWorkOrder(
      connection.id,
      connection.companyId,
      documentSetId,
      moloniCustomerId,
      wo.numero,
      items,
      docType,
    )

    // 4. Guardar referência na folha + mudar estado para FATURADA
    const docTypeLabel = docType === 'invoices' ? 'FT' : 'FR'
    await prisma.workOrder.update({
      where: { id: workOrderId },
      data: {
        moloniDocumentId: documentId,
        moloniDocumentType: docTypeLabel,
        estado: 'FATURADA',
      },
    })

    await logAudit({
      entityType: 'WORK_ORDER',
      entityId: workOrderId,
      action: 'UPDATE',
      summary: `Fatura Moloni criada: ${docTypeLabel} #${documentId}`,
      after: { moloniDocumentId: documentId, moloniDocumentType: docTypeLabel },
    })

    revalidatePath(`/folhas/${workOrderId}`)
    revalidatePath('/folhas')

    return { ok: true, documentId, docType: docTypeLabel }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Erro ao criar fatura Moloni' }
  }
}
