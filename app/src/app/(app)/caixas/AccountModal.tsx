'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Banknote, Landmark, CreditCard, SlidersHorizontal } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { ColorPicker } from '@/components/ColorPicker'
import { cn } from '@/lib/utils'
import { saveAccount } from './actions'
import type { AccountWithBalance } from './page'

interface Props {
  open: boolean
  onClose: () => void
  account?: AccountWithBalance | null
  onAjusteSaldo?: () => void
}

function initialState(account: AccountWithBalance | null | undefined) {
  return {
    nome: account?.nome ?? '',
    tipo: account?.tipo ?? 'DINHEIRO',
    saldoInicial: account ? account.saldoInicial.toFixed(2).replace('.', ',') : '0,00',
    cor: account?.cor ?? 'emerald',
    excluirDasMetricas: account?.excluirDasMetricas ?? false,
  }
}

const tipos = [
  { value: 'DINHEIRO', label: 'Dinheiro', Icon: Banknote, defaultIcon: 'banknote', defaultColor: 'emerald' },
  { value: 'BANCO', label: 'Banco', Icon: Landmark, defaultIcon: 'landmark', defaultColor: 'violet' },
  { value: 'CARTAO', label: 'Cartão', Icon: CreditCard, defaultIcon: 'credit-card', defaultColor: 'sky' },
] as const

export function AccountModal({ open, onClose, account, onAjusteSaldo }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const init = initialState(account)
  const [nome, setNome] = useState(init.nome)
  const [tipo, setTipo] = useState<string>(init.tipo)
  const [saldoInicial, setSaldoInicial] = useState(init.saldoInicial)
  const [cor, setCor] = useState(init.cor)
  const [excluirDasMetricas, setExcluirDasMetricas] = useState(init.excluirDasMetricas)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    const s = initialState(account)
    setNome(s.nome)
    setTipo(s.tipo)
    setSaldoInicial(s.saldoInicial)
    setCor(s.cor)
    setExcluirDasMetricas(s.excluirDasMetricas)
    setErrors({})
  }, [open, account?.id])

  function reset() {
    const s = initialState(account)
    setNome(s.nome)
    setTipo(s.tipo)
    setSaldoInicial(s.saldoInicial)
    setCor(s.cor)
    setExcluirDasMetricas(s.excluirDasMetricas)
    setErrors({})
  }

  function selectTipo(t: typeof tipos[number]) {
    setTipo(t.value)
    if (!account) setCor(t.defaultColor)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const tipoMeta = tipos.find((t) => t.value === tipo)!
    const fd = new FormData()
    if (account) fd.set('id', account.id)
    fd.set('nome', nome)
    fd.set('tipo', tipo)
    fd.set('saldoInicial', saldoInicial)
    fd.set('cor', cor)
    fd.set('icone', account?.icone ?? tipoMeta.defaultIcon)
    fd.set('excluirDasMetricas', excluirDasMetricas ? 'true' : 'false')

    startTransition(async () => {
      const res = await saveAccount({ ok: false }, fd)
      if (res.ok) {
        onClose()
        router.refresh()
        reset()
      } else if (res.errors) {
        setErrors(res.errors)
      }
    })
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        onClose()
        reset()
      }}
      title={account ? 'Editar conta' : 'Nova conta'}
    >
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div>
          <label className="label">Nome da conta *</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Carteira, Conta CGD, Cartão Millennium..."
            required
            autoFocus
            className="input-base"
          />
          {errors.nome && <p className="text-xs text-red-500 mt-1">{errors.nome}</p>}
        </div>

        <div>
          <label className="label">Tipo</label>
          <div className="grid grid-cols-3 gap-2">
            {tipos.map((t) => {
              const active = tipo === t.value
              return (
                <button
                  type="button"
                  key={t.value}
                  onClick={() => selectTipo(t)}
                  className={cn(
                    'flex flex-col items-center gap-1 p-3 rounded-lg text-xs font-medium transition border',
                    active
                      ? 'border-2 border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-zinc-200 hover:bg-zinc-50 hover:border-indigo-300 text-zinc-600'
                  )}
                >
                  <t.Icon className="w-5 h-5" />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="label">Saldo inicial</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-semibold">€</span>
            <input
              type="text"
              value={saldoInicial}
              onChange={(e) => setSaldoInicial(e.target.value)}
              inputMode="decimal"
              className="input-base pl-8"
            />
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">Quanto tens nesta conta agora.</p>
        </div>

        <div>
          <label className="label">Cor</label>
          <ColorPicker value={cor} onChange={setCor} />
        </div>

        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative flex-shrink-0 mt-0.5">
            <input
              type="checkbox"
              checked={excluirDasMetricas}
              onChange={(e) => setExcluirDasMetricas(e.target.checked)}
              className="peer sr-only"
            />
            <div className={cn(
              'w-5 h-5 rounded border-2 transition flex items-center justify-center',
              excluirDasMetricas
                ? 'bg-amber-500 border-amber-500'
                : 'border-zinc-300 bg-white group-hover:border-amber-400'
            )}>
              {excluirDasMetricas && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>
          <div>
            <span className="text-sm font-medium text-zinc-700">Excluir das métricas</span>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Os movimentos desta conta não contam no resumo, evolução do saldo nem relatórios.
            </p>
          </div>
        </label>

        {account && onAjusteSaldo && (
          <button
            type="button"
            onClick={() => {
              onClose()
              reset()
              onAjusteSaldo()
            }}
            className="w-full flex items-center justify-center gap-2 text-sm text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg px-3 py-2 transition"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Corrigir saldo real
          </button>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => {
              onClose()
              reset()
            }}
            className="btn-secondary flex-1"
          >
            Cancelar
          </button>
          <button type="submit" disabled={pending} className="btn-primary flex-1">
            {pending ? 'A guardar...' : 'Guardar conta'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
