'use client'

import { useState, useTransition, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Package, Wrench } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { cn } from '@/lib/utils'
import { formatEUR } from '@/lib/format'
import { saveWorkOrderItem } from '../actions'
import type { WorkOrderItemRow } from './page'

interface Props {
  open: boolean
  onClose: () => void
  workOrderId: string
  item: WorkOrderItemRow | null
  defaultTipo?: 'PECA' | 'MAO_OBRA'
}

function initialState(item: WorkOrderItemRow | null, defaultTipo: 'PECA' | 'MAO_OBRA') {
  return {
    tipo: (item?.tipo ?? defaultTipo) as 'PECA' | 'MAO_OBRA',
    descricao: item?.descricao ?? '',
    quantidade: item ? String(item.quantidade).replace('.', ',') : '1',
    precoUnit: item ? item.precoUnit.toFixed(2).replace('.', ',') : '',
  }
}

function parseDec(value: string): number {
  const cleaned = value.replace(/\s/g, '').replace(/[^\d,.-]/g, '')
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned
  const num = parseFloat(normalized)
  return isNaN(num) ? 0 : num
}

export function ItemModal({ open, onClose, workOrderId, item, defaultTipo = 'PECA' }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const init = initialState(item, defaultTipo)
  const [tipo, setTipo] = useState<'PECA' | 'MAO_OBRA'>(init.tipo)
  const [descricao, setDescricao] = useState(init.descricao)
  const [quantidade, setQuantidade] = useState(init.quantidade)
  const [precoUnit, setPrecoUnit] = useState(init.precoUnit)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const s = initialState(item, defaultTipo)
    setTipo(s.tipo)
    setDescricao(s.descricao)
    setQuantidade(s.quantidade)
    setPrecoUnit(s.precoUnit)
    setErrors({})
    setError(null)
  }, [open, item?.id, defaultTipo])

  const total = useMemo(() => {
    const q = parseDec(quantidade)
    const p = parseDec(precoUnit)
    return q * p
  }, [quantidade, precoUnit])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setErrors({})
    const fd = new FormData()
    if (item) fd.set('id', item.id)
    fd.set('workOrderId', workOrderId)
    fd.set('tipo', tipo)
    fd.set('descricao', descricao)
    fd.set('quantidade', quantidade)
    fd.set('precoUnit', precoUnit)

    startTransition(async () => {
      const res = await saveWorkOrderItem({ ok: false }, fd)
      if (res.ok) {
        onClose()
        router.refresh()
      } else if (res.errors) {
        setErrors(res.errors)
      } else if (res.message) {
        setError(res.message)
      }
    })
  }

  return (
    <Modal open={open} onClose={onClose} title={item ? 'Editar item' : 'Novo item'} size="md">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100 rounded-xl">
          <button
            type="button"
            onClick={() => setTipo('PECA')}
            className={cn(
              'py-2.5 rounded-lg font-semibold text-sm inline-flex items-center justify-center gap-1.5 transition',
              tipo === 'PECA' ? 'bg-white shadow-sm text-violet-700' : 'text-zinc-500'
            )}
          >
            <Package className="w-4 h-4" /> Peça
          </button>
          <button
            type="button"
            onClick={() => setTipo('MAO_OBRA')}
            className={cn(
              'py-2.5 rounded-lg font-semibold text-sm inline-flex items-center justify-center gap-1.5 transition',
              tipo === 'MAO_OBRA' ? 'bg-white shadow-sm text-orange-700' : 'text-zinc-500'
            )}
          >
            <Wrench className="w-4 h-4" /> Mão de obra
          </button>
        </div>

        <div>
          <label className="label">Descrição *</label>
          <input
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder={tipo === 'PECA' ? 'Ex: Pastilhas de travão dianteiras' : 'Ex: Substituição de pastilhas + balanceamento'}
            required
            autoFocus
            className="input-base"
          />
          {errors.descricao && <p className="text-xs text-red-500 mt-1">{errors.descricao}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Quantidade *</label>
            <input
              type="text"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              inputMode="decimal"
              placeholder="1"
              required
              className="input-base"
            />
            {errors.quantidade && <p className="text-xs text-red-500 mt-1">{errors.quantidade}</p>}
          </div>
          <div>
            <label className="label">Preço unitário *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-semibold">€</span>
              <input
                type="text"
                value={precoUnit}
                onChange={(e) => setPrecoUnit(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                required
                className="input-base pl-8"
              />
            </div>
            {errors.precoUnit && <p className="text-xs text-red-500 mt-1">{errors.precoUnit}</p>}
          </div>
        </div>

        <div className="flex items-center justify-between bg-zinc-50 rounded-lg p-3">
          <span className="text-sm text-zinc-600">Total do item</span>
          <span className="text-lg font-bold text-zinc-900">{formatEUR(total)}</span>
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
            {pending ? 'A guardar...' : item ? 'Guardar alterações' : 'Adicionar item'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
