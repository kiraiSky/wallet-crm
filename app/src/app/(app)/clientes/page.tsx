import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { CustomersClient } from './CustomersClient'

export const dynamic = 'force-dynamic'

export type CustomerTag = 'VIP' | 'RECORRENTE' | 'NOVO' | 'INATIVO'

export type CustomerRow = {
  id: string
  nome: string
  telefone: string | null
  email: string | null
  nif: string | null
  tag: CustomerTag
  totalVeiculos: number
  createdAt: string
}

type SearchParams = Record<string, string | undefined>

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const search = params.q?.trim() || undefined
  const tagFilter = (
    ['VIP', 'RECORRENTE', 'NOVO', 'INATIVO'] as const
  ).includes(params.tag as CustomerTag)
    ? (params.tag as CustomerTag)
    : undefined

  const where: Prisma.CustomerWhereInput = {
    archived: false,
    ...(tagFilter && { tag: tagFilter }),
    ...(search && {
      OR: [
        { nome: { contains: search, mode: 'insensitive' } },
        { telefone: { contains: search, mode: 'insensitive' } },
        { nif: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    }),
  }

  const [customers, tagCounts] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { _count: { select: { vehicles: true } } },
    }),
    prisma.customer.groupBy({
      by: ['tag'],
      where: { archived: false },
      _count: true,
    }),
  ])

  const rows: CustomerRow[] = customers.map((c) => ({
    id: c.id,
    nome: c.nome,
    telefone: c.telefone,
    email: c.email,
    nif: c.nif,
    tag: c.tag as CustomerTag,
    totalVeiculos: c._count.vehicles,
    createdAt: c.createdAt.toISOString(),
  }))

  const counts: Record<CustomerTag | 'TOTAL', number> = {
    VIP: 0,
    RECORRENTE: 0,
    NOVO: 0,
    INATIVO: 0,
    TOTAL: 0,
  }
  for (const t of tagCounts) {
    counts[t.tag as CustomerTag] = t._count
    counts.TOTAL += t._count
  }

  return (
    <CustomersClient
      customers={rows}
      counts={counts}
      filters={{ search, tag: tagFilter }}
    />
  )
}
