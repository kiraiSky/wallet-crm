'use server'

import { revalidatePath } from 'next/cache'
import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/current-user'

/** Gera (ou reutiliza) um token de partilha para a folha */
export async function generateShareToken(workOrderId: string): Promise<{
  ok: boolean
  token?: string
  message?: string
}> {
  await requireOwner()

  const wo = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: { id: true, shareToken: true },
  })
  if (!wo) return { ok: false, message: 'Folha não encontrada.' }

  // Reutilizar token existente
  if (wo.shareToken) return { ok: true, token: wo.shareToken }

  const token = randomBytes(20).toString('hex') // 40 chars, URL-safe

  await prisma.workOrder.update({
    where: { id: workOrderId },
    data: { shareToken: token },
  })

  revalidatePath(`/folhas/${workOrderId}`)
  return { ok: true, token }
}

/** Remove o token de partilha (invalida o link) */
export async function revokeShareToken(workOrderId: string): Promise<{ ok: boolean }> {
  await requireOwner()

  await prisma.workOrder.update({
    where: { id: workOrderId },
    data: { shareToken: null },
  })

  revalidatePath(`/folhas/${workOrderId}`)
  return { ok: true }
}
