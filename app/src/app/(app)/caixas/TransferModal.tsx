'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRightLeft } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { formatEUR } from '@/lib/format'
import { createTransfer } from './actions'
import type { AccountFormState } from './actions'
import type { AccountWithBalance } from './page'

interface Props {
  open: boolean
  onClose: () => void
  accounts: AccountWithBalance[]
}

function todayLocal() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export function TransferModal({ open, onClose, accounts }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [state, setState] = useState<AccountFormState>({ ok: false })

  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [data, setData] = useState(todayLocal)

  useEffect(() => {
    if (!open) return
    setState({ ok: false })
    setFromId(accounts[0]?.id ?? '')
    setToId(accounts[1]?.id ?? '')
    setValor('')
    setDescricao('')
    setData(todayLocal())
  }, [open, accounts])

  const fromAccount = accounts.find((a) => a.id === fromId)
  const toAccount = accounts.find((a) => a.id === toId)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    fd.set('fromAccountId', fromId)
    fd.set('toAccountId', toId)
    fd.set('valor', valor)
    fd.set('descricao', descricao || 'Transferência entre contas')
    fd.set('data', data)

    startTransition(async () => {
      const res = await createTransfer({ ok: false }, fd)
      setState(res)
      if (res.ok) {
        onClose()
        router.refresh()
      }
    })
  }

  return (
    <Modal open={open} onClose={onClose} title="Transferência entre contas">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {state.message && (
          <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{state.message}</p>
        )}

        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <div>
            <label className="label">Conta origem</label>
            <select
              value={fromId}
              onChange={(e) => setFromId(e.target.value)}
              required
              className="input-base"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </select>
            {fromAccount && (
              <p className="text-[11px] text-zinc-400 mt-1">Saldo: {formatEUR(fromAccount.saldoAtual)}</p>
            )}
          </div>

          <div className="pb-2 flex justify-center">
            <ArrowRightLeft className="w-4 h-4 text-zinc-400" />
          </div>

          <div>
            <label className="label">Conta destino</label>
            <select
              value={toId}
              onChange={(e) => setToId(e.target.value)}
              required
              className="input-base"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </select>
            {toAccount && (
              <p className="text-[11px] text-zinc-400 mt-1">Saldo: {formatEUR(toAccount.saldoAtual)}</p>
            )}
          </div>
        </div>
        {state.errors?.toAccountId && (
          <p className="text-xs text-red-500">{state.errors.toAccountId}</p>
        )}

        <div>
          <label className="label">Valor *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-semibold">€</span>
            <input
              type="text"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              required
              className="input-base pl-8"
            />
          </div>
          {state.errors?.valor && <p className="text-xs text-red-500 mt-1">{state.errors.valor}</p>}
        </div>

        <div>
          <label className="label">Data *</label>
          <input
            type="datetime-local"
            value={data}
            onChange={(e) => setData(e.target.value)}
            required
            className="input-base"
          />
        </div>

        <div>
          <label className="label">Descrição</label>
          <input
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Transferência entre contas"
            className="input-base"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button type="submit" disabled={pending} className="btn-primary flex-1">
            {pending ? 'A transferir...' : 'Transferir'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
