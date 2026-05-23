import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/current-user'
import { logAudit } from '@/lib/audit'

export async function POST() {
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
  return NextResponse.redirect(new URL('/integracoes/moloni?disconnected=1', process.env.NEXTAUTH_URL || 'http://localhost:3000'))
}
