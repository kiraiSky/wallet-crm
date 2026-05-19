'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { UploadCloud, X as XIcon } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { cn } from '@/lib/utils'
import { saveTransaction } from './actions'
import type { TransactionRow } from './page'

type Account = { id: string; nome: string }
type Category = { id: string; nome: string; tipo: 'ENTRADA' | 'SAIDA' }

interface Props {
  open: boolean
  onClose: () => void
  tipo: 'ENTRADA' | 'SAIDA'
  transaction?: TransactionRow | null
  accounts: Account[]
  categories: Category[]
}

function isoToLocalDatetimeInput(iso: string | undefined): string {
  const d = iso ? new Date(iso) : new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function TransactionModal({
  open,
  onClose,
  tipo: initialTipo,
  transaction,
  accounts,
  categories,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)
  const [tipo, setTipo] = useState<'ENTRADA' | 'SAIDA'>(transaction?.tipo ?? initialTipo)
  const [valor, setValor] = useState(
    transaction ? transaction.valor.toFixed(2).replace('.', ',') : ''
  )
  const [descricao, setDescricao] = useState(transaction?.descricao ?? '')
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? '')
  const [accountId, setAccountId] = useState(transaction?.accountId ?? (accounts[0]?.id ?? ''))
  const [data, setData] = useState(isoToLocalDatetimeInput(transaction?.data))
  const [observacao, setObservacao] = useState(transaction?.observacao ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const filteredCategories = categories.filter((c) => c.tipo === tipo)

  // Sincroniza o formulário sempre que o modal abre ou muda o movimento a editar
  useEffect(() => {
    if (!open) return
    setTipo(transaction?.tipo ?? initialTipo)
    setValor(transaction ? transaction.valor.toFixed(2).replace('.', ',') : '')
    setDescricao(transaction?.descricao ?? '')
    setCategoryId(transaction?.categoryId ?? '')
    setAccountId(transaction?.accountId ?? (accounts[0]?.id ?? ''))
    setData(isoToLocalDatetimeInput(transaction?.data))
    setObservacao(transaction?.observacao ?? '')
    setFile(null)
    setError(null)
    setErrors({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transaction?.id])

  function reset() {
    setTipo(transaction?.tipo ?? initialTipo)
    setValor(transaction ? transaction.valor.toFixed(2).replace('.', ',') : '')
    setDescricao(transaction?.descricao ?? '')
    setCategoryId(transaction?.categoryId ?? '')
    setAccountId(transaction?.accountId ?? (accounts[0]?.id ?? ''))
    setData(isoToLocalDatetimeInput(transaction?.data))
    setObservacao(transaction?.observacao ?? '')
    setFile(null)
    setError(null)
    setErrors({})
  }

  function switchTipo(novoTipo: 'ENTRADA' | 'SAIDA') {
    setTipo(novoTipo)
    // Limpa categoria se ela não pertence ao novo tipo
    const stillValid = categories.find((c) => c.id === categoryId && c.tipo === novoTipo)
    if (!stillValid) setCategoryId('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setErrors({})

    const fd = new FormData()
    if (transaction) fd.set('id', transaction.id)
    fd.set('tipo', tipo)
    fd.set('valor', valor)
    fd.set('descricao', descricao)
    fd.set('data', new Date(data).toISOString())
    fd.set('accountId', accountId)
    fd.set('categoryId', categoryId)
    if (observacao) fd.set('observacao', observacao)
    if (file) fd.set('attachment', file)

    startTransition(async () => {
      const res = await saveTransaction({ ok: false }, fd)
      if (res.ok) {
        onClose()
        router.refresh()
        reset()
      } else if (res.errors) {
        setErrors(res.errors)
      } else if (res.message) {
        setError(res.message)
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
      title={transaction ? 'Editar movimento' : tipo === 'SAIDA' ? 'Nova despesa' : 'Nova receita'}
    >
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {/* Toggle tipo */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100 rounded-xl">
          <button
            type="button"
            onClick={() => switchTipo('ENTRADA')}
            className={cn(
              'py-2.5 rounded-lg font-semibold text-sm transition',
              tipo === 'ENTRADA' ? 'bg-white shadow-sm text-emerald-600' : 'text-zinc-500'
            )}
          >
            ↗ Entrada
          </button>
          <button
            type="button"
            onClick={() => switchTipo('SAIDA')}
            className={cn(
              'py-2.5 rounded-lg font-semibold text-sm transition',
              tipo === 'SAIDA' ? 'bg-white shadow-sm text-red-500' : 'text-zinc-500'
            )}
          >
            ↙ Saída
          </button>
        </div>

        {/* Valor */}
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
              autoFocus
              className="input-base !text-2xl !font-bold !py-3 pl-10"
            />
          </div>
          {errors.valor && <p className="text-xs text-red-500 mt-1">{errors.valor}</p>}
        </div>

        {/* Descrição */}
        <div>
          <label className="label">Descrição *</label>
          <input
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder={tipo === 'SAIDA' ? 'Ex: Fatura da luz · EDP' : 'Ex: Salário · Empresa XYZ'}
            required
            className="input-base"
          />
          {errors.descricao && <p className="text-xs text-red-500 mt-1">{errors.descricao}</p>}
        </div>

        {/* Categoria + Caixa */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Categoria *</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
              className="input-base"
            >
              <option value="">Seleciona...</option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
            {filteredCategories.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                Sem categorias de {tipo === 'SAIDA' ? 'despesa' : 'receita'} registadas.
              </p>
            )}
            {errors.categoryId && <p className="text-xs text-red-500 mt-1">{errors.categoryId}</p>}
          </div>
          <div>
            <label className="label">Conta *</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              required
              className="input-base"
            >
              <option value="">Seleciona...</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.nome}</option>
              ))}
            </select>
            {accounts.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                Cria uma conta primeiro.
              </p>
            )}
            {errors.accountId && <p className="text-xs text-red-500 mt-1">{errors.accountId}</p>}
          </div>
        </div>

        {/* Data */}
        <div>
          <label className="label">Data e hora</label>
          <input
            type="datetime-local"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="input-base"
          />
        </div>

        {/* Upload */}
        <div>
          <label className="label">Comprovativo (opcional)</label>
          {file ? (
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <div className="text-sm text-emerald-900 truncate">{file.name}</div>
              <button
                type="button"
                onClick={() => {
                  setFile(null)
                  if (fileRef.current) fileRef.current.value = ''
                }}
                className="text-emerald-700 hover:text-red-600"
                aria-label="Remover"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-1.5 px-3 py-4 bg-zinc-50 border-2 border-dashed border-zinc-200 hover:border-emerald-400 hover:bg-emerald-50/30 rounded-lg cursor-pointer transition">
              <UploadCloud className="w-6 h-6 text-zinc-400" />
              <span className="text-sm font-medium text-zinc-600">Clica para anexar</span>
              <span className="text-[11px] text-zinc-400">JPG, PNG, WebP ou PDF · até 5MB</span>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>
          )}
          {errors.attachment && <p className="text-xs text-red-500 mt-1">{errors.attachment}</p>}
        </div>

        {/* Observação */}
        <div>
          <label className="label">Observação (opcional)</label>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={2}
            placeholder="Notas internas..."
            className="input-base resize-none"
          />
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
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
          <button
            type="submit"
            disabled={pending || accounts.length === 0 || filteredCategories.length === 0}
            className="btn-primary flex-1"
          >
            {pending ? 'A guardar...' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
