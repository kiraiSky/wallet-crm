import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const vehicles = await prisma.vehicle.findMany({
    where: { customerId: id, archived: false },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      matricula: true,
      marca: true,
      modelo: true,
      ano: true,
      cor: true,
      km: true,
      observacoes: true,
      workOrders: {
        orderBy: { dataAbertura: 'desc' },
        take: 4,
        select: {
          id: true,
          numero: true,
          estado: true,
          problema: true,
          dataAbertura: true,
          dataConclusao: true,
        },
      },
    },
  })
  return NextResponse.json({ vehicles })
}
