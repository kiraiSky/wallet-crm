import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

let customer = await prisma.customer.findFirst({
  where: { archived: false },
  orderBy: { createdAt: 'desc' },
})

if (!customer) {
  customer = await prisma.customer.create({
    data: {
      nome: 'Cliente Teste Moloni',
      telefone: '912345678',
      email: 'teste@example.com',
    },
  })
  console.log('Cliente criado:', customer.id, customer.nome)
} else {
  console.log('A reutilizar cliente existente:', customer.id, customer.nome, '— NIF:', customer.nif ?? '(sem NIF)')
}

const wo = await prisma.workOrder.create({
  data: {
    customerId: customer.id,
    estado: 'CONCLUIDA',
    problema: 'Teste de faturação Moloni — Consumidor Final vs Identificado',
    diagnostico: 'Tudo OK. Folha criada para testar o novo selector de cliente.',
    trabalho: 'Substituição de óleo e filtro + revisão geral',
    items: {
      create: [
        { tipo: 'MAO_OBRA', descricao: 'Mão de obra — revisão geral', quantidade: 2, precoUnit: 25, margem: 0,  iva: 23, total: 61.50 },
        { tipo: 'PECA',     descricao: 'Óleo motor 5W30',              referencia: 'OL-5W30',   quantidade: 4, precoUnit: 8,  margem: 25, iva: 23, total: 49.20 },
        { tipo: 'PECA',     descricao: 'Filtro de óleo',               referencia: 'FL-OL-001', quantidade: 1, precoUnit: 12, margem: 30, iva: 23, total: 19.19 },
      ],
    },
  },
  include: { items: true },
})

let totalPecas = 0, totalMaoObra = 0, total = 0
for (const it of wo.items) {
  const base = Number(it.precoUnit) * Number(it.quantidade) * (1 + (it.margem ? Number(it.margem) : 0) / 100)
  const comIva = base * (1 + (it.iva ? Number(it.iva) : 0) / 100)
  if (it.tipo === 'PECA') totalPecas += base; else totalMaoObra += base
  total += comIva
}

const updated = await prisma.workOrder.update({
  where: { id: wo.id },
  data: {
    totalPecas: totalPecas.toFixed(2),
    totalMaoObra: totalMaoObra.toFixed(2),
    total: total.toFixed(2),
  },
})

console.log('\n[ok] Folha criada')
console.log('  ID:    ', updated.id)
console.log('  Numero:', updated.numero)
console.log('  Total: ', updated.total.toString(), 'EUR')
console.log('  URL:   http://localhost:3000/folhas/' + updated.id)

await prisma.$disconnect()
