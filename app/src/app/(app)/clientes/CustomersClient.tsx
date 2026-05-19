'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'


import {
  Plus, Search, Users, Star, Repeat, UserPlus, UserX, Phone, Mail, Hash,
  Car as CarIcon, FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CustomerModal } from './CustomerModal'
import type { CustomerRow, CustomerTag } from './page'

interface Props {
  customers: CustomerRow[]
  counts: Record<CustomerTag | 'TOTAL', number>
  filters: { search?: string; tag?: CustomerTag }
}

const TAG_META: Record<CustomerTag, { label: string; chip: string; dot: string }> = {
  VIP: {
    label: 'VIP',
    chip: 'bg-amber-100 text-amber-700',
    dot: 'bg-amber-500',
  },
  RECORRENTE: {
    label: 'Recorrente',
    chip: 'bg-emerald-100 text-emerald-700',
    dot: 'bg-emerald-500',
  },
  NOVO: {
    label: 'Novo',
    chip: 'bg-sky-100 text-sky-700',
    dot: 'bg-sky-500',
  },
  INATIVO: {
    label: 'Inativo',
    chip: 'bg-zinc-100 text-zinc-600',
    dot: 'bg-zinc-400',
  },
}

export function CustomersClient({ customers, counts, filters }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)

  function setQuery(key: string, value: string | null) {
    const url = new URL(window.location.href)
    if (value === null || value === '') url.searchParams.delete(key)
    else url.searchParams.set(key, value)
    router.push(url.pathname + url.search)
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Clientes</h1>
          <p className="text-zinc-500 text-sm">Base de clientes da oficina e respetivas viaturas.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary">
          <Plus className="w-4 h-4" />
          <span>Novo cliente</span>
        </button>
      </div>

      {/* KPIs por tag */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <StatCard
          icon={Users}
          label="Total"
          value={counts.TOTAL}
          accent="text-zinc-900"
          bg="bg-zinc-100 text-zinc-700"
        />
        <StatCard
          icon={Star}
          label="VIP"
          value={counts.VIP}
          accent="text-amber-700"
          bg="bg-amber-100 text-amber-700"
        />
        <StatCard
          icon={Repeat}
          label="Recorrentes"
          value={counts.RECORRENTE}
          accent="text-emerald-700"
          bg="bg-emerald-100 text-emerald-700"
        />
        <StatCard
          icon={UserPlus}
          label="Novos"
          value={counts.NOVO}
          accent="text-sky-700"
          bg="bg-sky-100 text-sky-700"
        />
        <StatCard
          icon={UserX}
          label="Inativos"
          value={counts.INATIVO}
          accent="text-zinc-700"
          bg="bg-zinc-100 text-zinc-600"
        />
      </div>

      {/* Filtros */}
      <div className="card p-3 mb-4 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            defaultValue={filters.search ?? ''}
            placeholder="Pesquisar por nome, telefone, NIF ou email..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') setQuery('q', (e.target as HTMLInputElement).value)
            }}
            className="input-base pl-10"
          />
        </div>
        <select
          value={filters.tag ?? ''}
          onChange={(e) => setQuery('tag', e.target.value || null)}
          className="input-base !w-auto"
        >
          <option value="">Todas as tags</option>
          <option value="VIP">VIP</option>
          <option value="RECORRENTE">Recorrente</option>
          <option value="NOVO">Novo</option>
          <option value="INATIVO">Inativo</option>
        </select>
      </div>

      {/* Lista */}
      <div className="card overflow-hidden">
        {customers.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-zinc-300 mb-3" />
            <p className="text-sm text-zinc-500">
              {filters.search || filters.tag
                ? 'Nenhum cliente encontrado para este filtro.'
                : 'Ainda não há clientes registados.'}
            </p>
            <button onClick={() => setModalOpen(true)} className="btn-primary mt-4">
              <Plus className="w-4 h-4" /> Registar primeiro cliente
            </button>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden md:table w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 font-semibold">Contacto</th>
                  <th className="px-4 py-3 font-semibold">NIF</th>
                  <th className="px-4 py-3 font-semibold">Tag</th>
                  <th className="px-4 py-3 font-semibold text-right">Viaturas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/clientes/${c.id}`)}
                    className="hover:bg-zinc-50 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-zinc-900">{c.nome}</span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 text-xs">
                      <div className="flex flex-col gap-0.5">
                        {c.telefone && (
                          <span className="inline-flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-zinc-400" /> {c.telefone}
                          </span>
                        )}
                        {c.email && (
                          <span className="inline-flex items-center gap-1.5">
                            <Mail className="w-3 h-3 text-zinc-400" /> {c.email}
                          </span>
                        )}
                        {!c.telefone && !c.email && <span className="text-zinc-300">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 text-xs">
                      {c.nif ? (
                        <span className="inline-flex items-center gap-1">
                          <Hash className="w-3 h-3 text-zinc-400" /> {c.nif}
                        </span>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <TagChip tag={c.tag} />
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-600">
                      <span className="inline-flex items-center gap-1.5">
                        <CarIcon className="w-3.5 h-3.5 text-zinc-400" />
                        {c.totalVeiculos}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile list */}
            <div className="md:hidden divide-y divide-zinc-100">
              {customers.map((c) => (
                <Link
                  key={c.id}
                  href={`/clientes/${c.id}`}
                  className="flex items-center gap-3 p-4 hover:bg-zinc-50"
                >
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                      TAG_META[c.tag].chip
                    )}
                  >
                    {initials(c.nome)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-zinc-900 truncate">{c.nome}</div>
                    <div className="text-xs text-zinc-500 truncate">
                      {c.telefone || c.email || c.nif || '—'}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <TagChip tag={c.tag} />
                    <span className="text-[11px] text-zinc-500 inline-flex items-center gap-1">
                      <CarIcon className="w-3 h-3 text-zinc-400" /> {c.totalVeiculos}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      <CustomerModal open={modalOpen} onClose={() => setModalOpen(false)} customer={null} />
    </>
  )
}

function TagChip({ tag }: { tag: CustomerTag }) {
  const meta = TAG_META[tag]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
        meta.chip
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  bg,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  accent: string
  bg: string
}) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', bg)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-zinc-500">{label}</div>
        <div className={cn('text-lg font-bold', accent)}>{value}</div>
      </div>
    </div>
  )
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
