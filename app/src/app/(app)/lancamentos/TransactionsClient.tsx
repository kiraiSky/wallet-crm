'use client'

import { useState, useTransition, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, FileText, Pencil, Copy, Paperclip, Trash2,
  MoreVertical, CalendarClock, ArrowRightLeft,
} from 'lucide-react'
import { DynamicIcon } from '@/components/DynamicIcon'
import { colorIconBg } from '@/lib/colors'
import { formatEUR, formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { TransactionModal, type TransactionForModal } from './TransactionModal'
import { deleteTransaction, duplicateTransaction } from './actions'
import type { TransactionRow, WorkOrderOption } from './page'
import { dispatchNewTx } from '@/lib/newTxBus'
import { AttachmentViewer, AttachmentThumb, type ViewerTransaction } from '@/components/AttachmentViewer'

type AccountOption = { id: string; nome: string; cor: string; icone: string; tipo: string }
type CategoryOption = { id: string; nome: string; cor: string; icone: string; tipo: 'ENTRADA' | 'SAIDA' }

interface Props {
  transactions: TransactionRow[]
  accounts: AccountOption[]
  categories: CategoryOption[]
  workOrderOptions: WorkOrderOption[]
  filters: {
    tipo?: 'ENTRADA' | 'SAIDA'
    accountId?: string
    categoryId?: string
    search?: string
  }
  kpis: { totalEntradas: number; totalSaidas: number; count: number }
  openNew: 'ENTRADA' | 'SAIDA' | null
}

export function TransactionsClient({
  transactions,
  accounts,
  categories,
  workOrderOptions,
  filters,
  kpis,
  openNew,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTipo, setModalTipo] = useState<'ENTRADA' | 'SAIDA'>('SAIDA')
  const [editing, setEditing] = useState<TransactionRow | null>(null)
  const [menuOpen, setMenuOpen] = useState<{ id: string; x: number; y: number } | null>(null)
  const [viewerTx, setViewerTx] = useState<TransactionRow | null>(null)
  const [viewerAttachmentId, setViewerAttachmentId] = useState<string | undefined>()

  useEffect(() => {
    if (openNew !== null) {
      dispatchNewTx(openNew)
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        url.searchParams.delete('new')
        router.replace(url.pathname + (url.search || ''), { scroll: false })
      }
    }
  }, [openNew, router])

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
  }

  function toggleMenu(id: string, e: React.MouseEvent<HTMLButtonElement>) {
    if (menuOpen?.id === id) {
      setMenuOpen(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    setMenuOpen({ id, x: rect.right, y: rect.bottom + 4 })
  }

  function setQuery(key: string, value: string | null) {
    const url = new URL(window.location.href)
    if (value === null || value === '') url.searchParams.delete(key)
    else url.searchParams.set(key, value)
    router.push(url.pathname + url.search)
  }

  function openNewTx(tipo: 'ENTRADA' | 'SAIDA') {
    dispatchNewTx(tipo)
  }

  function openEdit(tx: TransactionRow) {
    if (tx.tipo === 'TRANSFERENCIA') return
    setEditing(tx)
    setModalTipo(tx.tipo)
    setModalOpen(true)
    setMenuOpen(null)
  }

  const editingForModal: TransactionForModal | null =
    editing && editing.tipo !== 'TRANSFERENCIA'
      ? {
          id: editing.id,
          tipo: editing.tipo,
          valor: editing.valor,
          descricao: editing.descricao,
          data: editing.data,
          observacao: editing.observacao,
          accountId: editing.accountId,
          categoryId: editing.categoryId!,
          workOrderId: editing.workOrderId,
          agendado: editing.agendado,
          dataAgendada: editing.dataAgendada,
      }
      : null

  const viewerForAttachment: ViewerTransaction | null =
    viewerTx && viewerTx.tipo !== 'TRANSFERENCIA'
      ? {
          id: viewerTx.id,
          tipo: viewerTx.tipo,
          valor: viewerTx.valor,
          descricao: viewerTx.descricao,
          data: viewerTx.data,
          observacao: viewerTx.observacao,
          agendado: viewerTx.agendado,
          dataAgendada: viewerTx.dataAgendada,
          account: { nome: viewerTx.account.nome },
          category: viewerTx.category!,
          workOrder: viewerTx.workOrder
            ? { numero: viewerTx.workOrder.numero, customer: viewerTx.workOrder.customer }
            : null,
          attachments: viewerTx.attachments,
        }
      : null

  function handleDelete(tx: TransactionRow) {
    if (!confirm(`Eliminar "${tx.descricao}"?`)) return
    startTransition(async () => {
      await deleteTransaction(tx.id)
      setMenuOpen(null)
      router.refresh()
    })
  }

  function handleDuplicate(tx: TransactionRow) {
    startTransition(async () => {
      await duplicateTransaction(tx.id)
      setMenuOpen(null)
      router.refresh()
    })
  }

  const resultado = kpis.totalEntradas - kpis.totalSaidas

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Movimentos</h1>
          <p className="text-zinc-500 text-sm">Todas as entradas e saídas das tuas contas.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => openNewTx('SAIDA')} className="btn-primary">
            <Plus className="w-4 h-4" /> Nova despesa
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KPI title="Entradas (filtradas)" value={kpis.totalEntradas} color="emerald" prefix="+ " />
        <KPI title="Saídas (filtradas)" value={kpis.totalSaidas} color="red" prefix="- " />
        <KPI title="Resultado" value={resultado} color="zinc" />
        <div className="card p-4">
          <div className="text-xs text-zinc-500 mb-1">Nº movimentos</div>
          <div className="text-lg font-bold text-zinc-900">{kpis.count}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="card p-3 mb-4 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            defaultValue={filters.search ?? ''}
            placeholder="Pesquisar por descrição ou observação..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') setQuery('q', (e.target as HTMLInputElement).value)
            }}
            className="input-base pl-10"
          />
        </div>
        <select
          value={filters.tipo ?? ''}
          onChange={(e) => setQuery('tipo', e.target.value || null)}
          className="input-base !w-auto"
        >
          <option value="">Todos os tipos</option>
          <option value="ENTRADA">Apenas entradas</option>
          <option value="SAIDA">Apenas saídas</option>
        </select>
        <select
          value={filters.categoryId ?? ''}
          onChange={(e) => setQuery('category', e.target.value || null)}
          className="input-base !w-auto"
        >
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome} ({c.tipo === 'ENTRADA' ? 'R' : 'D'})
            </option>
          ))}
        </select>
        <select
          value={filters.accountId ?? ''}
          onChange={(e) => setQuery('account', e.target.value || null)}
          className="input-base !w-auto"
        >
          <option value="">Todas as contas</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.nome}</option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden">
        {transactions.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-zinc-300 mb-3" />
            <p className="text-sm text-zinc-500">Sem movimentos ainda.</p>
            <button onClick={() => openNewTx('SAIDA')} className="btn-primary mt-4">
              <Plus className="w-4 h-4" /> Registar primeira despesa
            </button>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden md:table w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-3 font-semibold">Data</th>
                  <th className="px-4 py-3 font-semibold">Descrição</th>
                  <th className="px-4 py-3 font-semibold">Categoria</th>
                  <th className="px-4 py-3 font-semibold">Conta</th>
                  <th className="px-4 py-3 font-semibold text-right">Valor</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className={cn(
                      'group',
                      tx.agendado
                        ? 'bg-amber-50/60 hover:bg-amber-100/60'
                        : 'hover:bg-zinc-50'
                    )}
                  >
                    <td className="px-4 py-3 text-zinc-600 whitespace-nowrap text-xs">
                      {tx.agendado && tx.dataAgendada ? (
                        <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                          <CalendarClock className="w-3 h-3" />
                          {formatDateTime(tx.dataAgendada)}
                        </span>
                      ) : (
                        formatDateTime(tx.data)
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900 flex items-center gap-2">
                        {tx.attachments.length > 0 && (
                          <AttachmentThumb
                            attachment={tx.attachments[0]}
                            onClick={() => {
                              setViewerTx(tx)
                              setViewerAttachmentId(tx.attachments[0].id)
                            }}
                          />
                        )}
                        <span>{tx.descricao}</span>
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
                      {tx.observacao && (
                        <div className="text-xs text-zinc-500 mt-0.5">{tx.observacao}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {tx.tipo === 'TRANSFERENCIA' ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-500">
                          <ArrowRightLeft className="w-3 h-3" />
                          Transferência
                        </span>
                      ) : tx.category ? (
                        <span className={cn(
                          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
                          colorIconBg[tx.category.cor] || colorIconBg.violet
                        )}>
                          <DynamicIcon name={tx.category.icone} className="w-3 h-3" />
                          {tx.category.nome}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {tx.tipo === 'TRANSFERENCIA'
                        ? `${tx.account.nome} → ${tx.toAccount?.nome ?? '?'}`
                        : tx.account.nome}
                    </td>
                    <td className="px-4 py-3 text-right font-bold whitespace-nowrap">
                      {tx.tipo === 'TRANSFERENCIA' ? (
                        <span className="inline-flex items-center gap-1 text-zinc-400">
                          <ArrowRightLeft className="w-3 h-3" />
                          {formatEUR(tx.valor)}
                        </span>
                      ) : tx.tipo === 'ENTRADA' ? (
                        <span className="text-emerald-600">+ {formatEUR(tx.valor)}</span>
                      ) : (
                        <span className="text-red-500">- {formatEUR(tx.valor)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => toggleMenu(tx.id, e)}
                        className="text-zinc-400 hover:text-zinc-700"
                        aria-label="Ações"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {menuOpen?.id === tx.id && (
                        <RowMenu
                          x={menuOpen.x}
                          y={menuOpen.y}
                          onEdit={() => openEdit(tx)}
                          onDuplicate={() => handleDuplicate(tx)}
                          onDelete={() => handleDelete(tx)}
                          onClose={() => setMenuOpen(null)}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile list */}
            <div className="md:hidden divide-y divide-zinc-100">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className={cn(
                    'flex items-center gap-3 p-4 relative',
                    tx.agendado && 'bg-amber-50/60'
                  )}
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
                  ) : tx.tipo === 'TRANSFERENCIA' ? (
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-zinc-100">
                      <ArrowRightLeft className="w-5 h-5 text-zinc-400" />
                    </div>
                  ) : (
                    <div className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      colorIconBg[tx.category?.cor ?? 'violet'] || colorIconBg.violet
                    )}>
                      <DynamicIcon name={tx.category?.icone ?? 'circle'} className="w-5 h-5" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-zinc-900 truncate flex items-center gap-1">
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
                      {tx.tipo === 'TRANSFERENCIA'
                        ? `${tx.account.nome} → ${tx.toAccount?.nome ?? '?'}`
                        : `${tx.category?.nome ?? ''} · ${tx.account.nome}`} · {tx.agendado && tx.dataAgendada ? formatDateTime(tx.dataAgendada) : formatDateTime(tx.data)}
                    </div>
                  </div>
                  <div className="text-sm font-bold whitespace-nowrap">
                    {tx.tipo === 'TRANSFERENCIA' ? (
                      <span className="inline-flex items-center gap-1 text-zinc-400">
                        <ArrowRightLeft className="w-3 h-3" />
                        {formatEUR(tx.valor)}
                      </span>
                    ) : tx.tipo === 'ENTRADA' ? (
                      <span className="text-emerald-600">+ {formatEUR(tx.valor)}</span>
                    ) : (
                      <span className="text-red-500">- {formatEUR(tx.valor)}</span>
                    )}
                  </div>
                  <button
                    onClick={(e) => toggleMenu(tx.id, e)}
                    className="text-zinc-400"
                    aria-label="Ações"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {menuOpen?.id === tx.id && (
                    <RowMenu
                      x={menuOpen.x}
                      y={menuOpen.y}
                      onEdit={() => openEdit(tx)}
                      onDuplicate={() => handleDuplicate(tx)}
                      onDelete={() => handleDelete(tx)}
                      onClose={() => setMenuOpen(null)}
                    />
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <TransactionModal
        open={modalOpen}
        onClose={closeModal}
        tipo={modalTipo}
        transaction={editingForModal}
        accounts={accounts}
        categories={categories}
        workOrderOptions={workOrderOptions}
      />

      <AttachmentViewer
        open={!!viewerTx}
        onClose={() => {
          setViewerTx(null)
          setViewerAttachmentId(undefined)
        }}
        initialAttachmentId={viewerAttachmentId}
        transaction={viewerForAttachment}
        onEdit={(tx) => {
          const original = transactions.find((t) => t.id === tx.id)
          if (original) {
            setViewerTx(null)
            openEdit(original)
          }
        }}
      />
    </>
  )
}

function KPI({
  title,
  value,
  color,
  prefix = '',
}: {
  title: string
  value: number
  color: 'emerald' | 'red' | 'zinc'
  prefix?: string
}) {
  const colorClass = color === 'emerald' ? 'text-emerald-600' : color === 'red' ? 'text-red-500' : 'text-zinc-900'
  return (
    <div className="card p-4">
      <div className="text-xs text-zinc-500 mb-1">{title}</div>
      <div className={cn('text-lg font-bold', colorClass)}>
        {prefix}{formatEUR(value)}
      </div>
    </div>
  )
}

function RowMenu({
  x,
  y,
  onEdit,
  onDuplicate,
  onDelete,
  onClose,
}: {
  x: number
  y: number
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  const MENU_WIDTH = 176
  const left = Math.max(8, Math.min(x - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8))
  const top = Math.min(y, window.innerHeight - 140)

  return createPortal(
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed bg-white border border-zinc-200 rounded-xl shadow-lg w-44 py-1 z-50"
        style={{ left, top }}
      >
        <button
          onClick={onEdit}
          className="w-full text-left px-3 py-2 hover:bg-zinc-50 flex items-center gap-2 text-sm text-zinc-700"
        >
          <Pencil className="w-4 h-4" /> Editar
        </button>
        <button
          onClick={onDuplicate}
          className="w-full text-left px-3 py-2 hover:bg-zinc-50 flex items-center gap-2 text-sm text-zinc-700"
        >
          <Copy className="w-4 h-4" /> Duplicar
        </button>
        <div className="border-t border-zinc-100 my-1" />
        <button
          onClick={onDelete}
          className="w-full text-left px-3 py-2 hover:bg-red-50 flex items-center gap-2 text-sm text-red-600"
        >
          <Trash2 className="w-4 h-4" /> Eliminar
        </button>
      </div>
    </>,
    document.body
  )
}
