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
  const [expandedError, setExpandedError] = useState<string | null>(null)

  const paraEsteEstado = templates.filter((t) => {
    if (t.trigger !== 'STATUS_FOLHA') return false
    try { return (JSON.parse(t.triggerEstados) as string[]).includes(workOrderEstado) }
    catch { return false }
  })

  const outros = templates.filter((t) => !paraEsteEstado.includes(t))
  const estadoMeta = STATUS_META[workOrderEstado]

  // Começa fechado se há sugeridas, aberto se não há
  const [open, setOpen] = useState(paraEsteEstado.length === 0)

  const hasAnything = templates.length > 0 || logs.length > 0

  return (
    <div className="card p-0 overflow-hidden">
      {/* Header clicável */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-zinc-100 hover:bg-zinc-50 transition text-left"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-semibold text-zinc-900">Mensagens</span>
          {paraEsteEstado.length > 0 && (
            <span className={cn(
              'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
              estadoMeta.chip
            )}>
              <span className={cn('w-1.5 h-1.5 rounded-full', estadoMeta.dot)} />
              {paraEsteEstado.length} sugerida{paraEsteEstado.length !== 1 ? 's' : ''}
            </span>
          )}
          {logs.length > 0 && (
            <span className="text-xs text-zinc-400">· {logs.length} enviada{logs.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-zinc-400 flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-zinc-400 flex-shrink-0" />
        }
      </button>

      {/* Sugeridas — sempre visíveis (mesmo fechado) */}
      {paraEsteEstado.length > 0 && (
        <div className={cn('px-4 space-y-2', open ? 'pt-3 pb-0' : 'py-3')}>
          {paraEsteEstado.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-semibold text-zinc-900 truncate">{t.nome}</span>
                  <span className={cn('text-xs px-1.5 py-0.5 rounded-full flex-shrink-0', TIPO_META[t.tipo]?.color ?? 'bg-zinc-100 text-zinc-600')}>
                    {TIPO_META[t.tipo]?.label ?? t.tipo}
                  </span>
                </div>
                {open && <p className="text-xs text-zinc-500 font-mono line-clamp-1 mt-0.5">{t.mensagem}</p>}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setSending(t) }}
                className="flex-shrink-0 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
              >
                <Send className="w-3.5 h-3.5" />
                Enviar
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Conteúdo expandido */}
      {open && (
        <div className="px-4 pb-4 space-y-3 mt-3">
          {/* Sem nada */}
          {!hasAnything && (
            <p className="text-sm text-zinc-400 py-2 text-center">
              Nenhuma automação ativa.{' '}
              <a href="/crm/automacoes" className="text-emerald-600 hover:underline">Criar templates</a>
            </p>
          )}

          {/* Outros templates */}
          {outros.length > 0 && (
            <div>
              {paraEsteEstado.length > 0 && (
                <p className="text-xs text-zinc-400 mb-2">Outras mensagens</p>
              )}
              <div className="space-y-1.5">
                {outros.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2"
                  >
                    <span className="text-sm text-zinc-700 font-medium truncate">{t.nome}</span>
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

          {/* Histórico */}
          {logs.length > 0 && (
            <div className={cn('space-y-1.5', (outros.length > 0 || paraEsteEstado.length > 0) && 'pt-1 border-t border-zinc-100')}>
              <p className="text-xs text-zinc-400 mb-1.5">Histórico de envios</p>
              {logs.map((log) => (
                <div key={log.id} className="text-xs flex items-start gap-2">
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
              ))}
            </div>
          )}
        </div>
      )}

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
