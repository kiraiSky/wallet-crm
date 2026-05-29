'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const presets = [
  { key: 'mes-atual', label: 'Este mês' },
  { key: 'mes-passado', label: 'Mês passado' },
  { key: 'trimestre', label: '3 meses' },
  { key: 'ano', label: 'Ano' },
] as const

export function PeriodFilter({
  current,
  fromInput,
  toInput,
}: {
  current: string
  fromInput: string
  toInput: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [from, setFrom] = useState(fromInput)
  const [to, setTo] = useState(toInput)

  function apply(preset: string) {
    const p = new URLSearchParams(searchParams)
    p.set('p', preset)
    p.delete('from')
    p.delete('to')
    router.push(`/relatorios?${p.toString()}`)
  }

  function applyCustom() {
    const p = new URLSearchParams(searchParams)
    p.set('p', 'custom')
    p.set('from', from)
    p.set('to', to)
    router.push(`/relatorios?${p.toString()}`)
  }

  return (
    <div className="card p-3 mb-4 print:hidden">
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:items-center">
        {presets.map((p) => {
          const active = current === p.key
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => apply(p.key)}
              className={cn(
                'px-3 py-2 rounded-lg text-sm font-medium transition',
                active ? 'bg-indigo-500 text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              )}
            >
              {p.label}
            </button>
          )
        })}
      </div>
      <div className="border-t border-zinc-100 mt-3 pt-3 sm:border-t-0 sm:mt-0 sm:pt-0 sm:inline-flex sm:items-center sm:gap-1 sm:ml-2">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 sm:flex">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="input-base sm:w-[150px] min-w-0"
            aria-label="Data inicial"
          />
          <span className="text-zinc-400 text-center px-1">→</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="input-base sm:w-[150px] min-w-0"
            aria-label="Data final"
          />
        </div>
        <button
          type="button"
          onClick={applyCustom}
          className={cn(
            'mt-2 sm:mt-0 sm:ml-1 w-full sm:w-auto px-3 py-2 rounded-lg text-sm font-medium transition',
            current === 'custom' ? 'bg-indigo-500 text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
          )}
        >
          Aplicar
        </button>
      </div>
    </div>
  )
}
