'use client'

import { useState, useTransition, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, FileText, Pencil, Copy, Paperclip, Trash2,
  MoreVertical,
} from 'lucide-react'
import { DynamicIcon } from '@/components/DynamicIcon'
import { colorIconBg } from '@/lib/colors'
import { formatEUR, formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { TransactionModal } from './TransactionModal'
import { deleteTransaction, duplicateTransaction } from './actions'
import type { TransactionRow, WorkOrderOption } from './page'

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
  const [modalOpen, setModalOpen] = useState(openNew !== null)
  const [modalTipo, setModalTipo] = useState<'ENTRADA' | 'SAIDA'>(openNew ?? 'SAIDA')
  const [editing, setEditing] = useState<TransactionRow | null>(null)
  const [menuOpen, setMenuOpen] = useState<{ id: string; x: number; y: number } | null>(null)

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
    setEditing(null)
    setModalTipo(tipo)
    setModalOpen(true)
  }

  function openEdit(tx: TransactionRow) {
    setEditing(tx)
    setModalTipo(tx.tipo)
    setModalOpen(true)
    setMenuOpen(null)
  }

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
                  <tr key={tx.id} className="hover:bg-zinc-50 group">
                    <td className="px-4 py-3 text-zinc-600 whitespace-nowrap text-xs">
                      {formatDateTime(tx.data)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900 flex items-center gap-2">
                        {tx.descricao}
                        {tx.hasAttachment && (
                          <Paperclip className="w-3 h-3 text-zinc-400" />
                        )}
                      </div>
                      {tx.observacao && (
                        <div className="text-xs text-zinc-500 mt-0.5">{tx.observacao}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
                        colorIconBg[tx.category.cor] || colorIconBg.violet
                      )}>
                        <DynamicIcon name={tx.category.icone} className="w-3 h-3" />
                        {tx.category.nome}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{tx.account.nome}</td>
                    <td className={cn(
                      'px-4 py-3 text-right font-bold whitespace-nowrap',
                      tx.tipo === 'ENTRADA' ? 'text-emerald-600' : 'text-red-500'
                    )}>
                      {tx.tipo === 'ENTRADA' ? '+ ' : '- '}{formatEUR(tx.valor)}
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
                <div key={tx.id} className="flex items-center gap-3 p-4 relative">
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    colorIconBg[tx.category.cor] || colorIconBg.violet
                  )}>
                    <DynamicIcon name={tx.category.icone} className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-zinc-900 truncate flex items-center gap-1">
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
        onClose={() => {
          setModalOpen(false)
          setEditing(null)
        }}
        tipo={modalTipo}
        transaction={editing}
        accounts={accounts}
        categories={categories}
        workOrderOptions={workOrderOptions}
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
