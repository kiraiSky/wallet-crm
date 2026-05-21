'use client'

import { useState, useTransition } from 'react'
import { Send, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { cn } from '@/lib/utils'
import { getActiveTemplates, dispararAutomacao } from '@/app/(app)/crm/automacoes/actions'

type SimpleTemplate = {
  id: string
  nome: string
  tipo: string
  mensagem: string
  trigger: string
}

const TIPO_LABELS: Record<string, string> = {
  FOLLOW_UP: 'Follow-up',
  LEMBRETE_PAGAMENTO: 'Pagamento',
  LEMBRETE_LEVANTAMENTO: 'Levantamento',
  CUSTOM: 'Personalizada',
}

const TIPO_COLORS: Record<string, string> = {
  FOLLOW_UP: 'bg-sky-100 text-sky-700',
  LEMBRETE_PAGAMENTO: 'bg-amber-100 text-amber-700',
  LEMBRETE_LEVANTAMENTO: 'bg-emerald-100 text-emerald-700',
  CUSTOM: 'bg-violet-100 text-violet-700',
}

interface Props {
  customerId: string
  workOrderId?: string
  className?: string
}

export function EnviarMensagemButton({ customerId, workOrderId, className }: Props) {
  const [open, setOpen] = useState(false)
  const [templates, setTemplates] = useState<SimpleTemplate[] | null>(null)
  const [selected, setSelected] = useState<SimpleTemplate | null>(null)
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [, startTransition] = useTransition()

  async function handleOpen() {
    setSelected(null)
    setResult(null)
    setOpen(true)
    if (templates === null) {
      setLoading(true)
      const t = await getActiveTemplates()
      setTemplates(t)
      setLoading(false)
    }
  }

  function handleSend() {
    if (!selected) return
    startTransition(async () => {
      const res = await dispararAutomacao(selected.id, customerId, workOrderId)
      setResult(res)
    })
  }

  const list = templates ?? []

  return (
    <>
      <button
        onClick={handleOpen}
        className={cn(
          'inline-flex items-center gap-2 border border-zinc-300 text-zinc-700 hover:bg-zinc-50 text-sm font-medium px-3 py-2 rounded-xl transition',
          className
        )}
      >
        <Send className="w-4 h-4" />
        Enviar mensagem
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Enviar mensagem" size="md">
        <div className="p-5">
          {result ? (
            /* Resultado */
            <div className="text-center py-6">
              {result.ok ? (
                <>
                  <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                  <p className="font-semibold text-zinc-900">Mensagem enviada!</p>
                  <p className="text-sm text-zinc-500 mt-1">O webhook n8n foi disparado com sucesso.</p>
                </>
              ) : (
                <>
                  <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                  <p className="font-semibold text-zinc-900">Falhou</p>
                  <p className="text-sm text-zinc-500 mt-1">{result.error}</p>
                </>
              )}
              <button
                onClick={() => setOpen(false)}
                className="mt-5 w-full bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl py-2.5 text-sm font-medium transition"
              >
                Fechar
              </button>
            </div>
          ) : loading ? (
            /* Loading */
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
            </div>
          ) : list.length === 0 ? (
            /* Sem templates */
            <div className="text-center py-8">
              <p className="text-zinc-500 text-sm">Nenhuma automação ativa.</p>
              <p className="text-zinc-400 text-xs mt-1">
                Cria templates em <strong>CRM → Automações</strong>.
              </p>
              <button onClick={() => setOpen(false)} className="mt-4 text-sm text-zinc-500 hover:text-zinc-700">
                Fechar
              </button>
            </div>
          ) : (
            /* Seleção de template */
            <>
              <p className="text-sm text-zinc-600 mb-3">Seleciona o template a enviar:</p>
              <div className="flex flex-col gap-2 mb-5 max-h-72 overflow-y-auto">
                {list.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelected(t)}
                    className={cn(
                      'text-left p-3 rounded-xl border transition',
                      selected?.id === t.id
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-zinc-200 hover:border-zinc-300 bg-white'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="font-medium text-sm text-zinc-900 truncate">{t.nome}</span>
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full flex-shrink-0',
                        TIPO_COLORS[t.tipo] ?? 'bg-zinc-100 text-zinc-600'
                      )}>
                        {TIPO_LABELS[t.tipo] ?? t.tipo}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 line-clamp-2 font-mono">{t.mensagem}</p>
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setOpen(false)}
                  className="flex-1 border border-zinc-300 text-zinc-700 rounded-xl py-2.5 text-sm font-medium hover:bg-zinc-50 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSend}
                  disabled={!selected}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-medium transition"
                >
                  Enviar
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  )
}
