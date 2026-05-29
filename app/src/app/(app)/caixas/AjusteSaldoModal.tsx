'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/Modal'
import { formatEUR, parseEURToCents } from '@/lib/format'
import { adjustBalance } from './actions'
import type { AccountFormState } from './actions'
import type { AccountWithBalance } from './page'

interface Props {
  open: boolean
  onClose: () => void
  account: AccountWithBalance
}

export function AjusteSaldoModal({ open, onClose, account }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [state, setState] = useState<AccountFormState>({ ok: false })
  const [saldoReal, setSaldoReal] = useState('')

  useEffect(() => {
    if (!open) return
    setState({ ok: false })
    setSaldoReal('')
  }, [open, account.id])

  const saldoRealCents = saldoReal ? parseEURToCents(saldoReal) : null
  const saldoAtualCents = Math.round(account.saldoAtual * 100)
  const diff = saldoRealCents !== null ? saldoRealCents - saldoAtualCents : null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    fd.set('accountId', account.id)
    fd.set('saldoReal', saldoReal)
    fd.set('saldoAtual', String(account.saldoAtual))

    startTransition(async () => {
      const res = await adjustBalance({ ok: false }, fd)
      setState(res)
      if (res.ok) {
        onClose()
        router.refresh()
      }
    })
  }

  return (
    <Modal open={open} onClose={onClose} title="Corrigir saldo real">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="bg-zinc-50 rounded-xl p-4 space-y-1">
          <div className="text-xs text-zinc-500">Conta</div>
          <div className="font-semibold text-zinc-900">{account.nome}</div>
          <div className="text-xs text-zinc-500 mt-2">Saldo atual (calculado)</div>
          <div className="text-lg font-bold text-zinc-900">{formatEUR(account.saldoAtual)}</div>
        </div>

        <div>
          <label className="label">Valor real na conta *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-semibold">€</span>
            <input
              type="text"
              value={saldoReal}
              onChange={(e) => setSaldoReal(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              required
              autoFocus
              className="input-base pl-8"
            />
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">
            Quanto tens realmente nesta conta agora.
          </p>
        </div>

        {diff !== null && saldoReal !== '' && (
          <div
            className={`rounded-xl px-4 py-3 text-sm font-medium ${
              diff === 0
                ? 'bg-indigo-50 text-indigo-700'
                : diff > 0
                ? 'bg-blue-50 text-blue-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {diff === 0 ? (
              'O saldo já está correto — nenhum ajuste necessário.'
            ) : diff > 0 ? (
              <>Vai ser criada uma <strong>entrada</strong> de <strong>{formatEUR(Math.abs(diff) / 100)}</strong> para corrigir o saldo.</>
            ) : (
              <>Vai ser criada uma <strong>saída</strong> de <strong>{formatEUR(Math.abs(diff) / 100)}</strong> para corrigir o saldo.</>
            )}
          </div>
        )}

        {state.message && (
          <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{state.message}</p>
        )}

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button type="submit" disabled={pending || diff === 0} className="btn-primary flex-1">
            {pending ? 'A ajustar...' : 'Corrigir saldo'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
