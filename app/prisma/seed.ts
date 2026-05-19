import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Usuário OWNER padrão (enquanto não tem auth)
  const owner = await prisma.user.upsert({
    where: { email: 'joao@marcola.com' },
    update: {},
    create: {
      nome: 'João Cunha',
      email: 'joao@marcola.com',
      role: 'OWNER',
    },
  })
  console.log('✓ OWNER:', owner.email)

  // Caixas iniciais
  const caixas = [
    { nome: 'Dinheiro', tipo: 'DINHEIRO' as const, cor: 'emerald', icone: 'banknote', saldoInicial: 0 },
    { nome: 'Conta Itaú', tipo: 'BANCO' as const, cor: 'violet', icone: 'landmark', saldoInicial: 0 },
    { nome: 'Pix', tipo: 'PIX' as const, cor: 'orange', icone: 'smartphone', saldoInicial: 0 },
  ]
  for (const c of caixas) {
    await prisma.account.upsert({
      where: { id: `seed-${c.nome.toLowerCase().replace(/\s/g, '-')}` },
      update: {},
      create: { id: `seed-${c.nome.toLowerCase().replace(/\s/g, '-')}`, ...c },
    })
  }
  console.log('✓ Caixas criados')

  // Categorias de despesa
  const despesas = [
    { nome: 'Peças', cor: 'violet', icone: 'package' },
    { nome: 'Mão de obra', cor: 'orange', icone: 'users' },
    { nome: 'Aluguel', cor: 'sky', icone: 'home' },
    { nome: 'Energia', cor: 'emerald', icone: 'zap' },
    { nome: 'Água', cor: 'cyan', icone: 'droplet' },
    { nome: 'Internet/Telefone', cor: 'pink', icone: 'phone' },
    { nome: 'Outras despesas', cor: 'zinc', icone: 'more-horizontal' },
  ]
  for (const cat of despesas) {
    await prisma.category.upsert({
      where: { nome_tipo: { nome: cat.nome, tipo: 'SAIDA' } },
      update: {},
      create: { ...cat, tipo: 'SAIDA' },
    })
  }
  console.log('✓ Categorias de despesa criadas')

  // Categorias de receita (vamos precisar mais tarde, deixar prontas)
  const receitas = [
    { nome: 'Serviço', cor: 'emerald', icone: 'wrench' },
    { nome: 'Revisão', cor: 'sky', icone: 'car' },
    { nome: 'Venda de peças', cor: 'violet', icone: 'package-2' },
    { nome: 'Outras receitas', cor: 'zinc', icone: 'more-horizontal' },
  ]
  for (const cat of receitas) {
    await prisma.category.upsert({
      where: { nome_tipo: { nome: cat.nome, tipo: 'ENTRADA' } },
      update: {},
      create: { ...cat, tipo: 'ENTRADA' },
    })
  }
  console.log('✓ Categorias de receita criadas')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
