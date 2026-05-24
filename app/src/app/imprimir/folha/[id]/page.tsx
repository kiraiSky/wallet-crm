import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PrintClient } from './PrintClient'

export const dynamic = 'force-dynamic'

export default async function ImprimirFolhaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const wo = await prisma.workOrder.findUnique({
    where: { id },
    include: {
      customer: true,
      vehicle: true,
      items: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!wo) notFound()

  const cp = await prisma.companyProfile.findFirst()
  const companyName    = cp?.nome         || 'Oficina'
  const companyNif     = cp?.nif          || ''
  const companyPhone   = cp?.telefone     || ''
  const companyEmail   = cp?.email        || ''
  const companyAddress = [cp?.morada, [cp?.codigoPostal, cp?.cidade].filter(Boolean).join(' '), cp?.pais]
    .filter(Boolean).join(', ')

  const pecas   = wo.items.filter((i) => i.tipo === 'PECA')
  const maoObra = wo.items.filter((i) => i.tipo === 'MAO_OBRA')

  const totalPecas   = pecas.reduce((s, i) => s + Number(i.total), 0)
  const totalMaoObra = maoObra.reduce((s, i) => s + Number(i.total), 0)
  const totalSemIva  = wo.items.reduce((s, i) => {
    const iva = i.iva !== null ? Number(i.iva) : 23
    return s + Number(i.precoUnit) * Number(i.quantidade)
  }, 0)
  const totalComIva  = Number(wo.total)

  const data = {
    numero: wo.numero,
    estado: wo.estado,
    problema: wo.problema,
    diagnostico: wo.diagnostico,
    trabalho: wo.trabalho,
    observacoes: wo.observacoes,
    kmEntrada: wo.kmEntrada,
    dataAbertura: wo.dataAbertura.toISOString(),
    dataPrevista: wo.dataPrevista?.toISOString() ?? null,
    dataConclusao: wo.dataConclusao?.toISOString() ?? null,
    customer: {
      nome: wo.customer.nome,
      nif: wo.customer.nif,
      telefone: wo.customer.telefone,
      email: wo.customer.email,
      morada: wo.customer.morada,
    },
    vehicle: wo.vehicle
      ? {
          matricula: wo.vehicle.matricula,
          marca: wo.vehicle.marca,
          modelo: wo.vehicle.modelo,
          ano: wo.vehicle.ano,
          km: wo.vehicle.km,
        }
      : null,
    items: wo.items.map((i) => ({
      tipo: i.tipo as 'PECA' | 'MAO_OBRA',
      referencia: i.referencia,
      descricao: i.descricao,
      quantidade: Number(i.quantidade),
      precoUnit: Number(i.precoUnit),
      iva: i.iva !== null ? Number(i.iva) : 23,
      total: Number(i.total),
    })),
    totalPecas,
    totalMaoObra,
    totalSemIva,
    totalComIva,
    moloniDocumentId: wo.moloniDocumentId,
    moloniDocumentType: wo.moloniDocumentType,
    company: { companyName, companyNif, companyAddress, companyPhone, companyEmail, hasLogo: !!cp?.logoPath },
  }

  return <PrintClient data={data} />
}
