'use client'

import { useRef, useState, useEffect } from 'react'
import { Modal } from '@/components/Modal'
import { cn } from '@/lib/utils'
import type { TemplateInput } from './actions'

const TIPOS = [
  { value: 'FOLLOW_UP', label: 'Follow-up' },
  { value: 'LEMBRETE_PAGAMENTO', label: 'Lembrete de pagamento' },
  { value: 'LEMBRETE_LEVANTAMENTO', label: 'Lembrete de levantamento' },
  { value: 'CUSTOM', label: 'Personalizada' },
]

const TRIGGERS = [
  { value: 'MANUAL', label: 'Manual (acionado manualmente)' },
  { value: 'STATUS_FOLHA', label: 'Mudança de estado da folha' },
]

const ESTADOS = [
  { value: 'ABERTA', label: 'Aberta' },
  { value: 'EM_DIAGNOSTICO', label: 'Em Diagnóstico' },
  { value: 'AGUARDA_PECAS', label: 'Aguarda Peças' },
  { value: 'EM_REPARACAO', label: 'Em Reparação' },
  { value: 'CONCLUIDA', label: 'Concluída' },
  { value: 'FATURADA', label: 'Faturada' },
  { value: 'CANCELADA', label: 'Cancelada' },
]

const VARIABLES = [
  { key: '{{nome}}', hint: 'Nome do cliente' },
  { key: '{{telefone}}', hint: 'Telefone' },
  { key: '{{viatura}}', hint: 'Marca modelo matrícula' },
  { key: '{{matricula}}', hint: 'Matrícula' },
  { key: '{{numero_folha}}', hint: 'Nº folha de obra' },
  { key: '{{data_prevista}}', hint: 'Data prevista conclusão' },
  { key: '{{valor_total}}', hint: 'Valor total da folha' },
]

type InitialData = {
  id: string
  nome: string
  tipo: string
  trigger: string
  triggerEstados: string
  mensagem: string
  ativo: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  onSave: (data: TemplateInput) => Promise<void>
  initial?: InitialData | null
}

export function TemplateModal({ open, onClose, onSave, initial }: Props) {
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<TemplateInput['tipo']>('FOLLOW_UP')
  const [trigger, setTrigger] = useState<TemplateInput['trigger']>('MANUAL')
  const [triggerEstados, setTriggerEstados] = useState<string[]>([])
  const [mensagem, setMensagem] = useState('')
  const [ativo, setAtivo] = useState(true)
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!open) return
    if (initial) {
      setNome(initial.nome)
      setTipo(initial.tipo as TemplateInput['tipo'])
      setTrigger(initial.trigger as TemplateInput['trigger'])
      try { setTriggerEstados(JSON.parse(initial.triggerEstados)) } catch { setTriggerEstados([]) }
      setMensagem(initial.mensagem)
      setAtivo(initial.ativo)
    } else {
      setNome('')
      setTipo('FOLLOW_UP')
      setTrigger('MANUAL')
      setTriggerEstados([])
      setMensagem('')
      setAtivo(true)
    }
  }, [open, initial])

  function insertVariable(v: string) {
    const el = textareaRef.current
    if (!el) {
      setMensagem((m) => m + v)
      return
    }
    const start = el.selectionStart
    const end = el.selectionEnd
    const next = mensagem.slice(0, start) + v + mensagem.slice(end)
    setMensagem(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + v.length, start + v.length)
    })
  }

  function toggleEstado(e: string) {
    setTriggerEstados((prev) =>
      prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]
    )
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!nome.trim() || !mensagem.trim()) return
    setSaving(true)
    try {
      await onSave({ id: initial?.id, nome, tipo, trigger, triggerEstados, mensagem, ativo })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar automação' : 'Nova automação'} size="lg">
      <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
        {/* Nome */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Nome</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            placeholder="Ex: Follow-up pós reparação"
            className="w-full border border-zinc-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Tipo + Ativo */}
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-zinc-700 mb-1">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TemplateInput['tipo'])}
              className="w-full border border-zinc-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col items-center gap-1 pb-1">
            <label className="text-xs font-medium text-zinc-500">Ativo</label>
            <button
              type="button"
              onClick={() => setAtivo((a) => !a)}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                ativo ? 'bg-emerald-500' : 'bg-zinc-200'
              )}
            >
              <span className={cn(
                'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
                ativo ? 'translate-x-5' : 'translate-x-0.5'
              )} />
            </button>
          </div>
        </div>

        {/* Gatilho */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Gatilho</label>
          <select
            value={trigger}
            onChange={(e) => setTrigger(e.target.value as TemplateInput['trigger'])}
            className="w-full border border-zinc-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {TRIGGERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        {/* Estados do gatilho */}
        {trigger === 'STATUS_FOLHA' && (
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Disparar quando a folha mudar para
            </label>
            <div className="flex flex-wrap gap-2">
              {ESTADOS.map((e) => (
                <button
                  key={e.value}
                  type="button"
                  onClick={() => toggleEstado(e.value)}
                  className={cn(
                    'text-xs font-medium px-3 py-1.5 rounded-full border transition',
                    triggerEstados.includes(e.value)
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-zinc-600 border-zinc-300 hover:border-zinc-400'
                  )}
                >
                  {e.label}
                </button>
              ))}
            </div>
            {trigger === 'STATUS_FOLHA' && triggerEstados.length === 0 && (
              <p className="text-xs text-amber-600 mt-1.5">Seleciona pelo menos um estado.</p>
            )}
          </div>
        )}

        {/* Mensagem */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Mensagem</label>
          <textarea
            ref={textareaRef}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            required
            rows={4}
            placeholder="Olá {{nome}}, o seu {{viatura}} está pronto para levantamento!"
            className="w-full border border-zinc-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
          />
          <div className="mt-2">
            <p className="text-xs text-zinc-400 mb-1.5">Clica para inserir variável no cursor:</p>
            <div className="flex flex-wrap gap-1.5">
              {VARIABLES.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertVariable(v.key)}
                  title={v.hint}
                  className="text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-2 py-1 rounded-lg font-mono transition"
                >
                  {v.key}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-zinc-300 text-zinc-700 rounded-xl py-2.5 text-sm font-medium hover:bg-zinc-50 transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !nome.trim() || !mensagem.trim()}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-medium transition"
          >
            {saving ? 'A guardar...' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
