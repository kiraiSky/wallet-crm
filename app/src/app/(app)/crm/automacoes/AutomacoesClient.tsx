'use client'

import { useState, useTransition } from 'react'
import {
  Plus, Zap, Edit2, Trash2, CheckCircle, XCircle,
  BellRing, MessageCircle, Bot, Car,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/format'
import { TemplateModal } from './TemplateModal'
import { saveTemplate, deleteTemplate, toggleTemplate, type TemplateInput } from './actions'
import type { AutomationType, AutomationTrigger } from '@prisma/client'

type TemplateWithCount = {
  id: string
  nome: string
  tipo: AutomationType
  trigger: AutomationTrigger
  triggerEstados: string
  mensagem: string
  ativo: boolean
  createdAt: Date
  updatedAt: Date
  _count: { logs: number }
}

type LogWithRelations = {
  id: string
  templateNome: string
  mensagemEnviada: string
  webhookOk: boolean
  createdAt: Date
  template: { nome: string; tipo: string } | null
  customer: { nome: string; telefone: string | null }
  workOrder: { numero: number } | null
}

interface Props {
  templates: TemplateWithCount[]
  logs: LogWithRelations[]
}

const TIPO_META: Record<AutomationType, { label: string; color: string; icon: React.ElementType }> = {
  FOLLOW_UP: { label: 'Follow-up', color: 'bg-sky-100 text-sky-700', icon: MessageCircle },
  LEMBRETE_PAGAMENTO: { label: 'Pagamento', color: 'bg-amber-100 text-amber-700', icon: BellRing },
  LEMBRETE_LEVANTAMENTO: { label: 'Levantamento', color: 'bg-indigo-100 text-indigo-700', icon: Car },
  CUSTOM: { label: 'Personalizada', color: 'bg-violet-100 text-violet-700', icon: Bot },
}

const STATUS_LABELS: Record<string, string> = {
  ABERTA: 'Aberta',
  EM_DIAGNOSTICO: 'Em Diagnóstico',
  AGUARDA_PECAS: 'Aguarda Peças',
  EM_REPARACAO: 'Em Reparação',
  CONCLUIDA: 'Concluída',
  FATURADA: 'Faturada',
  CANCELADA: 'Cancelada',
}

export function AutomacoesClient({ templates, logs }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TemplateWithCount | null>(null)
  const [, startTransition] = useTransition()

  function openNew() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(t: TemplateWithCount) {
    setEditing(t)
    setModalOpen(true)
  }

  function handleDelete(id: string) {
    if (!confirm('Eliminar esta automação? O histórico de envios será mantido.')) return
    startTransition(() => deleteTemplate(id))
  }

  function handleToggle(id: string, ativo: boolean) {
    startTransition(() => toggleTemplate(id, ativo))
  }

  async function handleSave(data: TemplateInput) {
    await saveTemplate(data)
    setModalOpen(false)
  }

  return (
    <div>
      {/* Cabeçalho */}
      <div className="flex items-start justify-between mb-6 gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Automações</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Mensagens disparadas automaticamente por eventos do funil ou manualmente
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex-shrink-0 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition"
        >
          <Plus className="w-4 h-4" />
          Nova
        </button>
      </div>

      {/* Templates */}
      {templates.length === 0 ? (
        <div className="text-center py-16 bg-zinc-50 rounded-2xl border border-zinc-200 border-dashed">
          <Zap className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
          <p className="font-semibold text-zinc-500">Nenhuma automação configurada</p>
          <p className="text-sm text-zinc-400 mt-1 mb-4">
            Cria templates de mensagens para follow-ups, lembretes de pagamento ou levantamento
          </p>
          <button
            onClick={openNew}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            + Criar primeira automação
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((t) => {
            const meta = TIPO_META[t.tipo]
            const Icon = meta.icon
            const estados: string[] = (() => {
              try { return JSON.parse(t.triggerEstados) } catch { return [] }
            })()
            return (
              <div
                key={t.id}
                className={cn(
                  'bg-white rounded-2xl border border-zinc-200 p-4 flex flex-col gap-3 transition',
                  !t.ativo && 'opacity-55'
                )}
              >
                {/* Linha de topo */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                    <span className="font-semibold text-zinc-900 truncate">{t.nome}</span>
                  </div>
                  <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0', meta.color)}>
                    {meta.label}
                  </span>
                </div>

                {/* Gatilho */}
                <div className="flex items-start gap-1.5 text-xs text-zinc-500">
                  <Zap className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-zinc-400" />
                  <span>
                    {t.trigger === 'MANUAL'
                      ? 'Disparo manual'
                      : estados.length > 0
                        ? `Quando folha → ${estados.map((e) => STATUS_LABELS[e] ?? e).join(', ')}`
                        : 'Mudança de estado (sem estados configurados)'}
                  </span>
                </div>

                {/* Preview da mensagem */}
                <p className="text-sm text-zinc-600 line-clamp-2 font-mono bg-zinc-50 rounded-lg px-2.5 py-1.5 text-xs">
                  {t.mensagem}
                </p>

                {/* Rodapé */}
                <div className="flex items-center justify-between pt-1 border-t border-zinc-100">
                  <span className="text-xs text-zinc-400">{t._count.logs} envio{t._count.logs !== 1 ? 's' : ''}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggle(t.id, !t.ativo)}
                      title={t.ativo ? 'Desativar' : 'Ativar'}
                      className={cn(
                        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                        t.ativo ? 'bg-indigo-500' : 'bg-zinc-200'
                      )}
                    >
                      <span className={cn(
                        'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                        t.ativo ? 'translate-x-4' : 'translate-x-0.5'
                      )} />
                    </button>
                    <button
                      onClick={() => openEdit(t)}
                      className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100 transition"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="text-zinc-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Card de adicionar */}
          <button
            onClick={openNew}
            className="bg-zinc-50 hover:bg-zinc-100 border border-dashed border-zinc-300 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 text-zinc-400 hover:text-zinc-600 transition min-h-[180px]"
          >
            <Plus className="w-6 h-6" />
            <span className="text-sm font-medium">Nova automação</span>
          </button>
        </div>
      )}

      {/* Histórico */}
      {logs.length > 0 && (
        <div className="mt-8">
          <h2 className="text-base font-semibold text-zinc-900 mb-3">Histórico de envios</h2>
          <div className="bg-white rounded-2xl border border-zinc-200 divide-y divide-zinc-100 overflow-hidden">
            {logs.map((log) => (
              <div key={log.id} className="px-4 py-3 flex items-center gap-3">
                {log.webhookOk
                  ? <CheckCircle className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                  : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    <span className="font-medium text-zinc-900 truncate">{log.customer.nome}</span>
                    {log.workOrder && (
                      <span className="text-xs text-zinc-400">Folha #{log.workOrder.numero}</span>
                    )}
                    <span className="text-xs text-zinc-400">· {log.templateNome}</span>
                  </div>
                  <p className="text-xs text-zinc-500 truncate mt-0.5">{log.mensagemEnviada}</p>
                </div>
                <span className="text-xs text-zinc-400 whitespace-nowrap flex-shrink-0">
                  {formatDateTime(log.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <TemplateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        initial={editing}
      />
    </div>
  )
}
