/**
 * Dados de demonstração para testes.
 * Executar: pnpm tsx prisma/seed-demo.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(Math.floor(Math.random() * 10) + 8, Math.floor(Math.random() * 60), 0, 0)
  return d
}

async function main() {
  // ── Utilizadores ──────────────────────────────────────────────────────────
  const owner = await prisma.user.findFirstOrThrow({ where: { role: 'OWNER' } })

  // ── Contas ────────────────────────────────────────────────────────────────
  const carteira = await prisma.account.findFirstOrThrow({ where: { id: 'seed-carteira' } })

  const mbway = await prisma.account.upsert({
    where: { id: 'seed-mbway' },
    update: {},
    create: { id: 'seed-mbway', nome: 'MB Way', tipo: 'BANCO', cor: 'violet', icone: 'smartphone', saldoInicial: 250 },
  })

  const multibanco = await prisma.account.upsert({
    where: { id: 'seed-mb' },
    update: {},
    create: { id: 'seed-mb', nome: 'Conta BPI', tipo: 'BANCO', cor: 'sky', icone: 'landmark', saldoInicial: 3200 },
  })

  console.log('✓ Contas criadas')

  // ── Categorias ────────────────────────────────────────────────────────────
  const catReparacao   = await prisma.category.findFirstOrThrow({ where: { nome: 'Reparação', tipo: 'ENTRADA' } })
  const catManutencao  = await prisma.category.findFirstOrThrow({ where: { nome: 'Manutenção', tipo: 'ENTRADA' } })
  const catOleo        = await prisma.category.findFirstOrThrow({ where: { nome: 'Mudança de óleo', tipo: 'ENTRADA' } })
  const catPneus       = await prisma.category.findFirstOrThrow({ where: { nome: 'Pneus', tipo: 'ENTRADA' } })
  const catDiagnostico = await prisma.category.findFirstOrThrow({ where: { nome: 'Diagnóstico', tipo: 'ENTRADA' } })
  const catPecas       = await prisma.category.findFirstOrThrow({ where: { nome: 'Peças', tipo: 'SAIDA' } })
  const catRenda       = await prisma.category.findFirstOrThrow({ where: { nome: 'Renda do espaço', tipo: 'SAIDA' } })
  const catEnergia     = await prisma.category.findFirstOrThrow({ where: { nome: 'Energia', tipo: 'SAIDA' } })
  const catConsumiveis = await prisma.category.findFirstOrThrow({ where: { nome: 'Consumíveis', tipo: 'SAIDA' } })
  const catFerramentas = await prisma.category.findFirstOrThrow({ where: { nome: 'Ferramentas', tipo: 'SAIDA' } })

  // ── Clientes ──────────────────────────────────────────────────────────────
  const manuel = await prisma.customer.upsert({
    where: { id: 'demo-cli-1' },
    update: {},
    create: {
      id: 'demo-cli-1',
      nome: 'Manuel Rodrigues',
      telefone: '912 345 678',
      email: 'manuel@email.pt',
      nif: '234567890',
      morada: 'Rua das Flores 12, Lisboa',
      tag: 'VIP',
    },
  })

  const ana = await prisma.customer.upsert({
    where: { id: 'demo-cli-2' },
    update: {},
    create: {
      id: 'demo-cli-2',
      nome: 'Ana Ferreira',
      telefone: '963 111 222',
      email: 'ana.ferreira@gmail.com',
      tag: 'RECORRENTE',
    },
  })

  const carlos = await prisma.customer.upsert({
    where: { id: 'demo-cli-3' },
    update: {},
    create: {
      id: 'demo-cli-3',
      nome: 'Carlos Mendes',
      telefone: '932 555 666',
      nif: '345678901',
      tag: 'NOVO',
    },
  })

  const sofia = await prisma.customer.upsert({
    where: { id: 'demo-cli-4' },
    update: {},
    create: {
      id: 'demo-cli-4',
      nome: 'Sofia Lopes',
      telefone: '914 777 888',
      email: 'sofia.lopes@outlook.pt',
      tag: 'RECORRENTE',
      aniversario: new Date('1985-03-22'),
    },
  })

  const rui = await prisma.customer.upsert({
    where: { id: 'demo-cli-5' },
    update: {},
    create: {
      id: 'demo-cli-5',
      nome: 'Rui Pinto',
      telefone: '961 999 000',
      tag: 'INATIVO',
    },
  })

  console.log('✓ Clientes criados')

  // ── Viaturas ──────────────────────────────────────────────────────────────
  const carroManuel = await prisma.vehicle.upsert({
    where: { id: 'demo-veh-1' },
    update: {},
    create: { id: 'demo-veh-1', customerId: manuel.id, matricula: 'AA-12-BB', marca: 'Volkswagen', modelo: 'Golf', ano: 2018, cor: 'Cinzento', km: 87000 },
  })

  const carroAna = await prisma.vehicle.upsert({
    where: { id: 'demo-veh-2' },
    update: {},
    create: { id: 'demo-veh-2', customerId: ana.id, matricula: '34-CD-56', marca: 'Renault', modelo: 'Clio', ano: 2015, cor: 'Branco', km: 124000 },
  })

  const carroCarlos = await prisma.vehicle.upsert({
    where: { id: 'demo-veh-3' },
    update: {},
    create: { id: 'demo-veh-3', customerId: carlos.id, matricula: 'EF-78-GH', marca: 'Toyota', modelo: 'Corolla', ano: 2021, cor: 'Preto', km: 23000 },
  })

  const carroSofia = await prisma.vehicle.upsert({
    where: { id: 'demo-veh-4' },
    update: {},
    create: { id: 'demo-veh-4', customerId: sofia.id, matricula: '12-IJ-34', marca: 'Peugeot', modelo: '208', ano: 2019, cor: 'Azul', km: 61000 },
  })

  const carroRui = await prisma.vehicle.upsert({
    where: { id: 'demo-veh-5' },
    update: {},
    create: { id: 'demo-veh-5', customerId: rui.id, matricula: 'KL-56-MN', marca: 'Ford', modelo: 'Focus', ano: 2012, cor: 'Vermelho', km: 198000 },
  })

  const carroManuel2 = await prisma.vehicle.upsert({
    where: { id: 'demo-veh-6' },
    update: {},
    create: { id: 'demo-veh-6', customerId: manuel.id, matricula: 'OP-90-QR', marca: 'BMW', modelo: '320d', ano: 2020, cor: 'Branco', km: 45000 },
  })

  console.log('✓ Viaturas criadas')

  // ── Transações (últimos 60 dias) ──────────────────────────────────────────
  const tx = [
    // Receitas
    { tipo: 'ENTRADA', valor: 320,  descricao: 'Reparação suspensão Golf',    data: daysAgo(2),  accountId: carteira.id, categoryId: catReparacao.id },
    { tipo: 'ENTRADA', valor: 85,   descricao: 'Mudança de óleo Clio',        data: daysAgo(3),  accountId: carteira.id, categoryId: catOleo.id },
    { tipo: 'ENTRADA', valor: 560,  descricao: 'Pneus + equilíbrio Corolla',  data: daysAgo(4),  accountId: mbway.id,    categoryId: catPneus.id },
    { tipo: 'ENTRADA', valor: 50,   descricao: 'Diagnóstico elétrico',        data: daysAgo(5),  accountId: carteira.id, categoryId: catDiagnostico.id },
    { tipo: 'ENTRADA', valor: 180,  descricao: 'Manutenção 208 60k km',       data: daysAgo(7),  accountId: mbway.id,    categoryId: catManutencao.id },
    { tipo: 'ENTRADA', valor: 420,  descricao: 'Reparação motor Focus',       data: daysAgo(9),  accountId: multibanco.id, categoryId: catReparacao.id },
    { tipo: 'ENTRADA', valor: 95,   descricao: 'Mudança de óleo BMW',         data: daysAgo(10), accountId: carteira.id, categoryId: catOleo.id },
    { tipo: 'ENTRADA', valor: 240,  descricao: 'Reparação travões Golf',      data: daysAgo(12), accountId: carteira.id, categoryId: catReparacao.id },
    { tipo: 'ENTRADA', valor: 75,   descricao: 'Mudança de óleo + filtros',   data: daysAgo(14), accountId: mbway.id,    categoryId: catOleo.id },
    { tipo: 'ENTRADA', valor: 380,  descricao: 'Pneus Clio (4 unid.)',        data: daysAgo(16), accountId: multibanco.id, categoryId: catPneus.id },
    { tipo: 'ENTRADA', valor: 650,  descricao: 'Reparação caixa de velocidades', data: daysAgo(18), accountId: multibanco.id, categoryId: catReparacao.id },
    { tipo: 'ENTRADA', valor: 120,  descricao: 'Manutenção Corolla',          data: daysAgo(20), accountId: carteira.id, categoryId: catManutencao.id },
    { tipo: 'ENTRADA', valor: 45,   descricao: 'Diagnóstico AC',              data: daysAgo(22), accountId: carteira.id, categoryId: catDiagnostico.id },
    { tipo: 'ENTRADA', valor: 290,  descricao: 'Reparação embraiagem',        data: daysAgo(25), accountId: mbway.id,    categoryId: catReparacao.id },
    { tipo: 'ENTRADA', valor: 85,   descricao: 'Mudança de óleo Golf',        data: daysAgo(28), accountId: carteira.id, categoryId: catOleo.id },
    { tipo: 'ENTRADA', valor: 310,  descricao: 'Pneus + alinhamento BMW',     data: daysAgo(30), accountId: multibanco.id, categoryId: catPneus.id },
    { tipo: 'ENTRADA', valor: 195,  descricao: 'Manutenção geral 208',        data: daysAgo(33), accountId: mbway.id,    categoryId: catManutencao.id },
    { tipo: 'ENTRADA', valor: 480,  descricao: 'Reparação suspensão BMW',     data: daysAgo(36), accountId: multibanco.id, categoryId: catReparacao.id },
    { tipo: 'ENTRADA', valor: 90,   descricao: 'Mudança de óleo Focus',       data: daysAgo(40), accountId: carteira.id, categoryId: catOleo.id },
    { tipo: 'ENTRADA', valor: 55,   descricao: 'Diagnóstico motor',           data: daysAgo(43), accountId: carteira.id, categoryId: catDiagnostico.id },
    { tipo: 'ENTRADA', valor: 720,  descricao: 'Reparação motor Clio',        data: daysAgo(45), accountId: multibanco.id, categoryId: catReparacao.id },
    { tipo: 'ENTRADA', valor: 270,  descricao: 'Pneus Golf (2 unid.)',        data: daysAgo(48), accountId: carteira.id, categoryId: catPneus.id },
    { tipo: 'ENTRADA', valor: 160,  descricao: 'Manutenção Clio',             data: daysAgo(52), accountId: mbway.id,    categoryId: catManutencao.id },
    { tipo: 'ENTRADA', valor: 395,  descricao: 'Reparação sistema elétrico',  data: daysAgo(55), accountId: multibanco.id, categoryId: catReparacao.id },
    { tipo: 'ENTRADA', valor: 80,   descricao: 'Mudança de óleo Corolla',     data: daysAgo(58), accountId: carteira.id, categoryId: catOleo.id },
    // Despesas
    { tipo: 'SAIDA', valor: 850,  descricao: 'Renda do espaço — maio',      data: daysAgo(1),  accountId: multibanco.id, categoryId: catRenda.id },
    { tipo: 'SAIDA', valor: 320,  descricao: 'Encomenda de peças (VAG)',     data: daysAgo(3),  accountId: multibanco.id, categoryId: catPecas.id },
    { tipo: 'SAIDA', valor: 145,  descricao: 'Electricidade abril',          data: daysAgo(8),  accountId: multibanco.id, categoryId: catEnergia.id },
    { tipo: 'SAIDA', valor: 58,   descricao: 'Óleo motor 5W30 (10L)',        data: daysAgo(10), accountId: carteira.id,   categoryId: catConsumiveis.id },
    { tipo: 'SAIDA', valor: 210,  descricao: 'Peças suspensão Golf',         data: daysAgo(11), accountId: multibanco.id, categoryId: catPecas.id },
    { tipo: 'SAIDA', valor: 480,  descricao: 'Pneus (stock) 4 unid.',        data: daysAgo(15), accountId: multibanco.id, categoryId: catPecas.id },
    { tipo: 'SAIDA', valor: 89,   descricao: 'Consumíveis oficina',          data: daysAgo(18), accountId: carteira.id,   categoryId: catConsumiveis.id },
    { tipo: 'SAIDA', valor: 850,  descricao: 'Renda do espaço — abril',      data: daysAgo(32), accountId: multibanco.id, categoryId: catRenda.id },
    { tipo: 'SAIDA', valor: 275,  descricao: 'Peças motor Clio',             data: daysAgo(35), accountId: multibanco.id, categoryId: catPecas.id },
    { tipo: 'SAIDA', valor: 138,  descricao: 'Electricidade março',          data: daysAgo(38), accountId: multibanco.id, categoryId: catEnergia.id },
    { tipo: 'SAIDA', valor: 320,  descricao: 'Ferramenta diagnóstico OBD2',  data: daysAgo(42), accountId: multibanco.id, categoryId: catFerramentas.id },
    { tipo: 'SAIDA', valor: 64,   descricao: 'Óleo + filtros stock',         data: daysAgo(44), accountId: carteira.id,   categoryId: catConsumiveis.id },
    { tipo: 'SAIDA', valor: 195,  descricao: 'Peças elétrico BMW',           data: daysAgo(50), accountId: multibanco.id, categoryId: catPecas.id },
    { tipo: 'SAIDA', valor: 850,  descricao: 'Renda do espaço — março',      data: daysAgo(62), accountId: multibanco.id, categoryId: catRenda.id },
  ] as const

  for (const t of tx) {
    await prisma.transaction.create({
      data: {
        tipo: t.tipo,
        valor: t.valor,
        descricao: t.descricao,
        data: t.data,
        accountId: t.accountId,
        categoryId: t.categoryId,
        userId: owner.id,
      },
    })
  }
  console.log(`✓ ${tx.length} transações criadas`)

  // ── Folhas de obra ────────────────────────────────────────────────────────
  // FO 1 — Concluída (Golf Manuel)
  const fo1 = await prisma.workOrder.create({
    data: {
      customerId: manuel.id,
      vehicleId: carroManuel.id,
      estado: 'CONCLUIDA',
      problema: 'Barulho na suspensão dianteira ao passar lombas',
      diagnostico: 'Rolamento da roda dianteira esquerda gasto',
      trabalho: 'Substituição do rolamento + amortecedor dianteiro esquerdo',
      kmEntrada: 86800,
      dataAbertura: daysAgo(12),
      dataConclusao: daysAgo(10),
      totalPecas: 185,
      totalMaoObra: 55,
      total: 240,
    },
  })
  await prisma.workOrderItem.createMany({ data: [
    { workOrderId: fo1.id, tipo: 'PECA',     descricao: 'Rolamento roda dianteira',  quantidade: 1, precoUnit: 95,  total: 95 },
    { workOrderId: fo1.id, tipo: 'PECA',     descricao: 'Amortecedor dianteiro esq', quantidade: 1, precoUnit: 90,  total: 90 },
    { workOrderId: fo1.id, tipo: 'MAO_OBRA', descricao: 'Mão de obra substituição',  quantidade: 1, precoUnit: 55,  total: 55 },
  ]})

  // FO 2 — Em reparação (Clio Ana)
  const fo2 = await prisma.workOrder.create({
    data: {
      customerId: ana.id,
      vehicleId: carroAna.id,
      estado: 'EM_REPARACAO',
      problema: 'Não arranca a frio, fumega a azul',
      diagnostico: 'Válvulas gastas, consumo de óleo excessivo',
      kmEntrada: 124000,
      dataAbertura: daysAgo(4),
      dataPrevista: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      totalPecas: 380,
      totalMaoObra: 220,
      total: 600,
    },
  })
  await prisma.workOrderItem.createMany({ data: [
    { workOrderId: fo2.id, tipo: 'PECA',     descricao: 'Kit válvulas Clio 1.5 dCi', quantidade: 1, precoUnit: 230, total: 230 },
    { workOrderId: fo2.id, tipo: 'PECA',     descricao: 'Juntas cabeça motor',        quantidade: 1, precoUnit: 85,  total: 85 },
    { workOrderId: fo2.id, tipo: 'PECA',     descricao: 'Óleo motor 5W30 (5L)',       quantidade: 1, precoUnit: 32,  total: 32 },
    { workOrderId: fo2.id, tipo: 'PECA',     descricao: 'Filtro de óleo',             quantidade: 1, precoUnit: 12,  total: 12 },
    { workOrderId: fo2.id, tipo: 'PECA',     descricao: 'Filtro de ar',               quantidade: 1, precoUnit: 21,  total: 21 },
    { workOrderId: fo2.id, tipo: 'MAO_OBRA', descricao: 'Abertura cabeça motor',      quantidade: 4, precoUnit: 55,  total: 220 },
  ]})

  // FO 3 — Aberta (Corolla Carlos)
  const fo3 = await prisma.workOrder.create({
    data: {
      customerId: carlos.id,
      vehicleId: carroCarlos.id,
      estado: 'ABERTA',
      problema: 'Revisão dos 25 000 km',
      kmEntrada: 23000,
      dataAbertura: daysAgo(1),
      dataPrevista: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      totalPecas: 0,
      totalMaoObra: 0,
      total: 0,
    },
  })

  // FO 4 — Aguarda peças (BMW Manuel)
  const fo4 = await prisma.workOrder.create({
    data: {
      customerId: manuel.id,
      vehicleId: carroManuel2.id,
      estado: 'AGUARDA_PECAS',
      problema: 'Luz do motor ligada, perda de potência',
      diagnostico: 'Turbo com folga excessiva, sensor MAP com falha',
      kmEntrada: 44800,
      dataAbertura: daysAgo(7),
      observacoes: 'Peças encomendadas — prazo estimado 3-5 dias úteis',
      totalPecas: 520,
      totalMaoObra: 130,
      total: 650,
    },
  })
  await prisma.workOrderItem.createMany({ data: [
    { workOrderId: fo4.id, tipo: 'PECA',     descricao: 'Turbo remanufacturado BMW N47', quantidade: 1, precoUnit: 480, total: 480 },
    { workOrderId: fo4.id, tipo: 'PECA',     descricao: 'Sensor MAP',                    quantidade: 1, precoUnit: 40,  total: 40 },
    { workOrderId: fo4.id, tipo: 'MAO_OBRA', descricao: 'Substituição turbo',            quantidade: 2, precoUnit: 65,  total: 130 },
  ]})

  // FO 5 — Faturada (208 Sofia)
  const fo5 = await prisma.workOrder.create({
    data: {
      customerId: sofia.id,
      vehicleId: carroSofia.id,
      estado: 'FATURADA',
      problema: 'Revisão 60 000 km + troca de pneus',
      diagnostico: 'Travões traseiros desgastados, pastilhas a 20%',
      trabalho: 'Revisão completa + 4 pneus + pastilhas traseiras',
      kmEntrada: 60800,
      dataAbertura: daysAgo(9),
      dataConclusao: daysAgo(7),
      totalPecas: 520,
      totalMaoObra: 90,
      total: 610,
    },
  })
  await prisma.workOrderItem.createMany({ data: [
    { workOrderId: fo5.id, tipo: 'PECA',     descricao: 'Pneus 195/55 R16 (x4)',     quantidade: 4,  precoUnit: 85,  total: 340 },
    { workOrderId: fo5.id, tipo: 'PECA',     descricao: 'Pastilhas travão traseiro', quantidade: 1,  precoUnit: 38,  total: 38 },
    { workOrderId: fo5.id, tipo: 'PECA',     descricao: 'Óleo 5W30 + filtro',        quantidade: 1,  precoUnit: 44,  total: 44 },
    { workOrderId: fo5.id, tipo: 'PECA',     descricao: 'Filtro ar + filtro habitáculo', quantidade: 1, precoUnit: 36, total: 36 },
    { workOrderId: fo5.id, tipo: 'PECA',     descricao: 'Palhetas limpa vidros',     quantidade: 2,  precoUnit: 14,  total: 28 },
    { workOrderId: fo5.id, tipo: 'PECA',     descricao: 'Líquido travões',           quantidade: 1,  precoUnit: 14,  total: 14 },
    { workOrderId: fo5.id, tipo: 'MAO_OBRA', descricao: 'Revisão + alinhamento',     quantidade: 1,  precoUnit: 90,  total: 90 },
  ]})

  // FO 6 — Cancelada (Focus Rui)
  const fo6 = await prisma.workOrder.create({
    data: {
      customerId: rui.id,
      vehicleId: carroRui.id,
      estado: 'CANCELADA',
      problema: 'Caixa de velocidades a patinar',
      diagnostico: 'Caixa de velocidades danificada — reparação não rentável',
      kmEntrada: 197500,
      dataAbertura: daysAgo(20),
      observacoes: 'Cliente decidiu não avançar com reparação dado o valor do veículo',
      totalPecas: 0,
      totalMaoObra: 55,
      total: 55,
    },
  })
  await prisma.workOrderItem.createMany({ data: [
    { workOrderId: fo6.id, tipo: 'MAO_OBRA', descricao: 'Diagnóstico caixa velocidades', quantidade: 1, precoUnit: 55, total: 55 },
  ]})

  console.log('✓ 6 folhas de obra criadas')
  console.log('')
  console.log('═══════════════════════════════════════')
  console.log(' Demo pronto!')
  console.log('  5 clientes | 6 viaturas | 39 transações | 6 folhas de obra')
  console.log('  Contas: Carteira · MB Way · BPI')
  console.log('═══════════════════════════════════════')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
