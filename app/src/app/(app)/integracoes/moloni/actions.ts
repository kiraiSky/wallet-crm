'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/current-user'
import { fetchMoloniCompanies, fetchMoloniDocuments, mapMoloniDocument } from '@/lib/moloni'
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

export async function syncMoloniDocuments(connectionId: string) {
  await requireOwner()
  const connection = await prisma.moloniConnection.findUnique({ where: { id: connectionId } })
  if (!connection?.companyId) return { ok: false, message: 'Escolhe uma empresa Moloni primeiro' }

  const log = await prisma.moloniSyncLog.create({
    data: { connectionId, status: 'SUCCESS' },
  })

  try {
    const documents = await fetchMoloniDocuments(connectionId, connection.companyId, connection.lastSyncAt)
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
        create: {
          connectionId,
          ...mapped,
        },
      })
      saved++
    }

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
      summary: `Moloni sincronizado • ${saved} documentos`,
      after: { documentsSeen: documents.length, documentsSaved: saved },
    })
    revalidatePath('/integracoes/moloni')
    return { ok: true, documentsSeen: documents.length, documentsSaved: saved }
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
