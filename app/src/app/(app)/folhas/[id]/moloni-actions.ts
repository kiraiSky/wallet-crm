'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/current-user'
import {
  fetchMoloniDocumentSets,
  searchMoloniCustomerByVat,
  createMoloniCustomer,
  createMoloniInvoiceFromWorkOrder,
  getMoloniDocumentPdfUrl,
} from '@/lib/moloni'
import { logAudit } from '@/lib/audit'

export type MoloniDocumentSetOption = {
  document_set_id: number
  name: string
}

/** Carrega todas as séries documentais disponíveis no Moloni */
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
    const allSets = await fetchMoloniDocumentSets(connection.id, connection.companyId)

    // Só mostrar séries que têm tipos de documento configurados (as vazias não funcionam)
    const configured = allSets.filter((s) => s.document_types_numbers && s.document_types_numbers.length > 0)
    const sets = configured.length > 0 ? configured : allSets

    return {
      ok: true,
      sets: sets.map((s) => ({ document_set_id: s.document_set_id, name: s.name })),
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Erro ao carregar séries Moloni' }
  }
}

/** Obtém o URL do PDF de uma fatura Moloni */
export async function getMoloniInvoicePdfUrl(workOrderId: string): Promise<{
  ok: boolean
  url?: string
  message?: string
}> {
  await requireOwner()

  const wo = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: { moloniDocumentId: true, moloniDocumentType: true },
  })
  if (!wo?.moloniDocumentId || !wo?.moloniDocumentType) {
    return { ok: false, message: 'Fatura Moloni não encontrada nesta folha.' }
  }

  const connection = await prisma.moloniConnection.findFirst({
    where: { companyId: { not: null } },
    orderBy: { connectedAt: 'desc' },
  })
  if (!connection?.companyId) {
    return { ok: false, message: 'Moloni não está ligado.' }
  }

  try {
    const url = await getMoloniDocumentPdfUrl(
      connection.id,
      connection.companyId,
      wo.moloniDocumentId,
      wo.moloniDocumentType,
    )
    return { ok: true, url }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Erro ao obter PDF Moloni' }
  }
}

/** Cria a fatura Moloni para uma Folha de Obra */
export async function createMoloniInvoice(
  workOrderId: string,
  documentSetId: number,
  docType: 'invoices' | 'quotes',
  options?: {
    customerMode?: 'final' | 'identified'
    overrideNif?: string | null
  },
) {
  const customerMode = options?.customerMode ?? 'identified'
  const overrideNif = options?.overrideNif?.trim() || null

  // Validação simples do NIF quando o utilizador escolheu identificado
  if (customerMode === 'identified' && (!overrideNif || !/^\d{9}$/.test(overrideNif))) {
    return { ok: false, message: 'NIF inválido — deve ter 9 dígitos.' }
  }

  await requireOwner()

  const wo = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: {
      customer: true,
      items: { orderBy: { createdAt: 'asc' } },
      caucoes: { orderBy: { data: 'asc' } },
    },
  })
  if (!wo) return { ok: false, message: 'Folha de obra não encontrada.' }
  if (wo.moloniDocumentId) return { ok: false, message: 'Esta folha já tem uma fatura Moloni criada.' }
  if (wo.items.length === 0) return { ok: false, message: 'A folha não tem itens para faturar.' }

  // Cauções já recebidas — abatem ao total da fatura final
  const totalCaucoes = wo.caucoes.reduce((acc, c) => acc + Number(c.valor), 0)
  const totalFolha = Number(wo.total)
  const restante = totalFolha - totalCaucoes
  if (totalCaucoes > 0 && restante <= 0.005) {
    return {
      ok: false,
      message: `Folha já está totalmente paga pelas cauções (${totalCaucoes.toFixed(2)} €). Não há nada para faturar.`,
    }
  }

  const connection = await prisma.moloniConnection.findFirst({
    where: { companyId: { not: null } },
    orderBy: { connectedAt: 'desc' },
  })
  if (!connection?.companyId) {
    return { ok: false, message: 'Moloni não está ligado ou empresa não seleccionada.' }
  }

  try {
    // 1. Decidir cliente conforme escolha do utilizador
    let moloniCustomerId: number
    // NIF efectivo: o override do utilizador (se identificado) tem prioridade sobre o gravado
    const effectiveNif = customerMode === 'identified' ? overrideNif : null

    if (customerMode === 'final') {
      // Forçar Consumidor Final (NIF 999999990)
      const consumidorFinal = await searchMoloniCustomerByVat(connection.id, connection.companyId, '999999990')
      if (consumidorFinal) {
        moloniCustomerId = consumidorFinal.customer_id
      } else {
        // Caso raro: criar Consumidor Final se ainda não existir
        moloniCustomerId = await createMoloniCustomer(connection.id, connection.companyId, {
          name: 'Consumidor Final',
          vat: '999999990',
        })
      }
    } else if (effectiveNif) {
      // Cliente identificado — procurar pelo NIF, criar se não existir
      const existing = await searchMoloniCustomerByVat(connection.id, connection.companyId, effectiveNif)
      if (existing) {
        moloniCustomerId = existing.customer_id
      } else {
        moloniCustomerId = await createMoloniCustomer(connection.id, connection.companyId, {
          name: wo.customer.nome,
          vat: effectiveNif,
          email: wo.customer.email ?? undefined,
          phone: wo.customer.telefone ?? undefined,
          address: wo.customer.morada ?? undefined,
        })
      }
    } else {
      // Salvaguarda — não deveria chegar aqui devido à validação acima
      return { ok: false, message: 'NIF em falta para cliente identificado.' }
    }

    // 2. Construir linhas Moloni
    //    - Sem cauções → linha por item (detalhe completo na fatura)
    //    - Com cauções → uma linha única "Saldo restante" com valor=(total-cauções),
    //      e o detalhe dos serviços/peças vai para as notas (caso contrário a soma das
    //      linhas não bateria certo com o restante).
    let items: Array<{
      descricao: string
      quantidade: number
      precoUnit: number
      iva: number | null
      isLabor?: boolean
    }>

    if (totalCaucoes > 0) {
      // IVA "médio" da folha — usamos o IVA mais frequente; para simplicidade, 23% se houver
      const ivaCandidato = wo.items.find((it) => it.iva !== null)?.iva
      const ivaFinal = ivaCandidato !== null && ivaCandidato !== undefined ? Number(ivaCandidato) : 23
      // O restante já inclui IVA (vem de wo.total que é com IVA); convertemos para base
      const precoBase = restante / (1 + ivaFinal / 100)
      items = [
        {
          descricao: `Saldo restante — Folha de Obra nº ${wo.numero}`,
          quantidade: 1,
          precoUnit: precoBase,
          iva: ivaFinal,
          isLabor: false,
        },
      ]
    } else {
      items = wo.items.map((item) => {
        const custo = Number(item.precoUnit)
        const margem = item.margem !== null ? Number(item.margem) : 0
        const precoVenda = custo * (1 + margem / 100)
        return {
          descricao: item.referencia ? `[${item.referencia}] ${item.descricao}` : item.descricao,
          quantidade: Number(item.quantidade),
          precoUnit: precoVenda,
          iva: item.iva !== null ? Number(item.iva) : null,
          isLabor: !item.referencia,
        }
      })
    }

    // 3. Construir notas: cliente sem NIF (se aplicável) + cauções já facturadas
    const noteParts: string[] = []
    if (customerMode === 'final') noteParts.push(`Cliente: ${wo.customer.nome}`)
    if (totalCaucoes > 0) {
      const detalheItens = wo.items
        .map((it) => {
          const base = Number(it.precoUnit) * Number(it.quantidade) * (1 + (it.margem ? Number(it.margem) : 0) / 100)
          const comIva = base * (1 + (it.iva ? Number(it.iva) : 0) / 100)
          const ref = it.referencia ? `[${it.referencia}] ` : ''
          return `• ${ref}${it.descricao} (${Number(it.quantidade)}x): ${comIva.toFixed(2)} €`
        })
        .join('\n')
      const fr = wo.caucoes
        .filter((c) => c.moloniDocumentId)
        .map((c) => `${c.moloniDocumentType ?? 'FR'} #${c.moloniDocumentId}: ${Number(c.valor).toFixed(2)} €`)
        .join(', ')
      noteParts.push(
        `Detalhe dos trabalhos:\n${detalheItens}`,
        `Total trabalhos: ${totalFolha.toFixed(2)} €`,
        `Adiantamentos já facturados: ${totalCaucoes.toFixed(2)} €${fr ? ` (${fr})` : ''}`,
      )
    }
    const extraNotes = noteParts.length > 0 ? noteParts.join(' | ') : undefined
    const documentId = await createMoloniInvoiceFromWorkOrder(
      connection.id,
      connection.companyId,
      documentSetId,
      moloniCustomerId,
      wo.numero,
      items,
      docType,
      extraNotes,
    )

    // 4. Guardar referência na folha + mudar estado para FATURADA
    const docTypeLabel = docType === 'invoices' ? 'FT' : 'OR'
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
    console.error('[createMoloniInvoice] erro:', e)
    return { ok: false, message: e instanceof Error ? e.message : 'Erro ao criar fatura Moloni' }
  }
}
