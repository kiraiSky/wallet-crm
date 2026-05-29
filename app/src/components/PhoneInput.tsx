'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { COUNTRIES, type Country } from '@/lib/countries'
import { Flag } from '@/components/Flag'

interface Props {
  country: Country
  local: string
  onCountryChange: (c: Country) => void
  onLocalChange: (v: string) => void
  placeholder?: string
  error?: string | null
  autoFocus?: boolean
}

export function PhoneInput({
  country,
  local,
  onCountryChange,
  onLocalChange,
  placeholder = '912 345 678',
  error,
  autoFocus,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  useEffect(() => {
    if (open) {
      setQuery('')
      requestAnimationFrame(() => searchRef.current?.focus())
    }
  }, [open])

  const filtered = query.trim()
    ? COUNTRIES.filter((c) => {
        const q = query.toLowerCase()
        return (
          c.name.toLowerCase().includes(q) ||
          c.dial.includes(q.replace(/\D/g, '')) ||
          c.iso2.toLowerCase().includes(q)
        )
      })
    : COUNTRIES

  return (
    <div className="relative" ref={ref}>
      <div className={cn(
        'flex items-stretch rounded-lg overflow-hidden border bg-zinc-50 focus-within:bg-white focus-within:border-indigo-500 transition',
        error ? 'border-red-300' : 'border-zinc-200'
      )}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 pl-3 pr-2 hover:bg-zinc-100 transition text-sm font-medium text-zinc-700 border-r border-zinc-200"
          title={`${country.name} (+${country.dial})`}
        >
          <Flag iso2={country.iso2} alt={country.name} />
          <span className="tabular-nums">+{country.dial}</span>
          <ChevronDown className={cn('w-3.5 h-3.5 text-zinc-400 transition', open && 'rotate-180')} />
        </button>
        <input
          type="tel"
          value={local}
          onChange={(e) => onLocalChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          inputMode="tel"
          className="flex-1 min-w-0 px-3 py-2.5 bg-transparent text-sm outline-none"
        />
      </div>

      {open && (
        <div className="absolute z-20 mt-1 left-0 right-0 sm:right-auto sm:min-w-[280px] bg-white border border-zinc-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-zinc-100 relative">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Procurar país ou código..."
              className="w-full pl-9 pr-2 py-1.5 text-sm bg-zinc-50 rounded-lg border border-transparent focus:border-indigo-500 focus:bg-white outline-none transition"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-zinc-400">Sem resultados</div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.iso2}
                  type="button"
                  onClick={() => {
                    onCountryChange(c)
                    setOpen(false)
                  }}
                  className={cn(
                    'w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-zinc-50 transition text-sm',
                    c.iso2 === country.iso2 && 'bg-indigo-50 text-indigo-700 font-medium'
                  )}
                >
                  <Flag iso2={c.iso2} alt={c.name} />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-zinc-400 tabular-nums">+{c.dial}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
