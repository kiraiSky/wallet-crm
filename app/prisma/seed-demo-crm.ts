import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const owner = await prisma.user.findFirst({ where: { role: 'OWNER' } })
  if (!owner) throw new Error('Cria o utilizador OWNER primeiro (pnpm prisma db seed)')

  const conta = await prisma.account.findFirst()
  if (!conta) throw new Error('Conta não encontrada')

  // Categorias necessárias
  const catManutenção = await prisma.category.findFirst({ where: { nome: 'Manutenção', tipo: 'ENTRADA' } })
  const catReparação = await prisma.category.findFirst({ where: { nome: 'Reparação', tipo: 'ENTRADA' } })
  const catPneus = await prisma.category.findFirst({ where: { nome: 'Pneus', tipo: 'ENTRADA' } })
  const catPecas = await prisma.category.findFirst({ where: { nome: 'Peças', tipo: 'SAIDA' } })

  console.log('A criar clientes e viaturas...')

  // ── CLIENTES ────────────────────────────────────────────────────────────────

  const manuel = await prisma.customer.create({
    data: {
      nome: 'Manuel Ferreira',
      telefone: '912345678',
      email: 'manuel.ferreira@gmail.com',
      nif: '123456789',
      morada: 'Rua das Flores 12, Porto',
      tag: 'VIP',
      vehicles: {
        create: [
          { matricula: 'AA-12-BB', marca: 'Volkswagen', modelo: 'Golf', ano: 2019, cor: 'Prata', km: 87000 },
          { matricula: 'CC-34-DD', marca: 'Mercedes', modelo: 'Classe C', ano: 2021, cor: 'Preto', km: 42000 },
        ],
      },
    },
    include: { vehicles: true },
  })

  const ana = await prisma.customer.create({
    data: {
      nome: 'Ana Rodrigues',
      telefone: '936789012',
      email: 'ana.rodrigues@outlook.com',
      nif: '234567890',
      morada: 'Av. da Liberdade 88, Lisboa',
      tag: 'RECORRENTE',
      vehicles: {
        create: [
          { matricula: 'EE-56-FF', marca: 'Peugeot', modelo: '208', ano: 2020, cor: 'Branco', km: 55000 },
        ],
      },
    },
    include: { vehicles: true },
  })

  const carlos = await prisma.customer.create({
    data: {
      nome: 'Carlos Mendes',
      telefone: '964321098',
      email: 'carlos.mendes@sapo.pt',
      nif: '345678901',
      morada: 'Rua do Comércio 5, Braga',
      tag: 'NOVO',
      vehicles: {
        create: [
          { matricula: 'GG-78-HH', marca: 'Renault', modelo: 'Clio', ano: 2018, cor: 'Azul', km: 112000 },
        ],
      },
    },
    include: { vehicles: true },
  })

  const sofia = await prisma.customer.create({
    data: {
      nome: 'Sofia Lopes',
      telefone: '918765432',
      email: 'sofia.lopes@gmail.com',
      nif: '456789012',
      morada: 'Rua Nova 33, Coimbra',
      tag: 'RECORRENTE',
      vehicles: {
        create: [
          { matricula: 'II-90-JJ', marca: 'Toyota', modelo: 'Yaris', ano: 2022, cor: 'Vermelho', km: 18000 },
        ],
      },
    },
    include: { vehicles: true },
  })

  const rui = await prisma.customer.create({
    data: {
      nome: 'Rui Carvalho',
      telefone: '929876543',
      email: 'rui.carvalho@hotmail.com',
      nif: '567890123',
      morada: 'Praça do Município 1, Faro',
      tag: 'INATIVO',
      vehicles: {
        create: [
          { matricula: 'KK-11-LL', marca: 'Ford', modelo: 'Focus', ano: 2016, cor: 'Cinzento', km: 145000 },
        ],
      },
    },
    include: { vehicles: true },
  })

  console.log('✓ 5 clientes criados (VIP, Recorrente x2, Novo, Inativo)')

  // ── FOLHAS DE OBRA ──────────────────────────────────────────────────────────

  const hoje = new Date()
  const dias = (n: number) => new Date(hoje.getTime() + n * 86400000)

  // Folha 1 — Manuel / Golf — FATURADA (workflow completo)
  const fo1 = await prisma.workOrder.create({
    data: {
      customerId: manuel.id,
      vehicleId: manuel.vehicles[0].id,
      estado: 'FATURADA',
      problema: 'Revisão geral + substituição de pastilhas de travão dianteiras',
      diagnostico: 'Pastilhas desgastadas a 10%, filtros em fim de vida, nível de óleo baixo',
      trabalho: 'Substituição pastilhas dianteiras, mudança de óleo e filtros, revisão completa',
      kmEntrada: 87000,
      dataAbertura: dias(-8),
      dataPrevista: dias(-5),
      dataConclusao: dias(-5),
      totalPecas: 85.50,
      totalMaoObra: 120.00,
      total: 205.50,
      items: {
        create: [
          { tipo: 'PECA', descricao: 'Pastilhas travão dianteiras Bosch', quantidade: 1, precoUnit: 45.50, total: 45.50 },
          { tipo: 'PECA', descricao: 'Filtro de óleo', quantidade: 1, precoUnit: 12.00, total: 12.00 },
          { tipo: 'PECA', descricao: 'Filtro de ar', quantidade: 1, precoUnit: 18.00, total: 18.00 },
          { tipo: 'PECA', descricao: 'Óleo motor 5W40 (5L)', quantidade: 1, precoUnit: 10.00, total: 10.00 },
          { tipo: 'MAO_OBRA', descricao: 'Revisão geral + troca pastilhas', quantidade: 2, precoUnit: 60.00, total: 120.00 },
        ],
      },
    },
  })

  // Folha 2 — Manuel / Mercedes — EM_REPARACAO
  const fo2 = await prisma.workOrder.create({
    data: {
      customerId: manuel.id,
      vehicleId: manuel.vehicles[1].id,
      estado: 'EM_REPARACAO',
      problema: 'Barulho estranho na suspensão dianteira esquerda ao passar lombas',
      diagnostico: 'Rolamento do cubo de roda dianteiro esquerdo com folga excessiva',
      trabalho: 'Substituição rolamento dianteiro esquerdo',
      kmEntrada: 42000,
      dataAbertura: dias(-3),
      dataPrevista: dias(1),
      totalPecas: 65.00,
      totalMaoObra: 90.00,
      total: 155.00,
      items: {
        create: [
          { tipo: 'PECA', descricao: 'Rolamento cubo roda SKF', quantidade: 1, precoUnit: 65.00, total: 65.00 },
          { tipo: 'MAO_OBRA', descricao: 'Desmontagem e montagem rolamento', quantidade: 1.5, precoUnit: 60.00, total: 90.00 },
        ],
      },
    },
  })

  // Folha 3 — Ana / Peugeot — CONCLUIDA
  const fo3 = await prisma.workOrder.create({
    data: {
      customerId: ana.id,
      vehicleId: ana.vehicles[0].id,
      estado: 'CONCLUIDA',
      problema: 'Luz de avaria acesa + veículo a puxar para a direita',
      diagnostico: 'Código P0420 (catalisador) + pneu dianteiro direito gasto irregularmente',
      trabalho: 'Substituição de 2 pneus dianteiros + alinhamento de direção',
      kmEntrada: 55000,
      dataAbertura: dias(-2),
      dataPrevista: dias(0),
      dataConclusao: dias(0),
      totalPecas: 180.00,
      totalMaoObra: 50.00,
      total: 230.00,
      items: {
        create: [
          { tipo: 'PECA', descricao: 'Pneu Michelin 195/55 R16 (x2)', quantidade: 2, precoUnit: 80.00, total: 160.00 },
          { tipo: 'PECA', descricao: 'Válvulas de pneu (x2)', quantidade: 2, precoUnit: 5.00, total: 10.00 },
          { tipo: 'PECA', descricao: 'Pesos de equilibragem', quantidade: 1, precoUnit: 10.00, total: 10.00 },
          { tipo: 'MAO_OBRA', descricao: 'Montagem pneus + alinhamento', quantidade: 1, precoUnit: 50.00, total: 50.00 },
        ],
      },
    },
  })

  // Folha 4 — Carlos / Clio — AGUARDA_PECAS
  const fo4 = await prisma.workOrder.create({
    data: {
      customerId: carlos.id,
      vehicleId: carlos.vehicles[0].id,
      estado: 'AGUARDA_PECAS',
      problema: 'Embraiagem a patinar nas mudanças altas, difícil engrenar 3ª e 4ª',
      diagnostico: 'Kit de embraiagem desgastado, volante motor com desgaste',
      trabalho: 'Substituição kit de embraiagem completo',
      kmEntrada: 112000,
      dataAbertura: dias(-1),
      dataPrevista: dias(5),
      totalPecas: 320.00,
      totalMaoObra: 180.00,
      total: 500.00,
      items: {
        create: [
          { tipo: 'PECA', descricao: 'Kit embraiagem Valeo (disco+platô+rolamento)', quantidade: 1, precoUnit: 280.00, total: 280.00 },
          { tipo: 'PECA', descricao: 'Fluido de embraiagem DOT4 (500ml)', quantidade: 1, precoUnit: 8.00, total: 8.00 },
          { tipo: 'PECA', descricao: 'Vedante caixa de velocidades', quantidade: 1, precoUnit: 12.00, total: 12.00 },
          { tipo: 'PECA', descricao: 'Borracha punho mudanças', quantidade: 1, precoUnit: 20.00, total: 20.00 },
          { tipo: 'MAO_OBRA', descricao: 'Substituição kit embraiagem completo', quantidade: 3, precoUnit: 60.00, total: 180.00 },
        ],
      },
    },
  })

  // Folha 5 — Sofia / Yaris — ABERTA (acabou de entrar)
  const fo5 = await prisma.workOrder.create({
    data: {
      customerId: sofia.id,
      vehicleId: sofia.vehicles[0].id,
      estado: 'ABERTA',
      problema: 'Revisão dos 20.000 km + verificação de avaria no sistema de ar condicionado',
      kmEntrada: 18000,
      dataAbertura: dias(0),
      dataPrevista: dias(2),
      total: 0,
    },
  })

  // Folha 6 — Rui / Focus — EM_DIAGNOSTICO
  const fo6 = await prisma.workOrder.create({
    data: {
      customerId: rui.id,
      vehicleId: rui.vehicles[0].id,
      estado: 'EM_DIAGNOSTICO',
      problema: 'Motor a engasgar a frio, consumo de combustível aumentou muito',
      diagnostico: 'A aguardar leitura de códigos de avaria com equipamento de diagnóstico',
      kmEntrada: 145000,
      dataAbertura: dias(-1),
      dataPrevista: dias(2),
      total: 0,
    },
  })

  console.log('✓ 6 folhas de obra criadas em vários estados')

  // ── TRANSAÇÕES LIGADAS ──────────────────────────────────────────────────────

  if (catManutenção && conta) {
    await prisma.transaction.create({
      data: {
        tipo: 'ENTRADA',
        valor: 205.50,
        descricao: `Folha #${fo1.numero} — Manuel Ferreira / Golf`,
        data: dias(-5),
        accountId: conta.id,
        categoryId: catManutenção.id,
        userId: owner.id,
        customerId: manuel.id,
        workOrderId: fo1.id,
      },
    })
  }

  if (catPneus && conta) {
    await prisma.transaction.create({
      data: {
        tipo: 'ENTRADA',
        valor: 230.00,
        descricao: `Folha #${fo3.numero} — Ana Rodrigues / Peugeot 208`,
        data: dias(0),
        accountId: conta.id,
        categoryId: catPneus.id,
        userId: owner.id,
        customerId: ana.id,
        workOrderId: fo3.id,
      },
    })
  }

  console.log('✓ Transações de exemplo criadas')
  console.log('')
  console.log('Resumo:')
  console.log('  Manuel Ferreira  — VIP      — Golf (Faturada) + Mercedes (Em Reparação)')
  console.log('  Ana Rodrigues    — Recorrente — Peugeot 208 (Concluída)')
  console.log('  Carlos Mendes    — Novo      — Clio (Aguarda Peças)')
  console.log('  Sofia Lopes      — Recorrente — Yaris (Aberta)')
  console.log('  Rui Carvalho     — Inativo   — Focus (Em Diagnóstico)')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
