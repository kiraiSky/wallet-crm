import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Remove templates existentes para evitar duplicados
  const existing = await prisma.automationTemplate.count()
  if (existing > 0) {
    await prisma.automationTemplate.deleteMany({})
    console.log(`  Removidos ${existing} templates anteriores`)
  }

  await prisma.automationTemplate.createMany({
    data: [
      {
        nome: 'Viatura pronta para levantamento',
        tipo: 'LEMBRETE_LEVANTAMENTO',
        trigger: 'STATUS_FOLHA',
        triggerEstados: JSON.stringify(['CONCLUIDA']),
        mensagem: 'Olá {{nome}}! O seu {{viatura}} já está pronto para levantamento na nossa oficina. Qualquer dúvida estamos à disposição. Até já!',
        ativo: true,
      },
      {
        nome: 'Lembrete de pagamento',
        tipo: 'LEMBRETE_PAGAMENTO',
        trigger: 'STATUS_FOLHA',
        triggerEstados: JSON.stringify(['FATURADA']),
        mensagem: 'Olá {{nome}}, a fatura da folha nº {{numero_folha}} referente ao seu {{viatura}} está disponível. Valor total: {{valor_total}}. Obrigado pela confiança!',
        ativo: true,
      },
      {
        nome: 'Follow-up pós serviço',
        tipo: 'FOLLOW_UP',
        trigger: 'STATUS_FOLHA',
        triggerEstados: JSON.stringify(['FATURADA']),
        mensagem: 'Olá {{nome}}! Esperamos que o seu {{viatura}} esteja a funcionar às mil maravilhas. Se tiver alguma questão ou precisar de nova visita, estamos aqui. Obrigado!',
        ativo: true,
      },
      {
        nome: 'Peças encomendadas',
        tipo: 'CUSTOM',
        trigger: 'STATUS_FOLHA',
        triggerEstados: JSON.stringify(['AGUARDA_PECAS']),
        mensagem: 'Olá {{nome}}! As peças para o seu {{viatura}} já foram encomendadas. Assim que chegarem entramos em contacto para agendar a reparação. Obrigado pela paciência!',
        ativo: true,
      },
      {
        nome: 'Diagnóstico iniciado',
        tipo: 'CUSTOM',
        trigger: 'STATUS_FOLHA',
        triggerEstados: JSON.stringify(['EM_DIAGNOSTICO']),
        mensagem: 'Olá {{nome}}! O seu {{viatura}} (folha nº {{numero_folha}}) entrou em diagnóstico. Data prevista: {{data_prevista}}. Qualquer novidade avisamos!',
        ativo: true,
      },
      {
        nome: 'Contacto manual personalizado',
        tipo: 'CUSTOM',
        trigger: 'MANUAL',
        triggerEstados: JSON.stringify([]),
        mensagem: 'Olá {{nome}}, é da oficina. Queríamos saber se está satisfeito com o serviço realizado no seu {{viatura}}. Estamos sempre à disposição!',
        ativo: true,
      },
    ],
  })

  console.log('✓ 6 templates de automação criados')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
