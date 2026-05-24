import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/current-user'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  await requireOwner()
  const connections = await prisma.moloniConnection.findMany({ select: { id: true, companyName: true } })
  await prisma.moloniConnection.deleteMany({})
  for (const connection of connections) {
    await logAudit({
      entityType: 'MOLONI_CONNECTION',
      entityId: connection.id,
      action: 'DELETE',
      summary: `Moloni desligado${connection.companyName ? ` • ${connection.companyName}` : ''}`,
      before: connection,
    })
  }
  const origin = req.nextUrl.origin
  return NextResponse.redirect(new URL('/integracoes/moloni', origin))
}
