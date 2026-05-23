'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, ArrowRightLeft, Paperclip, Plus, Trash2, X } from 'lucide-react'
import { DynamicIcon } from '@/components/DynamicIcon'
import { colorIconBg } from '@/lib/colors'
import { formatEUR, formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { deleteTransaction, deleteTransactions } from '../lancamentos/actions'

export type RecentTransactionItem = {
  id: string
  tipo: 'ENTRADA' | 'SAIDA' | 'TRANSFERENCIA'
  valor: number
  descricao: string
  data: string
  account: { nome: string }
  category: { nome: string; cor: string; icone: string } | null
  toAccount: { nome: string } | null
  attachmentsCount: number
}

interface Props {
  transactions: RecentTransactionItem[]
}

export function RecentTransactionsBlock({ transactions }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const selectedCount = selectedIds.size
  const allSelected = transactions.length > 0 && selectedCount === transactions.length

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function setAllSelected(checked: boolean) {
    setSelectedIds(checked ? new Set(transactions.map((tx) => tx.id)) : new Set())
  }

  function handleDelete(tx: RecentTransactionItem) {
    if (!window.confirm(`Eliminar "${tx.descricao}"?`)) return
    startTransition(async () => {
      await deleteTransaction(tx.id)
      setSelectedIds((current) => {
        const next = new Set(current)
        next.delete(tx.id)
        return next
      })
      router.refresh()
    })
  }

  function handleBulkDelete() {
    if (selectedCount === 0) return
    if (!window.confirm(`Eliminar ${selectedCount} movimento${selectedCount === 1 ? '' : 's'} selecionado${selectedCount === 1 ? '' : 's'}?`)) return
    startTransition(async () => {
      await deleteTransactions(Array.from(selectedIds))
      setSelectedIds(new Set())
      router.refresh()
    })
  }

  return (
    <div className="card p-5 lg:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {transactions.length > 0 && (
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) => setAllSelected(e.target.checked)}
              aria-label="Selecionar todos os movimentos visíveis"
              className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
            />
          )}
          <h3 className="font-semibold text-zinc-900">Últimos movimentos</h3>
        </div>
        <Link
          href="/lancamentos"
          className="text-xs text-emerald-600 hover:text-emerald-700 font-medium inline-flex items-center gap-1"
        >
          Ver todos <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {selectedCount > 0 && (
        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50/70 p-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="inline-flex items-center gap-2 text-xs font-medium text-emerald-900"
          >
            <X className="w-4 h-4" />
            {selectedCount} selecionado{selectedCount === 1 ? '' : 's'}
          </button>
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {pending ? 'A eliminar...' : 'Eliminar'}
          </button>
        </div>
      )}

      {transactions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-zinc-500 mb-3">Sem movimentos ainda.</p>
          <Link href="/lancamentos?new=despesa" className="btn-primary inline-flex">
            <Plus className="w-4 h-4" /> Primeira despesa
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-zinc-100">
          {transactions.map((tx) => (
            <div key={tx.id} className="flex items-center gap-3 py-2.5">
              <input
                type="checkbox"
                checked={selectedIds.has(tx.id)}
                onChange={() => toggleSelected(tx.id)}
                aria-label={`Selecionar ${tx.descricao}`}
                className="h-4 w-4 shrink-0 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
              />
              {tx.tipo === 'TRANSFERENCIA' ? (
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-zinc-100">
                  <ArrowRightLeft className="w-4 h-4 text-zinc-500" />
                </div>
              ) : (
                <div
                  className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center',
                    colorIconBg[tx.category?.cor ?? 'zinc'] || colorIconBg.zinc
                  )}
                >
                  <DynamicIcon name={tx.category?.icone ?? 'circle'} className="w-4 h-4" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-zinc-900 truncate flex items-center gap-1">
                  {tx.descricao}
                  {tx.attachmentsCount > 0 && <Paperclip className="w-3 h-3 text-zinc-400" />}
                </div>
                <div className="text-xs text-zinc-500 truncate">
                  {tx.tipo === 'TRANSFERENCIA'
                    ? `${tx.account.nome} -> ${tx.toAccount?.nome ?? '?'}`
                    : `${tx.category?.nome ?? 'Sem categoria'} · ${tx.account.nome}`} · {formatDateTime(tx.data)}
                </div>
              </div>
              <div className="text-sm font-bold whitespace-nowrap">
                {tx.tipo === 'TRANSFERENCIA' ? (
                  <span className="text-zinc-400">{formatEUR(tx.valor)}</span>
                ) : tx.tipo === 'ENTRADA' ? (
                  <span className="text-emerald-600">+ {formatEUR(tx.valor)}</span>
                ) : (
                  <span className="text-red-500">- {formatEUR(tx.valor)}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleDelete(tx)}
                disabled={pending}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                aria-label={`Eliminar ${tx.descricao}`}
                title="Eliminar movimento"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
