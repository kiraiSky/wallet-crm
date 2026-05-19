'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Pencil, Trash2, Plus, Package, Wrench, Car,
  ChevronRight, CheckCircle2, TrendingUp, TrendingDown, Paperclip,
  MessageCircle, Phone,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatEUR, formatDate, formatDateTime, whatsappUrl } from '@/lib/format'
import { colorIconBg } from '@/lib/colors'
import { DynamicIcon } from '@/components/DynamicIcon'
import { STATUS_LIST, STATUS_META, nextStatus, type WorkOrderStatus } from '../status'
import { WorkOrderModal, type WorkOrderForModal } from '../WorkOrderModal'
import { ItemModal } from './ItemModal'
import { TransactionModal } from '../../lancamentos/TransactionModal'
import {
  deleteWorkOrder,
  changeStatus,
  deleteWorkOrderItem,
} from '../actions'
import type { WorkOrderDetail, WorkOrderItemRow, WorkOrderTransactionRow } from './page'
import { openCustomerQuickView } from '@/lib/customerBus'

type AccountOption = { id: string; nome: string; cor: string; icone: string }
type CategoryOption = { id: string; nome: string; tipo: 'ENTRADA' | 'SAIDA'; cor: string; icone: string }

interface Props {
  workOrder: WorkOrderDetail
  transactions: WorkOrderTransactionRow[]
  accounts: AccountOption[]
  categories: CategoryOption[]
}

export function WorkOrderDetailClient({ workOrder, transactions, accounts, categories }: Props) {
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
                    className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50 cursor-pointer"
                    onClick={() => { setEditingTx(tx); setTxModalTipo(tx.tipo); setTxModalOpen(true) }}
                  >
                    <div className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                      colorIconBg[tx.category.cor] || colorIconBg.violet
                    )}>
                      <DynamicIcon name={tx.category.icone} className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-zinc-900 flex items-center gap-1.5">
                        {tx.descricao}
                        {tx.hasAttachment && <Paperclip className="w-3 h-3 text-zinc-400" />}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {tx.category.nome} · {tx.account.nome} · {formatDateTime(tx.data)}
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
        customers={[{ id: workOrder.customer.id, nome: workOrder.customer.nome }]}
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
              <th className="px-4 py-2 font-semibold text-right">Qtd</th>
              <th className="px-4 py-2 font-semibold text-right">Preço</th>
              <th className="px-4 py-2 font-semibold text-right">Total</th>
              <th className="px-4 py-2 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {items.map((it) => (
              <tr key={it.id} className="group hover:bg-zinc-50">
                <td className="px-4 py-2.5 text-zinc-800">{it.descricao}</td>
                <td className="px-4 py-2.5 text-right text-zinc-600">
                  {it.quantidade.toLocaleString('pt-PT')}
                </td>
                <td className="px-4 py-2.5 text-right text-zinc-600">
                  {formatEUR(it.precoUnit)}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold text-zinc-900">
                  {formatEUR(it.total)}
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

