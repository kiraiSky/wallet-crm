'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/Modal'
import { cn } from '@/lib/utils'
import { saveCustomer } from './actions'
import type { CustomerTag } from './page'

export type CustomerForModal = {
  id: string
  nome: string
  telefone: string | null
  email: string | null
  nif: string | null
  morada: string | null
  observacoes: string | null
  aniversario: string | null // ISO
  tag: CustomerTag
}

interface Props {
  open: boolean
  onClose: () => void
  customer: CustomerForModal | null
  onSaved?: (id: string) => void
}

const TAGS: { value: CustomerTag; label: string }[] = [
  { value: 'NOVO', label: 'Novo' },
  { value: 'RECORRENTE', label: 'Recorrente' },
  { value: 'VIP', label: 'VIP' },
  { value: 'INATIVO', label: 'Inativo' },
]

function isoToDateInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function initialState(c: CustomerForModal | null) {
  return {
    nome: c?.nome ?? '',
    telefone: c?.telefone ?? '',
    email: c?.email ?? '',
    nif: c?.nif ?? '',
    morada: c?.morada ?? '',
    observacoes: c?.observacoes ?? '',
    aniversario: isoToDateInput(c?.aniversario ?? null),
    tag: (c?.tag ?? 'NOVO') as CustomerTag,
  }
}

export function CustomerModal({ open, onClose, customer, onSaved }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const init = initialState(customer)
  const [nome, setNome] = useState(init.nome)
  const [telefone, setTelefone] = useState(init.telefone)
  const [email, setEmail] = useState(init.email)
  const [nif, setNif] = useState(init.nif)
  const [morada, setMorada] = useState(init.morada)
  const [observacoes, setObservacoes] = useState(init.observacoes)
  const [aniversario, setAniversario] = useState(init.aniversario)
  const [tag, setTag] = useState<CustomerTag>(init.tag)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const s = initialState(customer)
    setNome(s.nome)
    setTelefone(s.telefone)
    setEmail(s.email)
    setNif(s.nif)
    setMorada(s.morada)
    setObservacoes(s.observacoes)
    setAniversario(s.aniversario)
    setTag(s.tag)
    setErrors({})
    setError(null)
  }, [open, customer?.id])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setErrors({})
    const fd = new FormData()
    if (customer) fd.set('id', customer.id)
    fd.set('nome', nome)
    if (telefone) fd.set('telefone', telefone)
    if (email) fd.set('email', email)
    if (nif) fd.set('nif', nif)
    if (morada) fd.set('morada', morada)
    if (observacoes) fd.set('observacoes', observacoes)
    if (aniversario) fd.set('aniversario', aniversario)
    fd.set('tag', tag)

    startTransition(async () => {
      const res = await saveCustomer({ ok: false }, fd)
      if (res.ok) {
        onClose()
        router.refresh()
        if (res.id && onSaved) onSaved(res.id)
      } else if (res.errors) {
        setErrors(res.errors)
      } else if (res.message) {
        setError(res.message)
      }
    })
  }

  return (
    <Modal open={open} onClose={onClose} title={customer ? 'Editar cliente' : 'Novo cliente'} size="lg">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div>
          <label className="label">Nome *</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: António Silva"
            required
            autoFocus
            className="input-base"
          />
          {errors.nome && <p className="text-xs text-red-500 mt-1">{errors.nome}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Telefone</label>
            <input
              type="tel"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="912 345 678"
              className="input-base"
            />
            {errors.telefone && <p className="text-xs text-red-500 mt-1">{errors.telefone}</p>}
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="antonio@exemplo.pt"
              className="input-base"
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">NIF</label>
            <input
              type="text"
              value={nif}
              onChange={(e) => setNif(e.target.value.replace(/\D/g, '').slice(0, 9))}
              placeholder="9 dígitos"
              inputMode="numeric"
              className="input-base"
            />
            {errors.nif && <p className="text-xs text-red-500 mt-1">{errors.nif}</p>}
          </div>
          <div>
            <label className="label">Aniversário</label>
            <input
              type="date"
              value={aniversario}
              onChange={(e) => setAniversario(e.target.value)}
              className="input-base"
            />
          </div>
        </div>

        <div>
          <label className="label">Morada</label>
          <input
            type="text"
            value={morada}
            onChange={(e) => setMorada(e.target.value)}
            placeholder="Rua, número, código postal, localidade"
            className="input-base"
          />
        </div>

        <div>
          <label className="label">Tag</label>
          <div className="grid grid-cols-4 gap-2">
            {TAGS.map((t) => (
              <button
                type="button"
                key={t.value}
                onClick={() => setTag(t.value)}
                className={cn(
                  'py-2 rounded-lg text-xs font-semibold transition border',
                  tag === t.value
                    ? 'border-2 border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-zinc-200 hover:bg-zinc-50 text-zinc-600'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Observações</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={3}
            placeholder="Notas internas, preferências, histórico relevante..."
            className="input-base resize-none"
          />
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button type="submit" disabled={pending} className="btn-primary flex-1">
            {pending ? 'A guardar...' : customer ? 'Guardar alterações' : 'Criar cliente'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
