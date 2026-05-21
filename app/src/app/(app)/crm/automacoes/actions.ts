'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { fireAutomation } from '@/lib/automations'

export type TemplateInput = {
  id?: string
  nome: string
  tipo: 'FOLLOW_UP' | 'LEMBRETE_PAGAMENTO' | 'LEMBRETE_LEVANTAMENTO' | 'CUSTOM'
  trigger: 'MANUAL' | 'STATUS_FOLHA'
  triggerEstados: string[]
  mensagem: string
  ativo: boolean
}

export async function getTemplates() {
  return prisma.automationTemplate.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { logs: true } } },
  })
}

export async function getActiveTemplates() {
  return prisma.automationTemplate.findMany({
    where: { ativo: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, nome: true, tipo: true, mensagem: true, trigger: true },
  })
}

export async function saveTemplate(data: TemplateInput) {
  const payload = {
    nome: data.nome.trim(),
    tipo: data.tipo,
    trigger: data.trigger,
    triggerEstados: JSON.stringify(data.triggerEstados),
    mensagem: data.mensagem.trim(),
    ativo: data.ativo,
  }
  if (data.id) {
    await prisma.automationTemplate.update({ where: { id: data.id }, data: payload })
  } else {
    await prisma.automationTemplate.create({ data: payload })
  }
  revalidatePath('/crm/automacoes')
}

export async function deleteTemplate(id: string) {
  await prisma.automationTemplate.delete({ where: { id } })
  revalidatePath('/crm/automacoes')
}

export async function toggleTemplate(id: string, ativo: boolean) {
  await prisma.automationTemplate.update({ where: { id }, data: { ativo } })
  revalidatePath('/crm/automacoes')
}

export async function dispararAutomacao(
  templateId: string,
  customerId: string,
  workOrderId?: string
): Promise<{ ok: boolean; error?: string }> {
  return fireAutomation(templateId, customerId, workOrderId)
}

export async function getRecentLogs(limit = 40) {
  return prisma.automationLog.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      template: { select: { nome: true, tipo: true } },
      customer: { select: { nome: true, telefone: true } },
      workOrder: { select: { numero: true } },
    },
  })
}
