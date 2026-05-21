import { prisma } from './prisma'

const WEBHOOK_URL = 'https://kiraiskyn8n.duckdns.org/webhook/crm/follow-up'

export function renderMessage(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

export async function fireAutomation(
  templateId: string,
  customerId: string,
  workOrderId?: string
): Promise<{ ok: true } | { ok: false; error: string; detail?: string }> {
  const template = await prisma.automationTemplate.findUnique({ where: { id: templateId } })
  if (!template || !template.ativo) return { ok: false, error: 'Template inativo ou inexistente' }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { vehicles: { where: { archived: false }, orderBy: { createdAt: 'desc' }, take: 1 } },
  })
  if (!customer) return { ok: false, error: 'Cliente não encontrado' }

  let workOrder = null
  if (workOrderId) {
    workOrder = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: { vehicle: true },
    })
  }

  const vehicle = workOrder?.vehicle ?? customer.vehicles[0] ?? null

  const vars: Record<string, string> = {
    nome: customer.nome,
    telefone: customer.telefone ?? '',
    email: customer.email ?? '',
    viatura: vehicle ? `${vehicle.marca} ${vehicle.modelo} ${vehicle.matricula}` : '',
    matricula: vehicle?.matricula ?? '',
    marca: vehicle?.marca ?? '',
    modelo: vehicle?.modelo ?? '',
    numero_folha: workOrder ? String(workOrder.numero) : '',
    data_prevista: workOrder?.dataPrevista
      ? new Date(workOrder.dataPrevista).toLocaleDateString('pt-PT')
      : '',
    valor_total: workOrder ? `${Number(workOrder.total).toFixed(2)} €` : '',
    estado: workOrder?.estado ?? '',
  }

  const mensagem = renderMessage(template.mensagem, vars)

  const payload = {
    tipo: template.tipo,
    templateId: template.id,
    templateNome: template.nome,
    mensagem,
    cliente: {
      id: customer.id,
      nome: customer.nome,
      telefone: customer.telefone ?? null,
      email: customer.email ?? null,
    },
    veiculo: vehicle
      ? { matricula: vehicle.matricula, marca: vehicle.marca, modelo: vehicle.modelo, ano: vehicle.ano ?? null }
      : null,
    folha: workOrder
      ? { id: workOrder.id, numero: workOrder.numero, estado: workOrder.estado, total: Number(workOrder.total).toFixed(2) }
      : null,
    disparadoEm: new Date().toISOString(),
  }

  let webhookOk = false
  let webhookResponse = ''
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    })
    webhookOk = res.ok
    webhookResponse = await res.text().catch(() => '')
  } catch (e) {
    webhookResponse = String(e)
  }

  await prisma.automationLog.create({
    data: {
      templateId: template.id,
      templateNome: template.nome,
      customerId: customer.id,
      workOrderId: workOrderId ?? null,
      mensagemEnviada: mensagem,
      webhookOk,
      webhookResponse: webhookResponse.slice(0, 2000),
    },
  })

  return webhookOk
    ? { ok: true as const }
    : { ok: false as const, error: 'Webhook n8n falhou', detail: webhookResponse.slice(0, 1000) }
}

export async function fireAutomationsByStatus(
  workOrderId: string,
  estado: string,
  customerId: string
) {
  try {
    const templates = await prisma.automationTemplate.findMany({
      where: { ativo: true, trigger: 'STATUS_FOLHA' },
    })
    const matching = templates.filter((t) => {
      try {
        const estados = JSON.parse(t.triggerEstados) as string[]
        return estados.includes(estado)
      } catch {
        return false
      }
    })
    for (const t of matching) {
      fireAutomation(t.id, customerId, workOrderId).catch(console.error)
    }
  } catch (e) {
    console.error('[automations] fireAutomationsByStatus error', e)
  }
}
