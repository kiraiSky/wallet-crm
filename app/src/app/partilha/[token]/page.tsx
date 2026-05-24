import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ShareView } from './ShareView'

export const dynamic = 'force-dynamic'

export default async function PartilhaPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const wo = await prisma.workOrder.findUnique({
    where: { shareToken: token },
    include: {
      customer: { select: { nome: true, telefone: true } },
      vehicle: true,
      items: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!wo) notFound()

  const cp = await prisma.companyProfile.findFirst()

  const pecas   = wo.items.filter((i) => i.tipo === 'PECA')
  const maoObra = wo.items.filter((i) => i.tipo === 'MAO_OBRA')

  // Calcular totais sem IVA
  const baseTotal = wo.items.reduce((s, i) => s + Number(i.precoUnit) * (1 + (i.margem ? Number(i.margem) : 0) / 100) * Number(i.quantidade), 0)
  const ivaMap = new Map<number, number>()
  for (const item of wo.items) {
    const precoVenda = Number(item.precoUnit) * (1 + (item.margem ? Number(item.margem) : 0) / 100)
    const base = precoVenda * Number(item.quantidade)
    const taxa = item.iva !== null ? Number(item.iva) : 23
    ivaMap.set(taxa, (ivaMap.get(taxa) ?? 0) + base * (taxa / 100))
  }

  const data = {
    numero: wo.numero,
    estado: wo.estado,
    problema: wo.problema,
    diagnostico: wo.diagnostico,
    trabalho: wo.trabalho,
    observacoes: wo.observacoes,
    dataAbertura: wo.dataAbertura.toISOString(),
    dataPrevista: wo.dataPrevista?.toISOString() ?? null,
    dataConclusao: wo.dataConclusao?.toISOString() ?? null,
    customer: { nome: wo.customer.nome, telefone: wo.customer.telefone },
    vehicle: wo.vehicle
      ? {
          matricula: wo.vehicle.matricula,
          marca: wo.vehicle.marca,
          modelo: wo.vehicle.modelo,
          ano: wo.vehicle.ano,
          km: wo.vehicle.km,
        }
      : null,
    pecas: pecas.map((i) => ({
      referencia: i.referencia,
      descricao: i.descricao,
      quantidade: Number(i.quantidade),
      precoUnit: Number(i.precoUnit) * (1 + (i.margem ? Number(i.margem) : 0) / 100),
      iva: i.iva !== null ? Number(i.iva) : 23,
      total: Number(i.total),
    })),
    maoObra: maoObra.map((i) => ({
      descricao: i.descricao,
      quantidade: Number(i.quantidade),
      precoUnit: Number(i.precoUnit) * (1 + (i.margem ? Number(i.margem) : 0) / 100),
      iva: i.iva !== null ? Number(i.iva) : 23,
      total: Number(i.total),
    })),
    baseTotal,
    ivaEntries: Array.from(ivaMap.entries()),
    totalComIva: Number(wo.total),
    faturada: !!wo.moloniDocumentId,
    company: {
      nome: cp?.nome ?? '',
      telefone: cp?.telefone ?? '',
      email: cp?.email ?? '',
      hasLogo: !!cp?.logoPath,
    },
  }

  return <ShareView data={data} />
}
