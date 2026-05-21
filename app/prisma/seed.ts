import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Utilizador OWNER por defeito
  const senhaHash = await bcrypt.hash('admin123', 10)
  const owner = await prisma.user.upsert({
    where: { email: 'joao@carteira.app' },
    update: { senha: senhaHash, role: 'OWNER', active: true },
    create: {
      nome: 'João Cunha',
      email: 'joao@carteira.app',
      senha: senhaHash,
      role: 'OWNER',
    },
  })
  console.log('✓ OWNER:', owner.email, '(senha: admin123)')

  // Conta inicial: apenas a Carteira
  await prisma.account.upsert({
    where: { id: 'seed-carteira' },
    update: {},
    create: {
      id: 'seed-carteira',
      nome: 'Carteira',
      tipo: 'DINHEIRO',
      cor: 'emerald',
      icone: 'wallet',
      saldoInicial: 0,
    },
  })
  console.log('✓ Conta Carteira criada')

  // Categorias de despesa (oficina mecânica, pt-PT)
  const despesas = [
    { nome: 'Peças', cor: 'violet', icone: 'package' },
    { nome: 'Mão de obra', cor: 'orange', icone: 'users' },
    { nome: 'Ferramentas', cor: 'amber', icone: 'hammer' },
    { nome: 'Consumíveis', cor: 'cyan', icone: 'droplets' },
    { nome: 'Combustível', cor: 'rose', icone: 'fuel' },
    { nome: 'Renda do espaço', cor: 'sky', icone: 'home' },
    { nome: 'Energia', cor: 'amber', icone: 'zap' },
    { nome: 'Água', cor: 'cyan', icone: 'droplet' },
    { nome: 'Telecomunicações', cor: 'pink', icone: 'phone' },
    { nome: 'Seguros', cor: 'teal', icone: 'shield' },
    { nome: 'Impostos', cor: 'zinc', icone: 'receipt' },
    { nome: 'Marketing', cor: 'rose', icone: 'megaphone' },
    { nome: 'Outras despesas', cor: 'zinc', icone: 'more-horizontal' },
  ]
  await prisma.category.createMany({
    data: despesas.map(cat => ({ ...cat, tipo: 'SAIDA' as const })),
    skipDuplicates: true,
  })
  console.log('✓ Categorias de despesa criadas')

  // Categorias de receita (oficina mecânica, pt-PT)
  const receitas = [
    { nome: 'Manutenção', cor: 'emerald', icone: 'wrench' },
    { nome: 'Reparação', cor: 'orange', icone: 'hammer' },
    { nome: 'Mudança de óleo', cor: 'amber', icone: 'droplet' },
    { nome: 'Pneus', cor: 'zinc', icone: 'circle-dot' },
    { nome: 'Alinhamento', cor: 'sky', icone: 'cog' },
    { nome: 'Diagnóstico', cor: 'rose', icone: 'activity' },
    { nome: 'Inspeção', cor: 'teal', icone: 'clipboard-check' },
    { nome: 'Venda de peças', cor: 'violet', icone: 'package-2' },
    { nome: 'Outras receitas', cor: 'zinc', icone: 'more-horizontal' },
  ]
  await prisma.category.createMany({
    data: receitas.map(cat => ({ ...cat, tipo: 'ENTRADA' as const })),
    skipDuplicates: true,
  })
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
