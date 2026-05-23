'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/current-user'
import {
  fetchMoloniCompanies,
  fetchAllMoloniDocuments,
  mapMoloniDocument,
  matchMoloniDocumentsToCustomers,
} from '@/lib/moloni'
import { logAudit } from '@/lib/audit'

export async function selectMoloniCompany(connectionId: string, companyId: number) {
  await requireOwner()
  const companies = await fetchMoloniCompanies(connectionId)
  const company = companies.find((item) => item.company_id === companyId)
  if (!company) return { ok: false, message: 'Empresa Moloni não encontrada' }

  await prisma.moloniConnection.update({
    where: { id: connectionId },
    data: {
      companyId: company.company_id,
      companyName: company.name,
      companyVat: company.vat ?? null,
      lastSyncAt: null,
    },
  })
  revalidatePath('/integracoes/moloni')
  return { ok: true }
}

export async function updateAutoSync(
  connectionId: string,
  autoSyncEnabled: boolean,
  autoSyncInterval: number,
) {
  await requireOwner()
  await prisma.moloniConnection.update({
    where: { id: connectionId },
    data: { autoSyncEnabled, autoSyncInterval },
  })
  revalidatePath('/integracoes/moloni')
  return { ok: true }
}

export async function syncMoloniDocuments(connectionId: string) {
  await requireOwner()
  const connection = await prisma.moloniConnection.findUnique({ where: { id: connectionId } })
  if (!connection?.companyId) return { ok: false, message: 'Escolhe uma empresa Moloni primeiro' }

  const log = await prisma.moloniSyncLog.create({
    data: { connectionId, status: 'SUCCESS' },
  })

  try {
    const documents = await fetchAllMoloniDocuments(
      connectionId,
      connection.companyId,
      connection.lastSyncAt,
    )

    let saved = 0
    for (const document of documents) {
      const mapped = mapMoloniDocument(document)
      await prisma.moloniDocument.upsert({
        where: {
          connectionId_documentId: {
            connectionId,
            documentId: mapped.documentId,
          },
        },
        update: mapped,
        create: { connectionId, ...mapped },
      })
      saved++
    }

    // Match automático por NIF
    const matched = await matchMoloniDocumentsToCustomers(connectionId)

    await prisma.moloniConnection.update({
      where: { id: connectionId },
      data: { lastSyncAt: new Date() },
    })
    await prisma.moloniSyncLog.update({
      where: { id: log.id },
      data: {
        status: 'SUCCESS',
        documentsSeen: documents.length,
        documentsSaved: saved,
        finishedAt: new Date(),
      },
    })
    await logAudit({
      entityType: 'MOLONI_CONNECTION',
      entityId: connectionId,
      action: 'UPDATE',
      summary: `Moloni sincronizado • ${saved} documentos • ${matched} clientes ligados`,
      after: { documentsSeen: documents.length, documentsSaved: saved, customersMatched: matched },
    })
    revalidatePath('/integracoes/moloni')
    return { ok: true, documentsSeen: documents.length, documentsSaved: saved, customersMatched: matched }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro ao sincronizar Moloni'
    await prisma.moloniSyncLog.update({
      where: { id: log.id },
      data: { status: 'ERROR', message, finishedAt: new Date() },
    })
    revalidatePath('/integracoes/moloni')
    return { ok: false, message }
  }
}

export async function linkMoloniDocumentToTransaction(
  documentId: string,
  transactionId: string | null,
) {
  await requireOwner()
  await prisma.moloniDocument.update({
    where: { id: documentId },
    data: { transactionId },
  })
  revalidatePath('/integracoes/moloni')
  revalidatePath('/movimentos')
  return { ok: true }
}
