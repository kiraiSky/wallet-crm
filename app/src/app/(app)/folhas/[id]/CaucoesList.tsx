'use client'

import { useTransition } from 'react'
import { Wallet, Trash2, FileText, ArrowDownToLine } from 'lucide-react'
import type { WorkOrderCaucaoRow } from './page'
import { deleteCaucao } from './caucao-actions'

type Props = {
  caucoes: WorkOrderCaucaoRow[]
  totalCaucoes: number
  totalFolha: number
  totalRestante: number
}

export function CaucoesList({ caucoes, totalCaucoes, totalFolha, totalRestante }: Props) {
  const [pending, startTransition] = useTransition()

  function handleDelete(id: string, comFR: boolean) {
    const msg = comFR
      ? 'Esta caução já tem FR emitida no Moloni e não pode ser eliminada por aqui — anula primeiro o documento no Moloni.'
      : 'Eliminar esta caução? Se foi criada uma transação, também será eliminada.'
    if (comFR) { alert(msg); return }
    if (!confirm(msg)) return
    startTransition(async () => {
      const result = await deleteCaucao(id)
      if (!result.ok) alert(result.message ?? 'Erro a eliminar caução')
    })
  }

  if (caucoes.length === 0) return null

  return (
    <div className="card p-5">
      <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3 flex items-center gap-2">
        <Wallet className="w-3.5 h-3.5" />
        Cauções recebidas
      </h2>

      <ul className="divide-y divide-zinc-100">
        {caucoes.map((c) => (
          <li key={c.id} className="py-3 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-zinc-900">{c.valor.toFixed(2)} €</span>
                <span className="text-xs text-zinc-500">
                  {new Date(c.data).toLocaleDateString('pt-PT')}
                </span>
                {c.transactionId && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
                    <ArrowDownToLine className="w-3 h-3" />
                    Entrada
                  </span>
                )}
                {c.moloniDocumentId && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded px-1.5 py-0.5">
                    <FileText className="w-3 h-3" />
                    {c.moloniDocumentType ?? 'FR'} #{c.moloniDocumentId}
                  </span>
                )}
              </div>
              {c.notas && <p className="text-xs text-zinc-500 mt-0.5">{c.notas}</p>}
            </div>
            <button
              type="button"
              onClick={() => handleDelete(c.id, Boolean(c.moloniDocumentId))}
              disabled={pending}
              className="text-zinc-400 hover:text-red-600 transition-colors p-1"
              title={c.moloniDocumentId ? 'Anula primeiro a FR no Moloni' : 'Eliminar caução'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-3 pt-3 border-t border-zinc-100 space-y-1 text-sm">
        <div className="flex justify-between text-zinc-500">
          <span>Total folha</span>
          <span>{totalFolha.toFixed(2)} €</span>
        </div>
        <div className="flex justify-between text-emerald-700">
          <span>Cauções recebidas</span>
          <span>− {totalCaucoes.toFixed(2)} €</span>
        </div>
        <div className="flex justify-between font-semibold text-zinc-900">
          <span>Restante a faturar</span>
          <span>{totalRestante.toFixed(2)} €</span>
        </div>
      </div>
    </div>
  )
}
