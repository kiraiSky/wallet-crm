'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Pencil, Trash2, Plus, Package, Wrench, Car,
  ChevronRight, CheckCircle2, TrendingUp, TrendingDown, Paperclip,
  MessageCircle, Phone, Printer,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatEUR, formatDate, formatDateTime, whatsappUrl } from '@/lib/format'
import { colorIconBg } from '@/lib/colors'
import { DynamicIcon } from '@/components/DynamicIcon'
import { STATUS_LIST, STATUS_META, nextStatus, type WorkOrderStatus } from '../status'
import { WorkOrderModal, type WorkOrderForModal } from '../WorkOrderModal'
import { ItemModal } from './ItemModal'
import { TransactionModal } from '../../lancamentos/TransactionModal'
import { AttachmentViewer, AttachmentThumb, type ViewerTransaction } from '@/components/AttachmentViewer'
import {
  deleteWorkOrder,
  changeStatus,
  deleteWorkOrderItem,
  updateWorkOrderItemField,
} from '../actions'
import type { WorkOrderDetail, WorkOrderItemRow, WorkOrderTransactionRow } from './page'
import { openCustomerQuickView } from '@/lib/customerBus'
import { MensagensSection, type TemplateRow, type AutomationLogRow } from './MensagensSection'
import { AutoSendModal } from '../AutoSendModal'
import type { TemplateParaEnvio } from '../ConfirmacaoEnvioModal'
import { MoloniInvoiceButton } from './MoloniInvoiceButton'
import { ShareButton } from './ShareButton'
import { CaucaoButton } from './CaucaoButton'
import { CaucoesList } from './CaucoesList'

type AccountOption = { id: string; nome: string; cor: string; icone: string }
type CategoryOption = {
  id: string
  nome: string
  tipo: 'ENTRADA' | 'SAIDA'
  cor: string
  icone: string
  parentId?: string | null
}

interface Props {
  workOrder: WorkOrderDetail
  transactions: WorkOrderTransactionRow[]
  accounts: AccountOption[]
  categories: CategoryOption[]
  templates: TemplateRow[]
  automationLogs: AutomationLogRow[]
}

export function WorkOrderDetailClient({ workOrder, transactions, accounts, categories, templates, automationLogs }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [editOpen, setEditOpen] = useState(false)
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<WorkOrderItemRow | null>(null)
  const [itemTipoPadrao, setItemTipoPadrao] = useState<'PECA' | 'MAO_OBRA'>('PECA')
  const [statusOpen, setStatusOpen] = useState(false)
  const [txModalOpen, setTxModalOpen] = useState(false)
  const [txModalTipo, setTxModalTipo] = useState<'ENTRADA' | 'SAIDA'>('SAIDA')
  const [editingTx, setEditingTx] = useState<WorkOrderTransactionRow | null>(null)
  const [viewerTx, setViewerTx] = useState<WorkOrderTransactionRow | null>(null)
  const [viewerAttachmentId, setViewerAttachmentId] = useState<string | undefined>()
  const [autoSend, setAutoSend] = useState<{ templates: TemplateParaEnvio[]; estado: WorkOrderStatus } | null>(null)

  const workOrderOption = [{
    id: workOrder.id,
    numero: workOrder.numero,
    customerNome: workOrder.customer.nome,
    problema: workOrder.problema,
    customerId: workOrder.customer.id,
  }]

  const woForModal: WorkOrderForModal = {
    id: workOrder.id,
    customerId: workOrder.customer.id,
    vehicleId: workOrder.vehicle?.id ?? null,
    problema: workOrder.problema,
    diagnostico: workOrder.diagnostico,
    trabalho: workOrder.trabalho,
    observacoes: workOrder.observacoes,
    kmEntrada: workOrder.kmEntrada,
    dataPrevista: workOrder.dataPrevista,
  }

  const meta = STATUS_META[workOrder.estado]
  const proximoEstado = nextStatus(workOrder.estado)

  function openNewItem(tipo: 'PECA' | 'MAO_OBRA') {
    setEditingItem(null)
    setItemTipoPadrao(tipo)
    setItemModalOpen(true)
  }

  function openEditItem(it: WorkOrderItemRow) {
    setEditingItem(it)
    setItemTipoPadrao(it.tipo)
    setItemModalOpen(true)
  }

  function handleDeleteItem(it: WorkOrderItemRow) {
    if (!confirm(`Eliminar "${it.descricao}"?`)) return
    startTransition(async () => {
      await deleteWorkOrderItem(it.id)
      router.refresh()
    })
  }

  function handleDeleteWorkOrder() {
    if (
      !confirm(
        `Eliminar a folha #${workOrder.numero}?\nEsta ação é permanente e remove também todos os items.`
      )
    )
      return
    startTransition(async () => {
      await deleteWorkOrder(workOrder.id)
      router.push('/folhas')
    })
  }

  function handleChangeStatus(novo: WorkOrderStatus) {
    startTransition(async () => {
      await changeStatus(workOrder.id, novo)
      setStatusOpen(false)
      // Verificar templates automáticos para o novo estado
      const matching = templates.filter((t) => {
        if (t.trigger !== 'STATUS_FOLHA') return false
        try { return (JSON.parse(t.triggerEstados) as string[]).includes(novo) }
        catch { return false }
      })
      if (matching.length > 0) setAutoSend({ templates: matching, estado: novo })
      router.refresh()
    })
  }

  const items = workOrder.items
  const pecas = items.filter((i) => i.tipo === 'PECA')
  const maoObra = items.filter((i) => i.tipo === 'MAO_OBRA')

  return (
    <>
      <Link
        href="/folhas"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Folhas de obra
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-zinc-900">Folha #{workOrder.numero}</h1>
            <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium', meta.chip)}>
              <span className={cn('w-1.5 h-1.5 rounded-full', meta.dot)} />
              {meta.label}
            </span>
          </div>
          <div className="text-sm text-zinc-500 flex flex-wrap gap-x-3 gap-y-0.5">
            <span>Aberta em {formatDate(workOrder.dataAbertura)}</span>
            {workOrder.dataPrevista && <span>· Prevista {formatDate(workOrder.dataPrevista)}</span>}
            {workOrder.dataConclusao && <span>· Concluída {formatDate(workOrder.dataConclusao)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {proximoEstado && (
            <button
              onClick={() => handleChangeStatus(proximoEstado)}
              className="btn-primary"
              title={`Avançar para ${STATUS_META[proximoEstado].label}`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {STATUS_META[proximoEstado].label}
            </button>
          )}
          <div className="relative">
            <button onClick={() => setStatusOpen((v) => !v)} className="btn-secondary">
              Estado <ChevronRight className="w-4 h-4 rotate-90" />
            </button>
            {statusOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setStatusOpen(false)} />
                <div className="absolute right-0 top-full mt-1 bg-white border border-zinc-200 rounded-xl shadow-lg w-56 py-1 z-20">
                  {STATUS_LIST.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleChangeStatus(s)}
                      className={cn(
                        'w-full text-left px-3 py-2 hover:bg-zinc-50 flex items-center gap-2 text-sm',
                        s === workOrder.estado && 'bg-zinc-50 font-semibold'
                      )}
                    >
                      <span className={cn('w-2 h-2 rounded-full', STATUS_META[s].dot)} />
                      {STATUS_META[s].label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => window.open(`/imprimir/folha/${workOrder.id}`, '_blank')}
            className="btn-secondary inline-flex items-center gap-2 text-sm"
            title="Imprimir folha de obra"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
          <ShareButton
            workOrderId={workOrder.id}
            numero={workOrder.numero}
            initialToken={workOrder.shareToken}
          />
          {!workOrder.moloniDocumentId && (
            <CaucaoButton
              workOrderId={workOrder.id}
              workOrderNumero={workOrder.numero}
              customerNome={workOrder.customer.nome}
              customerNif={workOrder.customer.nif}
              totalRestante={workOrder.totalRestante}
              accounts={accounts}
              categories={categories.map((c) => ({ id: c.id, nome: c.nome, tipo: c.tipo, parentId: c.parentId ?? null }))}
            />
          )}
          <MoloniInvoiceButton
            workOrderId={workOrder.id}
            moloniDocumentId={workOrder.moloniDocumentId}
            moloniDocumentType={workOrder.moloniDocumentType}
            total={workOrder.total}
            customerNome={workOrder.customer.nome}
            customerNif={workOrder.customer.nif}
          />
          <button onClick={() => setEditOpen(true)} className="btn-secondary">
            <Pencil className="w-4 h-4" /> Editar
          </button>
          <button onClick={handleDeleteWorkOrder} className="btn-secondary text-red-600 hover:bg-red-50">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Coluna esquerda: cliente, viatura, problema */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card p-5">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Cliente</h2>
            <button
              type="button"
              onClick={() => openCustomerQuickView(workOrder.customer.id)}
              className="text-base font-semibold text-zinc-900 hover:text-emerald-600 text-left"
            >
              {workOrder.customer.nome}
            </button>
            {workOrder.customer.telefone && (() => {
              const wa = whatsappUrl(workOrder.customer.telefone)
              return (
                <div className="inline-flex items-center gap-1 mt-1">
                  {wa ? (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-zinc-600 hover:text-emerald-600"
                      title="Abrir no WhatsApp"
                    >
                      <MessageCircle className="w-4 h-4 text-emerald-500" />
                      {workOrder.customer.telefone}
                    </a>
                  ) : (
                    <span className="text-sm text-zinc-500">{workOrder.customer.telefone}</span>
                  )}
                  <a
                    href={`tel:${workOrder.customer.telefone}`}
                    className="inline-flex items-center justify-center w-6 h-6 text-zinc-400 hover:text-zinc-700"
                    title="Chamar"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                </div>
              )
            })()}
          </div>

          {workOrder.vehicle && (
            <div className="card p-5">
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Viatura</h2>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center flex-shrink-0">
                  <Car className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-mono font-bold tracking-wider text-zinc-900">
                    {workOrder.vehicle.matricula}
                  </div>
                  <div className="text-sm text-zinc-700">
                    {workOrder.vehicle.marca} {workOrder.vehicle.modelo}
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5 flex flex-wrap gap-x-2">
                    {workOrder.vehicle.ano && <span>{workOrder.vehicle.ano}</span>}
                    {workOrder.vehicle.cor && <span>· {workOrder.vehicle.cor}</span>}
                    {workOrder.kmEntrada !== null && (
                      <span>· {workOrder.kmEntrada.toLocaleString('pt-PT')} km à entrada</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="card p-5">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
              Problema reportado
            </h2>
            <p className="text-sm text-zinc-800 whitespace-pre-wrap">{workOrder.problema}</p>
          </div>

          {workOrder.diagnostico && (
            <div className="card p-5">
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                Diagnóstico
              </h2>
              <p className="text-sm text-zinc-800 whitespace-pre-wrap">{workOrder.diagnostico}</p>
            </div>
          )}

          {workOrder.trabalho && (
            <div className="card p-5">
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                Trabalho efetuado
              </h2>
              <p className="text-sm text-zinc-800 whitespace-pre-wrap">{workOrder.trabalho}</p>
            </div>
          )}

          {workOrder.observacoes && (
            <div className="card p-5">
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                Observações
              </h2>
              <p className="text-sm text-zinc-800 whitespace-pre-wrap">{workOrder.observacoes}</p>
            </div>
          )}

          <CaucoesList
            caucoes={workOrder.caucoes}
            totalCaucoes={workOrder.totalCaucoes}
            totalFolha={workOrder.total}
            totalRestante={workOrder.totalRestante}
          />

          <MensagensSection
            customerId={workOrder.customer.id}
            workOrderId={workOrder.id}
            workOrderEstado={workOrder.estado}
            templates={templates}
            logs={automationLogs}
          />
        </div>

        {/* Coluna direita: items + totais */}
        <div className="lg:col-span-2 space-y-4">
          <ItemList
            title="Peças"
            icon={Package}
            iconBg="bg-violet-100 text-violet-700"
            items={pecas}
            onAdd={() => openNewItem('PECA')}
            onEdit={openEditItem}
            onDelete={handleDeleteItem}
            emptyText="Sem peças adicionadas."
          />
          <ItemList
            title="Mão de obra"
            icon={Wrench}
            iconBg="bg-orange-100 text-orange-700"
            items={maoObra}
            onAdd={() => openNewItem('MAO_OBRA')}
            onEdit={openEditItem}
            onDelete={handleDeleteItem}
            emptyText="Sem mão de obra adicionada."
          />

          {/* Totais */}
          <div className="card p-5">
            <h2 className="font-semibold text-zinc-900 mb-3">Totais</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Peças</span>
                <span className="font-semibold text-zinc-700">{formatEUR(workOrder.totalPecas)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Mão de obra</span>
                <span className="font-semibold text-zinc-700">{formatEUR(workOrder.totalMaoObra)}</span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
                <span className="text-zinc-900 font-bold">Total</span>
                <span className="text-xl font-bold text-zinc-900">{formatEUR(workOrder.total)}</span>
              </div>
            </div>
          </div>

          {/* Movimentos financeiros */}
          <div className="card overflow-hidden">
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-zinc-900">Movimentos</h3>
                <div className="text-xs text-zinc-500 mt-0.5">
                  {transactions.length} {transactions.length === 1 ? 'lançamento' : 'lançamentos'} associados
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setTxModalTipo('ENTRADA'); setEditingTx(null); setTxModalOpen(true) }}
                  className="btn-secondary text-emerald-600 hover:bg-emerald-50 text-sm"
                >
                  <TrendingUp className="w-4 h-4" /> Receita
                </button>
                <button
                  onClick={() => { setTxModalTipo('SAIDA'); setEditingTx(null); setTxModalOpen(true) }}
                  className="btn-primary text-sm"
                >
                  <TrendingDown className="w-4 h-4" /> Despesa
                </button>
              </div>
            </div>

            {transactions.length === 0 ? (
              <div className="p-10 text-center text-sm text-zinc-400">
                Sem movimentos financeiros associados a esta folha.
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className={cn(
                      'flex items-center gap-3 px-5 py-3 cursor-pointer',
                      tx.agendado ? 'bg-amber-50/60 hover:bg-amber-100/60' : 'hover:bg-zinc-50'
                    )}
                    onClick={() => { setEditingTx(tx); setTxModalTipo(tx.tipo); setTxModalOpen(true) }}
                  >
                    {tx.attachments.length > 0 ? (
                      <AttachmentThumb
                        attachment={tx.attachments[0]}
                        size="md"
                        onClick={() => {
                          setViewerTx(tx)
                          setViewerAttachmentId(tx.attachments[0].id)
                        }}
                      />
                    ) : (
                      <div className={cn(
                        'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                        colorIconBg[tx.category.cor] || colorIconBg.violet
                      )}>
                        <DynamicIcon name={tx.category.icone} className="w-4 h-4" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-zinc-900 flex items-center gap-1.5 flex-wrap">
                        {tx.descricao}
                        {tx.agendado && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                            AGENDADO
                          </span>
                        )}
                        {tx.attachments.length > 1 && (
                          <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[10px] bg-zinc-100 text-zinc-600">
                            <Paperclip className="w-2.5 h-2.5" /> {tx.attachments.length}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {tx.category.nome} · {tx.account.nome} ·{' '}
                        {tx.agendado && tx.dataAgendada
                          ? `prev. ${formatDateTime(tx.dataAgendada)}`
                          : formatDateTime(tx.data)}
                      </div>
                    </div>
                    <div className={cn(
                      'text-sm font-bold whitespace-nowrap',
                      tx.tipo === 'ENTRADA' ? 'text-emerald-600' : 'text-red-500'
                    )}>
                      {tx.tipo === 'ENTRADA' ? '+ ' : '- '}{formatEUR(tx.valor)}
                    </div>
                  </div>
                ))}
                {/* Resumo */}
                {transactions.length > 0 && (() => {
                  const entradas = transactions.filter(t => t.tipo === 'ENTRADA').reduce((s, t) => s + t.valor, 0)
                  const saidas = transactions.filter(t => t.tipo === 'SAIDA').reduce((s, t) => s + t.valor, 0)
                  return (
                    <div className="px-5 py-3 bg-zinc-50 flex items-center justify-end gap-6 text-sm">
                      <span className="text-zinc-500">Entradas: <strong className="text-emerald-600">+{formatEUR(entradas)}</strong></span>
                      <span className="text-zinc-500">Saídas: <strong className="text-red-500">-{formatEUR(saidas)}</strong></span>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

      <WorkOrderModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        workOrder={woForModal}
        customers={[workOrder.customer]}
      />
      <ItemModal
        open={itemModalOpen}
        onClose={() => {
          setItemModalOpen(false)
          setEditingItem(null)
        }}
        workOrderId={workOrder.id}
        item={editingItem}
        defaultTipo={itemTipoPadrao}
      />
      <TransactionModal
        open={txModalOpen}
        onClose={() => { setTxModalOpen(false); setEditingTx(null) }}
        tipo={txModalTipo}
        transaction={editingTx}
        accounts={accounts}
        categories={categories}
        workOrderOptions={workOrderOption}
        defaultWorkOrderId={workOrder.id}
      />

      {autoSend && (
        <AutoSendModal
          templates={autoSend.templates}
          novoEstado={autoSend.estado}
          customerId={workOrder.customer.id}
          workOrderId={workOrder.id}
          onClose={() => setAutoSend(null)}
        />
      )}

      <AttachmentViewer
        open={!!viewerTx}
        onClose={() => {
          setViewerTx(null)
          setViewerAttachmentId(undefined)
        }}
        initialAttachmentId={viewerAttachmentId}
        transaction={
          viewerTx
            ? ({
                id: viewerTx.id,
                tipo: viewerTx.tipo,
                valor: viewerTx.valor,
                descricao: viewerTx.descricao,
                data: viewerTx.data,
                observacao: viewerTx.observacao,
                agendado: viewerTx.agendado,
                dataAgendada: viewerTx.dataAgendada,
                account: { nome: viewerTx.account.nome },
                category: viewerTx.category,
                workOrder: { id: workOrder.id, numero: workOrder.numero, customer: { nome: workOrder.customer.nome } },
                attachments: viewerTx.attachments,
              } satisfies ViewerTransaction)
            : null
        }
        onEdit={(_tx) => {
          if (!viewerTx) return
          setViewerTx(null)
          setEditingTx(viewerTx)
          setTxModalTipo(viewerTx.tipo)
          setTxModalOpen(true)
        }}
      />
    </>
  )
}

function ItemList({
  title,
  icon: Icon,
  iconBg,
  items,
  onAdd,
  onEdit,
  onDelete,
  emptyText,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  iconBg: string
  items: WorkOrderItemRow[]
  onAdd: () => void
  onEdit: (it: WorkOrderItemRow) => void
  onDelete: (it: WorkOrderItemRow) => void
  emptyText: string
}) {
  const subtotal = items.reduce((s, i) => s + i.total, 0)
  return (
    <div className="card overflow-hidden">
      <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', iconBg)}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-zinc-900">{title}</h3>
            <div className="text-xs text-zinc-500">
              {items.length} {items.length === 1 ? 'item' : 'items'} · {formatEUR(subtotal)}
            </div>
          </div>
        </div>
        <button onClick={onAdd} className="btn-primary">
          <Plus className="w-4 h-4" /> Adicionar
        </button>
      </div>

      {items.length === 0 ? (
        <div className="p-8 text-center text-sm text-zinc-400">{emptyText}</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-100">
            <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-2 font-semibold">Descrição</th>
              <th className="px-4 py-2 font-semibold text-right w-16">Qtd</th>
              <th className="px-4 py-2 font-semibold text-right w-24">Preço</th>
              <th className="px-4 py-2 font-semibold text-right w-20">Margem</th>
              <th className="px-4 py-2 font-semibold text-right w-20">IVA</th>
              <th className="px-4 py-2 font-semibold text-right w-24">Total</th>
              <th className="px-4 py-2 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {items.map((it) => (
              <tr key={it.id} className="group hover:bg-zinc-50">
                <td className="px-4 py-1 text-zinc-800">
                  <EditableCell
                    value={it.descricao}
                    kind="text"
                    onSave={(v) => updateWorkOrderItemField(it.id, { descricao: String(v) })}
                  />
                  <EditableCell
                    value={it.referencia ?? ''}
                    kind="text"
                    placeholder="Ref."
                    displayClass="text-xs text-zinc-400 font-mono"
                    inputClass="text-xs font-mono"
                    formatDisplay={(v) => (v ? `Ref: ${v}` : '')}
                    onSave={(v) => updateWorkOrderItemField(it.id, { referencia: v ? String(v) : null })}
                  />
                </td>
                <td className="px-1 py-1 text-right text-zinc-600">
                  <EditableCell
                    value={it.quantidade}
                    kind="decimal"
                    align="right"
                    onSave={(v) => updateWorkOrderItemField(it.id, { quantidade: Number(v) })}
                  />
                </td>
                <td className="px-1 py-1 text-right text-zinc-600">
                  <EditableCell
                    value={it.precoUnit}
                    kind="decimal"
                    align="right"
                    formatDisplay={(v) => formatEUR(Number(v))}
                    onSave={(v) => updateWorkOrderItemField(it.id, { precoUnit: Number(v) })}
                  />
                </td>
                <td className="px-1 py-1 text-right text-zinc-600">
                  <EditableCell
                    value={it.margem ?? ''}
                    kind="decimal"
                    align="right"
                    placeholder="—"
                    formatDisplay={(v) => v === '' ? '—' : `${v}%`}
                    onSave={(v) => updateWorkOrderItemField(it.id, { margem: v === '' ? null : Number(v) })}
                  />
                </td>
                <td className="px-1 py-1 text-right text-zinc-600">
                  <IvaSelectCell
                    value={it.iva}
                    onSave={(v) => updateWorkOrderItemField(it.id, { iva: v })}
                  />
                </td>
                <td className="px-1 py-1 text-right font-semibold text-zinc-900">
                  <EditableCell
                    value={it.total}
                    kind="decimal"
                    align="right"
                    formatDisplay={(v) => formatEUR(Number(v))}
                    onSave={(v) => {
                      const newTotal = Number(v)
                      if (it.quantidade <= 0) {
                        return Promise.resolve({ ok: false, message: 'Quantidade tem de ser > 0' })
                      }
                      const m = it.margem ?? 0
                      const i = it.iva ?? 0
                      const factor = it.quantidade * (1 + m / 100) * (1 + i / 100)
                      if (factor <= 0) {
                        return Promise.resolve({ ok: false, message: 'Fatores inválidos' })
                      }
                      const newPreco = +(newTotal / factor).toFixed(4)
                      return updateWorkOrderItemField(it.id, { precoUnit: newPreco })
                    }}
                  />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => onEdit(it)}
                      className="w-7 h-7 rounded-lg hover:bg-white text-zinc-500"
                      aria-label="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5 mx-auto" />
                    </button>
                    <button
                      onClick={() => onDelete(it)}
                      className="w-7 h-7 rounded-lg hover:bg-white text-red-500"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5 mx-auto" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function parseDecPt(v: string): number {
  const cleaned = v.replace(/\s/g, '').replace(/[^\d,.-]/g, '')
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned
  const n = parseFloat(normalized)
  return isNaN(n) ? 0 : n
}

function EditableCell({
  value,
  kind,
  align = 'left',
  placeholder = '',
  displayClass = '',
  inputClass = '',
  formatDisplay,
  onSave,
}: {
  value: string | number
  kind: 'text' | 'decimal'
  align?: 'left' | 'right'
  placeholder?: string
  displayClass?: string
  inputClass?: string
  formatDisplay?: (v: string | number) => string
  onSave: (v: string | number) => Promise<{ ok: boolean; message?: string; errors?: Record<string, string> }>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const displayValue =
    formatDisplay
      ? formatDisplay(value)
      : kind === 'decimal' && typeof value === 'number'
      ? value.toLocaleString('pt-PT')
      : String(value)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  function startEdit() {
    if (pending) return
    const initial =
      kind === 'decimal' && value !== '' && value !== null
        ? String(value).replace('.', ',')
        : String(value)
    setDraft(initial)
    setError(null)
    setEditing(true)
  }

  function commit() {
    const parsed: string | number =
      kind === 'decimal'
        ? draft.trim() === ''
          ? ''
          : parseDecPt(draft)
        : draft

    const original =
      kind === 'decimal' && value !== ''
        ? Number(value)
        : value

    if (parsed === original || (parsed === '' && (value === '' || value === null))) {
      setEditing(false)
      return
    }

    startTransition(async () => {
      const res = await onSave(parsed)
      if (res.ok) {
        setEditing(false)
        router.refresh()
      } else {
        setError(res.message || Object.values(res.errors || {})[0] || 'Erro')
      }
    })
  }

  function cancel() {
    setEditing(false)
    setError(null)
  }

  const alignClass = align === 'right' ? 'text-right' : 'text-left'

  if (editing) {
    return (
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit() }
            else if (e.key === 'Escape') { e.preventDefault(); cancel() }
          }}
          inputMode={kind === 'decimal' ? 'decimal' : undefined}
          disabled={pending}
          className={cn(
            'w-full px-2 py-1 rounded border border-emerald-400 bg-white outline-none focus:ring-2 focus:ring-emerald-200',
            alignClass,
            inputClass
          )}
          placeholder={placeholder}
        />
        {error && (
          <div className="absolute z-10 top-full left-0 mt-0.5 text-xs text-red-600 bg-white border border-red-200 rounded px-1.5 py-0.5 shadow-sm whitespace-nowrap">
            {error}
          </div>
        )}
      </div>
    )
  }

  const isEmpty = displayValue === '' || displayValue === '—'

  return (
    <button
      type="button"
      onClick={startEdit}
      className={cn(
        'w-full px-2 py-1 rounded border border-transparent hover:border-zinc-200 hover:bg-white text-left cursor-text transition',
        alignClass,
        isEmpty && 'text-zinc-300',
        displayClass
      )}
    >
      {displayValue || placeholder || '—'}
    </button>
  )
}

function IvaSelectCell({
  value,
  onSave,
}: {
  value: number | null
  onSave: (v: number | null) => Promise<{ ok: boolean; message?: string }>
}) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const raw = e.target.value
    const next = raw === '' ? null : Number(raw)
    startTransition(async () => {
      const res = await onSave(next)
      if (res.ok) router.refresh()
    })
  }

  return (
    <select
      value={value ?? ''}
      onChange={handleChange}
      disabled={pending}
      className="w-full px-2 py-1 rounded border border-transparent hover:border-zinc-200 bg-transparent text-right text-sm focus:outline-none focus:border-emerald-400 focus:bg-white cursor-pointer disabled:opacity-50"
    >
      <option value="">—</option>
      <option value="6">6%</option>
      <option value="13">13%</option>
      <option value="23">23%</option>
    </select>
  )
}

