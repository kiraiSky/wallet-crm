'use client'

import { useState, useTransition, useEffect } from 'react'
import { Loader2, Send, AlertTriangle, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dispararAutomacao } from '@/app/(app)/crm/automacoes/actions'

const TIPO_META: Record<string, { label: string; color: string }> = {
  FOLLOW_UP: { label: 'Follow-up', color: 'bg-sky-100 text-sky-700' },
  LEMBRETE_PAGAMENTO: { label: 'Lembrete de pagamento', color: 'bg-amber-100 text-amber-700' },
  LEMBRETE_LEVANTAMENTO: { label: 'Lembrete de levantamento', color: 'bg-indigo-100 text-indigo-700' },
  CUSTOM: { label: 'Personalizada', color: 'bg-violet-100 text-violet-700' },
}

export type TemplateParaEnvio = {
  id: string
  nome: string
  tipo: string
  mensagem: string
}

interface Props {
  template: TemplateParaEnvio | null
  customerId: string
  workOrderId?: string
  onClose: () => void
  onSent?: () => void
}

type State = 'confirm' | 'sending' | 'success' | 'error'

export function ConfirmacaoEnvioModal({ template, customerId, workOrderId, onClose, onSent }: Props) {
  const [state, setState] = useState<State>('confirm')
  const [errorMsg, setErrorMsg] = useState('')
  const [errorDetail, setErrorDetail] = useState('')
  const [showDetail, setShowDetail] = useState(false)
  const [, startTransition] = useTransition()

  // Auto-close after success animation completes
  useEffect(() => {
    if (state !== 'success') return
    const t = setTimeout(() => {
      onSent?.()
      onClose()
    }, 1800)
    return () => clearTimeout(t)
  }, [state, onClose, onSent])

  if (!template) return null

  const activeTemplate = template
  const meta = TIPO_META[activeTemplate.tipo] ?? { label: activeTemplate.tipo, color: 'bg-zinc-100 text-zinc-600' }

  function handleConfirm() {
    setState('sending')
    startTransition(async () => {
      const res = await dispararAutomacao(activeTemplate.id, customerId, workOrderId)
      if (res.ok) {
        setState('success')
        // onSent and onClose are called by the useEffect after the animation (1800ms)
      } else {
        setState('error')
        setErrorMsg(res.error)
        setErrorDetail('detail' in res ? (res.detail ?? '') : '')
      }
    })
  }

  function handleRetry() {
    setState('confirm')
    setShowDetail(false)
  }

  return (
    <div
      className="fixed inset-0 z-[70] bg-zinc-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={state === 'sending' ? undefined : onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-zinc-400" />
            <span className="font-bold text-zinc-900">Confirmar envio</span>
          </div>
        </div>

        <div className="p-5">
          {state === 'confirm' && (
            <>
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-semibold text-zinc-900">{activeTemplate.nome}</span>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', meta.color)}>
                    {meta.label}
                  </span>
                </div>
                <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200">
                  <p className="text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap font-mono">
                    {activeTemplate.mensagem}
                  </p>
                </div>
                <p className="text-xs text-zinc-400 mt-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                  As variáveis {'{{nome}}'}, {'{{viatura}}'}, etc. serão substituídas pelos dados reais do cliente.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 border border-zinc-300 text-zinc-700 rounded-xl py-2.5 text-sm font-medium hover:bg-zinc-50 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 text-sm font-medium transition flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Confirmar envio
                </button>
              </div>
            </>
          )}

          {state === 'sending' && (
            <div className="flex flex-col items-center py-8 gap-3">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <p className="text-sm text-zinc-500">A enviar para o webhook n8n…</p>
            </div>
          )}

          {state === 'success' && (
            <div className="flex flex-col items-center py-6">
              <style>{`
                @keyframes circle-pop {
                  0%   { transform: scale(0); opacity: 0; }
                  60%  { transform: scale(1.15); opacity: 1; }
                  80%  { transform: scale(0.95); }
                  100% { transform: scale(1); }
                }
                @keyframes check-draw {
                  to { stroke-dashoffset: 0; }
                }
                .sucesso-circulo {
                  transform-box: fill-box;
                  transform-origin: center;
                  animation: circle-pop 0.45s cubic-bezier(0.22,1,0.36,1) both;
                }
                .sucesso-check {
                  stroke-dasharray: 48;
                  stroke-dashoffset: 48;
                  animation: check-draw 0.35s ease-out 0.4s forwards;
                }
              `}</style>
              <svg
                viewBox="0 0 56 56"
                className="w-20 h-20"
                style={{ overflow: 'visible' }}
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  className="sucesso-circulo"
                  cx="28" cy="28" r="26"
                  fill="#dcfce7"
                  stroke="#4f46e5"
                  strokeWidth="2"
                />
                <path
                  className="sucesso-check"
                  d="M16 28.5l8.5 8.5 16-17"
                  stroke="#16a34a"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="font-semibold text-zinc-900 mt-4">Mensagem enviada!</p>
              <p className="text-sm text-zinc-400 mt-1">A fechar…</p>
            </div>
          )}

          {state === 'error' && (
            <div className="py-2">
              <div className="flex flex-col items-center mb-4">
                <style>{`
                  @keyframes erro-circle-pop {
                    0%   { transform: scale(0); opacity: 0; }
                    60%  { transform: scale(1.15); opacity: 1; }
                    80%  { transform: scale(0.95); }
                    100% { transform: scale(1); }
                  }
                  @keyframes x-draw {
                    to { stroke-dashoffset: 0; }
                  }
                  .erro-circulo {
                    transform-box: fill-box;
                    transform-origin: center;
                    animation: erro-circle-pop 0.45s cubic-bezier(0.22,1,0.36,1) both;
                  }
                  .erro-x-line {
                    stroke-dasharray: 30;
                    stroke-dashoffset: 30;
                    animation: x-draw 0.25s ease-out 0.4s forwards;
                  }
                `}</style>
                <svg
                  viewBox="0 0 56 56"
                  className="w-20 h-20 mb-2"
                  style={{ overflow: 'visible' }}
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle
                    className="erro-circulo"
                    cx="28" cy="28" r="26"
                    fill="#fee2e2"
                    stroke="#f87171"
                    strokeWidth="2"
                  />
                  <line className="erro-x-line" x1="19" y1="19" x2="37" y2="37" stroke="#dc2626" strokeWidth="3.2" strokeLinecap="round" />
                  <line className="erro-x-line" x1="37" y1="19" x2="19" y2="37" stroke="#dc2626" strokeWidth="3.2" strokeLinecap="round" />
                </svg>
                <p className="font-semibold text-zinc-900">Falha no envio</p>
                <p className="text-sm text-zinc-600 mt-1 text-center">{errorMsg}</p>
              </div>
              {errorDetail && (
                <div className="mb-4">
                  <button
                    onClick={() => setShowDetail((v) => !v)}
                    className="text-xs text-zinc-400 hover:text-zinc-600 underline"
                  >
                    {showDetail ? 'Ocultar' : 'Ver'} resposta do webhook
                  </button>
                  {showDetail && (
                    <pre className="mt-2 bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 overflow-auto max-h-28 whitespace-pre-wrap">
                      {errorDetail}
                    </pre>
                  )}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 border border-zinc-300 text-zinc-700 rounded-xl py-2.5 text-sm font-medium hover:bg-zinc-50 transition"
                >
                  Fechar
                </button>
                <button
                  onClick={handleRetry}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5 text-sm font-medium transition flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Tentar novamente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
