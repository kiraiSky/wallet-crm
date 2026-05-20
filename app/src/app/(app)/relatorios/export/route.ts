import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolvePeriod } from '@/lib/report-period'
import { getCurrentUser } from '@/lib/current-user'

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (s.includes(';') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function GET(req: NextRequest) {
  await getCurrentUser() // garante autenticação
  const url = req.nextUrl
  const period = resolvePeriod({
    preset: url.searchParams.get('p') ?? undefined,
    from: url.searchParams.get('from') ?? undefined,
    to: url.searchParams.get('to') ?? undefined,
  })

  const txs = await prisma.transaction.findMany({
    where: { data: { gte: period.start, lt: period.end } },
    orderBy: { data: 'asc' },
    include: {
      account: { select: { nome: true } },
      category: { select: { nome: true, tipo: true } },
      user: { select: { nome: true } },
      customer: { select: { nome: true, nif: true } },
      workOrder: { select: { numero: true } },
    },
  })

  const lines: string[] = []
  lines.push(
    [
      'Data',
      'Tipo',
      'Descrição',
      'Categoria',
      'Conta',
      'Cliente',
      'NIF',
      'Folha',
      'Utilizador',
      'Valor',
      'Observação',
    ]
      .map(escapeCsv)
      .join(';')
  )

  for (const tx of txs) {
    lines.push(
      [
        ymd(tx.data),
        tx.tipo === 'ENTRADA' ? 'Entrada' : 'Saída',
        tx.descricao,
        tx.category.nome,
        tx.account.nome,
        tx.customer?.nome ?? '',
        tx.customer?.nif ?? '',
        tx.workOrder ? `#${tx.workOrder.numero}` : '',
        tx.user.nome,
        Number(tx.valor).toFixed(2).replace('.', ','),
        tx.observacao ?? '',
      ]
        .map(escapeCsv)
        .join(';')
    )
  }

  // BOM UTF-8 para o Excel abrir com acentos corretos
  const body = '﻿' + lines.join('\r\n')
  const filename = `relatorio_${period.fromInput}_${period.toInput}.csv`

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
