'use client'

import { useState, useTransition, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, TrendingUp, MoreVertical, Pencil, Trash2, ArrowRightLeft } from 'lucide-react'
import { DynamicIcon } from '@/components/DynamicIcon'
import { colorGradient } from '@/lib/colors'
import { formatEUR } from '@/lib/format'
import { AccountModal } from './AccountModal'
import { TransferModal } from './TransferModal'
import { AjusteSaldoModal } from './AjusteSaldoModal'
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
  const [menuOpen, setMenuOpen] = useState<{ id: string; x: number; y: number } | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [ajusteAccount, setAjusteAccount] = useState<AccountWithBalance | null>(null)
  const [, startTransition] = useTransition()

  function toggleMenu(id: string, e: React.MouseEvent<HTMLButtonElement>) {
    if (menuOpen?.id === id) {
      setMenuOpen(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    setMenuOpen({ id, x: rect.right, y: rect.bottom + 4 })
  }

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
    if (!confirm(`Eliminar a conta "${acc.nome}"?\n${acc.totalTransacoes > 0 ? `Há ${acc.totalTransacoes} movimentos associados. A conta será arquivada.` : ''}`)) return
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
          <h1 className="text-2xl font-bold text-zinc-900">Contas</h1>
          <p className="text-zinc-500 text-sm">Gere onde o dinheiro entra e sai.</p>
        </div>
        <div className="flex gap-2">
          {accounts.length >= 2 && (
            <button
              onClick={() => setTransferOpen(true)}
              className="btn-secondary"
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Transferência</span>
            </button>
          )}
          <button onClick={openNew} className="btn-primary">
            <Plus className="w-4 h-4" />
            <span>Nova conta</span>
          </button>
        </div>
      </div>

      <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 text-white rounded-2xl p-6 mb-5 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-zinc-400 mb-1">Saldo total consolidado</div>
          <div className="text-3xl font-bold">{formatEUR(totalConsolidado)}</div>
          <div className="text-xs text-zinc-400 mt-1">{accounts.length} {accounts.length === 1 ? 'conta ativa' : 'contas ativas'}</div>
        </div>
        <TrendingUp className="hidden sm:block w-12 h-12 text-indigo-400" />
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
                  onClick={(e) => toggleMenu(acc.id, e)}
                  className="text-white/80 hover:text-white"
                  aria-label="Ações"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
              <div className="text-xs text-white/80 mb-0.5">{acc.tipo.charAt(0) + acc.tipo.slice(1).toLowerCase()} · {acc.nome}</div>
              <div className="text-2xl font-bold">{formatEUR(acc.saldoAtual)}</div>
            </div>
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Entradas (mês)</span>
                <span className="font-semibold text-emerald-600">{acc.entradasMes > 0 ? '+ ' : ''}{formatEUR(acc.entradasMes)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Saídas (mês)</span>
                <span className="font-semibold text-rose-600">{acc.saidasMes > 0 ? '- ' : ''}{formatEUR(acc.saidasMes)}</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-2 border-t border-zinc-100">
                <span className="text-zinc-500">Movimentos</span>
                <span className="font-semibold text-zinc-900">{acc.totalTransacoes}</span>
              </div>
            </div>

          </div>
        ))}

        {menuOpen && (
          <CardMenu
            x={menuOpen.x}
            y={menuOpen.y}
            onEdit={() => {
              const acc = accounts.find((a) => a.id === menuOpen.id)
              if (acc) openEdit(acc)
            }}
            onDelete={() => {
              const acc = accounts.find((a) => a.id === menuOpen.id)
              if (acc) handleDelete(acc)
            }}
            onClose={() => setMenuOpen(null)}
          />
        )}

        <button
          onClick={openNew}
          className="border-2 border-dashed border-zinc-300 rounded-2xl p-8 text-zinc-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition flex flex-col items-center justify-center gap-2 min-h-[200px]"
        >
          <Plus className="w-8 h-8" />
          <span className="font-semibold">Adicionar nova conta</span>
          <span className="text-xs">Dinheiro · Banco · Cartão</span>
        </button>
      </div>

      <AccountModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditing(null)
        }}
        account={editing}
        onAjusteSaldo={editing ? () => setAjusteAccount(editing) : undefined}
      />

      <TransferModal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        accounts={accounts}
      />

      {ajusteAccount && (
        <AjusteSaldoModal
          open={!!ajusteAccount}
          onClose={() => setAjusteAccount(null)}
          account={ajusteAccount}
        />
      )}
    </>
  )
}

function CardMenu({
  x,
  y,
  onEdit,
  onDelete,
  onClose,
}: {
  x: number
  y: number
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  const MENU_WIDTH = 176
  const left = Math.max(8, Math.min(x - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8))
  const top = Math.min(y, window.innerHeight - 100)

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
