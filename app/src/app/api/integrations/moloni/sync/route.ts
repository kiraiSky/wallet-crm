/**
 * POST /api/integrations/moloni/sync
 * Sync automático — chamado por cron externo ou pelo scheduler interno.
 * Suporta header Authorization: Bearer <MOLONI_SYNC_SECRET> para segurança.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchAllMoloniDocuments, mapMoloniDocument, matchMoloniDocumentsToCustomers } from '@/lib/moloni'
import { logAudit } from '@/lib/audit'

export async function POST(req: Request) {
  // Verificar secret se configurado
  const syncSecret = process.env.MOLONI_SYNC_SECRET
  if (syncSecret) {
    const auth = req.headers.get('authorization') ?? ''
    if (auth !== `Bearer ${syncSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const connections = await prisma.moloniConnection.findMany({
    where: { autoSyncEnabled: true, companyId: { not: null } },
  })

  if (connections.length === 0) {
    return NextResponse.json({ ok: true, message: 'Nenhuma ligação com sync automático activo' })
  }

  const results = []

  for (const connection of connections) {
    // Verificar se é hora de sincronizar
    if (connection.lastSyncAt) {
      const minutesSince = (Date.now() - connection.lastSyncAt.getTime()) / 60_000
      if (minutesSince < connection.autoSyncInterval) {
        results.push({ connectionId: connection.id, skipped: true, reason: 'Ainda não é hora' })
        continue
      }
    }

    const log = await prisma.moloniSyncLog.create({
      data: { connectionId: connection.id, status: 'SUCCESS' },
    })

    try {
      const documents = await fetchAllMoloniDocuments(
        connection.id,
        connection.companyId!,
        connection.lastSyncAt,
      )

      let saved = 0
      for (const document of documents) {
        const mapped = mapMoloniDocument(document)
        await prisma.moloniDocument.upsert({
          where: { connectionId_documentId: { connectionId: connection.id, documentId: mapped.documentId } },
          update: mapped,
          create: { connectionId: connection.id, ...mapped },
        })
        saved++
      }

      const matched = await matchMoloniDocumentsToCustomers(connection.id)

      await prisma.moloniConnection.update({
        where: { id: connection.id },
        data: { lastSyncAt: new Date() },
      })
      await prisma.moloniSyncLog.update({
        where: { id: log.id },
        data: { status: 'SUCCESS', documentsSeen: documents.length, documentsSaved: saved, finishedAt: new Date() },
      })
      await logAudit({
        entityType: 'MOLONI_CONNECTION',
        entityId: connection.id,
        action: 'UPDATE',
        summary: `Moloni auto-sync • ${saved} documentos • ${matched} clientes ligados`,
        after: { documentsSeen: documents.length, documentsSaved: saved, customersMatched: matched },
      })

      results.push({ connectionId: connection.id, ok: true, documentsSaved: saved, customersMatched: matched })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro ao sincronizar'
      await prisma.moloniSyncLog.update({
        where: { id: log.id },
        data: { status: 'ERROR', message, finishedAt: new Date() },
      })
      results.push({ connectionId: connection.id, ok: false, message })
    }
  }

  return NextResponse.json({ ok: true, results })
}
