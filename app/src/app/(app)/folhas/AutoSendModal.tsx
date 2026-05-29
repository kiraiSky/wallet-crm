'use client'

import { useState, useTransition } from 'react'
import { Zap, CheckCircle, XCircle, Loader2, X, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dispararAutomacao } from '@/app/(app)/crm/automacoes/actions'
import { STATUS_META, type WorkOrderStatus } from './status'
import type { TemplateParaEnvio } from './ConfirmacaoEnvioModal'

const TIPO_META: Record<string, string> = {
  FOLLOW_UP: 'bg-sky-100 text-sky-700',
  LEMBRETE_PAGAMENTO: 'bg-amber-100 text-amber-700',
  LEMBRETE_LEVANTAMENTO: 'bg-indigo-100 text-indigo-700',
  CUSTOM: 'bg-violet-100 text-violet-700',
}

type SendResult = { templateId: string; ok: boolean; error?: string; detail?: string }

interface Props {
  templates: TemplateParaEnvio[]
  novoEstado: WorkOrderStatus
  customerId: string
  workOrderId: string
  onClose: () => void
}

export function AutoSendModal({ templates, novoEstado, customerId, workOrderId, onClose }: Props) {
  const [results, setResults] = useState<SendResult[]>([])
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [, startTransition] = useTransition()

  const meta = STATUS_META[novoEstado]

  function handleSend() {
    setSending(true)
    startTransition(async () => {
      const out: SendResult[] = []
      for (const t of templates) {
        const res = await dispararAutomacao(t.id, customerId, workOrderId)
        out.push({
          templateId: t.id,
          ok: res.ok,
          error: res.ok ? undefined : res.error,
          detail: (!res.ok && 'detail' in res) ? res.detail : undefined,
        })
        // Update incrementally so user sees progress
        setResults([...out])
      }
      setSending(false)
      setDone(true)
    })
  }

  const hasError = results.some((r) => !r.ok)

  return (
    <div
      className="fixed inset-0 z-[70] bg-zinc-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={!sending ? onClose : undefined}
    >
      <div
        className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-500" />
            <span className="font-bold text-zinc-900">Mensagens automáticas</span>
          </div>
          {!sending && (
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-5">
          {/* Status context */}
          <div className="flex items-center gap-2 mb-4 text-sm text-zinc-600">
            <span>Folha avançou para</span>
            <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium', meta.chip)}>
              <span className={cn('w-1.5 h-1.5 rounded-full', meta.dot)} />
              {meta.label}
            </span>
          </div>

          <p className="text-sm text-zinc-600 mb-4">
            {templates.length === 1
              ? 'Existe 1 mensagem automática configurada para este estado. Deseja enviar?'
              : `Existem ${templates.length} mensagens automáticas configuradas para este estado. Deseja enviar?`}
          </p>

          {/* Template list com resultados */}
          <div className="space-y-2 mb-5">
            {templates.map((t) => {
              const result = results.find((r) => r.templateId === t.id)
              return (
                <div key={t.id} className="flex items-start gap-3 bg-zinc-50 rounded-xl p-3 border border-zinc-200">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-zinc-900 truncate">{t.nome}</span>
                      <span className={cn('text-xs px-1.5 py-0.5 rounded-full flex-shrink-0', TIPO_META[t.tipo] ?? 'bg-zinc-100 text-zinc-600')}>
                        {t.tipo.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 font-mono line-clamp-1">{t.mensagem}</p>
                    {result && !result.ok && (
                      <p className="text-xs text-red-500 mt-1">{result.error}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 mt-0.5">
                    {!result && sending && (
                      <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
                    )}
                    {result?.ok && <CheckCircle className="w-4 h-4 text-indigo-500" />}
                    {result && !result.ok && <XCircle className="w-4 h-4 text-red-400" />}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Ações */}
          {!done ? (
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={sending}
                className="flex-1 border border-zinc-300 text-zinc-700 rounded-xl py-2.5 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 transition"
              >
                Ignorar
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-medium transition flex items-center justify-center gap-2"
              >
                {sending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> A enviar…</>
                ) : (
                  <><Send className="w-4 h-4" /> Enviar {templates.length === 1 ? 'mensagem' : `${templates.length} mensagens`}</>
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={onClose}
              className={cn(
                'w-full rounded-xl py-2.5 text-sm font-medium transition',
                hasError
                  ? 'bg-zinc-200 hover:bg-zinc-300 text-zinc-700'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              )}
            >
              {hasError ? 'Fechar (com erros)' : 'Concluído'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
