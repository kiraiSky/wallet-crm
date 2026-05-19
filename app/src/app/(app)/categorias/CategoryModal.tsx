'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { DynamicIcon, ICON_OPTIONS } from '@/components/DynamicIcon'
import { ColorPicker } from '@/components/ColorPicker'
import { cn } from '@/lib/utils'
import { saveCategory } from './actions'
import type { CategoryWithStats } from './page'

interface Props {
  open: boolean
  onClose: () => void
  category?: CategoryWithStats | null
  defaultTipo: 'ENTRADA' | 'SAIDA'
}

export function CategoryModal({ open, onClose, category, defaultTipo }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [nome, setNome] = useState(category?.nome ?? '')
  const [tipo, setTipo] = useState<'ENTRADA' | 'SAIDA'>(category?.tipo ?? defaultTipo)
  const [cor, setCor] = useState(category?.cor ?? 'violet')
  const [icone, setIcone] = useState(category?.icone ?? 'package')
  const [error, setError] = useState<string | null>(null)

  function reset() {
    if (category) {
      setNome(category.nome)
      setTipo(category.tipo)
      setCor(category.cor)
      setIcone(category.icone)
    } else {
      setNome('')
      setTipo(defaultTipo)
      setCor('violet')
      setIcone('package')
    }
    setError(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const fd = new FormData()
    if (category) fd.set('id', category.id)
    fd.set('nome', nome)
    fd.set('tipo', tipo)
    fd.set('cor', cor)
    fd.set('icone', icone)

    startTransition(async () => {
      const res = await saveCategory({ ok: false }, fd)
      if (res.ok) {
        onClose()
        router.refresh()
        reset()
      } else {
        setError(res.message ?? Object.values(res.errors ?? {})[0] ?? 'Erro ao salvar')
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
      title={category ? 'Editar categoria' : 'Nova categoria'}
    >
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div>
          <label className="label">Tipo</label>
          <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100 rounded-xl">
            <button
              type="button"
              onClick={() => setTipo('ENTRADA')}
              className={cn(
                'py-2.5 rounded-lg font-semibold text-sm inline-flex items-center justify-center gap-1.5 transition',
                tipo === 'ENTRADA' ? 'bg-white shadow-sm text-emerald-600' : 'text-zinc-500'
              )}
            >
              <TrendingUp className="w-4 h-4" /> Receita
            </button>
            <button
              type="button"
              onClick={() => setTipo('SAIDA')}
              className={cn(
                'py-2.5 rounded-lg font-semibold text-sm inline-flex items-center justify-center gap-1.5 transition',
                tipo === 'SAIDA' ? 'bg-white shadow-sm text-red-500' : 'text-zinc-500'
              )}
            >
              <TrendingDown className="w-4 h-4" /> Despesa
            </button>
          </div>
        </div>

        <div>
          <label className="label">Nome da categoria *</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Peças, Aluguel, Serviço..."
            required
            autoFocus
            className="input-base"
          />
        </div>

        <div>
          <label className="label">Ícone</label>
          <div className="grid grid-cols-8 gap-1.5">
            {ICON_OPTIONS.map((ic) => (
              <button
                type="button"
                key={ic}
                onClick={() => setIcone(ic)}
                className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center transition',
                  icone === ic
                    ? 'border-2 border-emerald-500 bg-emerald-50 text-emerald-600'
                    : 'border border-zinc-200 hover:border-emerald-300 text-zinc-600'
                )}
                aria-label={ic}
              >
                <DynamicIcon name={ic} className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Cor</label>
          <ColorPicker value={cor} onChange={setCor} />
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
          <button type="submit" disabled={pending} className="btn-primary flex-1">
            {pending ? 'Salvando...' : 'Salvar categoria'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
