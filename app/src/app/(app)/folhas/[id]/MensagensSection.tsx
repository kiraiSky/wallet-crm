'use client'

import { useState } from 'react'
import { MessageSquare, Send, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/format'
import { ConfirmacaoEnvioModal, type TemplateParaEnvio } from '../ConfirmacaoEnvioModal'
import { STATUS_META, type WorkOrderStatus } from '../status'

const TIPO_META: Record<string, { label: string; color: string }> = {
  FOLLOW_UP: { label: 'Follow-up', color: 'bg-sky-100 text-sky-700' },
  LEMBRETE_PAGAMENTO: { label: 'Pagamento', color: 'bg-amber-100 text-amber-700' },
  LEMBRETE_LEVANTAMENTO: { label: 'Levantamento', color: 'bg-emerald-100 text-emerald-700' },
  CUSTOM: { label: 'Personalizada', color: 'bg-violet-100 text-violet-700' },
}

export type TemplateRow = {
  id: string
  nome: string
  tipo: string
  trigger: string
  triggerEstados: string
  mensagem: string
}

export type AutomationLogRow = {
  id: string
  templateNome: string
  mensagemEnviada: string
  webhookOk: boolean
  webhookResponse: string | null
  createdAt: string
}

interface Props {
  customerId: string
  workOrderId: string
  workOrderEstado: WorkOrderStatus
  templates: TemplateRow[]
  logs: AutomationLogRow[]
}

export function MensagensSection({ customerId, workOrderId, workOrderEstado, templates, logs }: Props) {
  const [sending, setSending] = useState<TemplateParaEnvio | null>(null)
  const [historyOpen, setHistoryOpen] = useState(logs.length > 0)
  const [expandedError, setExpandedError] = useState<string | null>(null)

  // Templates que correspondem ao estado atual
  const paraEsteEstado = templates.filter((t) => {
    if (t.trigger !== 'STATUS_FOLHA') return false
    try {
      const estados = JSON.parse(t.triggerEstados) as string[]
      return estados.includes(workOrderEstado)
    } catch { return false }
  })

  // Outros templates ativos (manual ou outros estados)
  const outros = templates.filter((t) => !paraEsteEstado.includes(t))

  const estadoMeta = STATUS_META[workOrderEstado]

  return (
    <div className="card p-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-100">
        <MessageSquare className="w-4 h-4 text-emerald-600" />
        <h2 className="text-sm font-semibold text-zinc-900">Mensagens</h2>
      </div>

      <div className="p-4 space-y-3">
        {/* Para este estado — destaque */}
        {paraEsteEstado.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <span className={cn(
                'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
                estadoMeta.chip
              )}>
                <span className={cn('w-1.5 h-1.5 rounded-full', estadoMeta.dot)} />
                {estadoMeta.label}
              </span>
              <span className="text-xs text-zinc-400">— sugeridas para este estado</span>
            </div>
            <div className="space-y-2">
              {paraEsteEstado.map((t) => (
                <div
                  key={t.id}
                  className="flex items-start justify-between gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span className="text-sm font-semibold text-zinc-900">{t.nome}</span>
                      <span className={cn('text-xs px-1.5 py-0.5 rounded-full', TIPO_META[t.tipo]?.color ?? 'bg-zinc-100 text-zinc-600')}>
                        {TIPO_META[t.tipo]?.label ?? t.tipo}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-600 font-mono line-clamp-2">{t.mensagem}</p>
                  </div>
                  <button
                    onClick={() => setSending(t)}
                    className="flex-shrink-0 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Enviar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Outros templates */}
        {outros.length > 0 && (
          <div>
            {paraEsteEstado.length > 0 && (
              <p className="text-xs text-zinc-400 mb-2">Outras mensagens disponíveis</p>
            )}
            <div className="space-y-1.5">
              {outros.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-sm text-zinc-700 font-medium truncate block">{t.nome}</span>
                  </div>
                  <button
                    onClick={() => setSending(t)}
                    className="flex-shrink-0 flex items-center gap-1 border border-zinc-300 text-zinc-600 hover:bg-zinc-100 text-xs font-medium px-2.5 py-1.5 rounded-lg transition"
                  >
                    <Send className="w-3 h-3" />
                    Enviar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {templates.length === 0 && (
          <p className="text-sm text-zinc-400 py-2 text-center">
            Nenhuma automação ativa.{' '}
            <a href="/crm/automacoes" className="text-emerald-600 hover:underline">Criar templates</a>
          </p>
        )}

        {/* Histórico */}
        {logs.length > 0 && (
          <div className="pt-1">
            <button
              onClick={() => setHistoryOpen((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 transition w-full"
            >
              {historyOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              Histórico de envios ({logs.length})
            </button>
            {historyOpen && (
              <div className="mt-2 space-y-1.5">
                {logs.map((log) => (
                  <div key={log.id} className="text-xs">
                    <div className="flex items-start gap-2">
                      {log.webhookOk
                        ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                        : <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                      }
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-zinc-700 truncate">{log.templateNome}</span>
                          <span className="text-zinc-400">{formatDateTime(log.createdAt)}</span>
                        </div>
                        <p className="text-zinc-500 truncate font-mono">{log.mensagemEnviada}</p>
                        {!log.webhookOk && log.webhookResponse && (
                          <div>
                            <button
                              onClick={() => setExpandedError(expandedError === log.id ? null : log.id)}
                              className="text-red-400 hover:text-red-600 underline mt-0.5"
                            >
                              {expandedError === log.id ? 'Ocultar erro' : 'Ver erro'}
                            </button>
                            {expandedError === log.id && (
                              <pre className="mt-1 bg-red-50 border border-red-200 rounded-lg p-2 text-red-700 overflow-auto max-h-20 whitespace-pre-wrap">
                                {log.webhookResponse}
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmacaoEnvioModal
        template={sending}
        customerId={customerId}
        workOrderId={workOrderId}
        onClose={() => setSending(null)}
        onSent={() => setSending(null)}
      />
    </div>
  )
}
