'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, TrendingUp, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { DynamicIcon } from '@/components/DynamicIcon'
import { colorGradient } from '@/lib/colors'
import { formatBRL } from '@/lib/format'
import { AccountModal } from './AccountModal'
import { deleteAccount } from './actions'
import type { AccountWithBalance } from './page'

interface Props {
  accounts: AccountWithBalance[]
  totalConsolidado: number
}

export function AccountsClient({ accounts, totalConsolidado }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [editing, setEditing] = useState<AccountWithBalance | null>(null)
  const [modalOpen, setModalOpen] = useState(searchParams.get('new') === '1')
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function openNew() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(acc: AccountWithBalance) {
    setEditing(acc)
    setModalOpen(true)
    setMenuOpen(null)
  }

  function handleDelete(acc: AccountWithBalance) {
    if (!confirm(`Excluir o caixa "${acc.nome}"?\n${acc.totalTransacoes > 0 ? `Há ${acc.totalTransacoes} lançamentos vinculados. O caixa será arquivado.` : ''}`)) return
    startTransition(async () => {
      await deleteAccount(acc.id)
      setMenuOpen(null)
      router.refresh()
    })
  }

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Caixas e contas</h1>
          <p className="text-zinc-500 text-sm">Gerencie onde o dinheiro entra e sai.</p>
        </div>
        <button onClick={openNew} className="btn-primary">
          <Plus className="w-4 h-4" />
          <span>Novo caixa</span>
        </button>
      </div>

      <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 text-white rounded-2xl p-6 mb-5 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-zinc-400 mb-1">Saldo total consolidado</div>
          <div className="text-3xl font-bold">{formatBRL(totalConsolidado)}</div>
          <div className="text-xs text-zinc-400 mt-1">{accounts.length} {accounts.length === 1 ? 'caixa ativo' : 'caixas ativos'}</div>
        </div>
        <TrendingUp className="hidden sm:block w-12 h-12 text-emerald-400" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((acc) => (
          <div key={acc.id} className="bg-white border border-zinc-200 rounded-2xl overflow-hidden hover:shadow-md transition relative">
            <div className={`bg-gradient-to-br ${colorGradient[acc.cor] || colorGradient.emerald} p-4 text-white`}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <DynamicIcon name={acc.icone} className="w-5 h-5" />
                </div>
                <button
                  onClick={() => setMenuOpen(menuOpen === acc.id ? null : acc.id)}
                  className="text-white/80 hover:text-white"
                  aria-label="Ações"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
              <div className="text-xs text-white/80 mb-0.5">{acc.tipo.charAt(0) + acc.tipo.slice(1).toLowerCase()} · {acc.nome}</div>
              <div className="text-2xl font-bold">{formatBRL(acc.saldoAtual)}</div>
            </div>
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Entradas (mês)</span>
                <span className="font-semibold text-emerald-600">{acc.entradasMes > 0 ? '+ ' : ''}{formatBRL(acc.entradasMes)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Saídas (mês)</span>
                <span className="font-semibold text-red-500">{acc.saidasMes > 0 ? '- ' : ''}{formatBRL(acc.saidasMes)}</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-2 border-t border-zinc-100">
                <span className="text-zinc-500">Lançamentos</span>
                <span className="font-semibold text-zinc-900">{acc.totalTransacoes}</span>
              </div>
            </div>

            {menuOpen === acc.id && (
              <div
                className="absolute right-3 top-12 bg-white border border-zinc-200 rounded-xl shadow-lg w-44 py-1 z-10"
                onMouseLeave={() => setMenuOpen(null)}
              >
                <button
                  onClick={() => openEdit(acc)}
                  className="w-full text-left px-3 py-2 hover:bg-zinc-50 flex items-center gap-2 text-sm text-zinc-700"
                >
                  <Pencil className="w-4 h-4" /> Editar
                </button>
                <button
                  onClick={() => handleDelete(acc)}
                  className="w-full text-left px-3 py-2 hover:bg-red-50 flex items-center gap-2 text-sm text-red-600"
                >
                  <Trash2 className="w-4 h-4" /> Excluir
                </button>
              </div>
            )}
          </div>
        ))}

        <button
          onClick={openNew}
          className="border-2 border-dashed border-zinc-300 rounded-2xl p-8 text-zinc-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/50 transition flex flex-col items-center justify-center gap-2 min-h-[200px]"
        >
          <Plus className="w-8 h-8" />
          <span className="font-semibold">Adicionar novo caixa</span>
          <span className="text-xs">Dinheiro · Banco · Pix · Cartão</span>
        </button>
      </div>

      <AccountModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditing(null)
        }}
        account={editing}
      />
    </>
  )
}
