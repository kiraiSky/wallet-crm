'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, ClipboardList, Car as CarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatEUR, formatDate } from '@/lib/format'
import { STATUS_LIST, STATUS_META, type WorkOrderStatus } from './status'
import { WorkOrderModal } from './WorkOrderModal'
import type { WorkOrderRow, CustomerOption } from './page'

interface Props {
  workOrders: WorkOrderRow[]
  customers: CustomerOption[]
  counts: Record<WorkOrderStatus | 'TOTAL', number>
  valorEmAberto: number
  filters: { search?: string; estado?: WorkOrderStatus; customerId?: string }
}

export function WorkOrdersClient({
  workOrders,
  customers,
  counts,
  valorEmAberto,
  filters,
}: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)

  function setQuery(key: string, value: string | null) {
    const url = new URL(window.location.href)
    if (value === null || value === '') url.searchParams.delete(key)
    else url.searchParams.set(key, value)
    router.push(url.pathname + url.search)
  }

  const emCurso = counts.ABERTA + counts.EM_DIAGNOSTICO + counts.AGUARDA_PECAS + counts.EM_REPARACAO

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Folhas de obra</h1>
          <p className="text-zinc-500 text-sm">Trabalhos abertos, em curso e concluídos.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary">
          <Plus className="w-4 h-4" />
          <span>Nova folha</span>
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="card p-4">
          <div className="text-xs text-zinc-500 mb-1">Total</div>
          <div className="text-lg font-bold text-zinc-900">{counts.TOTAL}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-zinc-500 mb-1">Em curso</div>
          <div className="text-lg font-bold text-orange-600">{emCurso}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-zinc-500 mb-1">Concluídas</div>
          <div className="text-lg font-bold text-emerald-600">{counts.CONCLUIDA}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-zinc-500 mb-1">Valor em aberto</div>
          <div className="text-lg font-bold text-zinc-900">{formatEUR(valorEmAberto)}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="card p-3 mb-4 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            defaultValue={filters.search ?? ''}
            placeholder="Pesquisar por problema, cliente ou matrícula..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') setQuery('q', (e.target as HTMLInputElement).value)
            }}
            className="input-base pl-10"
          />
        </div>
        <select
          value={filters.estado ?? ''}
          onChange={(e) => setQuery('estado', e.target.value || null)}
          className="input-base !w-auto"
        >
          <option value="">Todos os estados</option>
          {STATUS_LIST.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>
        <select
          value={filters.customerId ?? ''}
          onChange={(e) => setQuery('customer', e.target.value || null)}
          className="input-base !w-auto"
        >
          <option value="">Todos os clientes</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </div>

      {/* Lista */}
      <div className="card overflow-hidden">
        {workOrders.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList className="w-12 h-12 mx-auto text-zinc-300 mb-3" />
            <p className="text-sm text-zinc-500">
              {filters.search || filters.estado || filters.customerId
                ? 'Nenhuma folha encontrada para este filtro.'
                : 'Ainda não há folhas de obra abertas.'}
            </p>
            <button onClick={() => setModalOpen(true)} className="btn-primary mt-4">
              <Plus className="w-4 h-4" /> Abrir primeira folha
            </button>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden md:table w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-3 font-semibold">Nº</th>
                  <th className="px-4 py-3 font-semibold">Cliente · Viatura</th>
                  <th className="px-4 py-3 font-semibold">Problema</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Data</th>
                  <th className="px-4 py-3 font-semibold text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {workOrders.map((wo) => (
                  <tr
                    key={wo.id}
                    onClick={() => router.push(`/folhas/${wo.id}`)}
                    className="hover:bg-zinc-50 cursor-pointer"
                  >
                    <td className="px-4 py-3 font-mono font-semibold text-zinc-700">
                      #{wo.numero}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-zinc-900">{wo.customer.nome}</div>
                      {wo.vehicle && (
                        <div className="text-xs text-zinc-500 inline-flex items-center gap-1.5">
                          <CarIcon className="w-3 h-3 text-zinc-400" />
                          <span className="font-mono tracking-wider">{wo.vehicle.matricula}</span>
                          <span>· {wo.vehicle.marca} {wo.vehicle.modelo}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 max-w-xs truncate" title={wo.problema}>
                      {wo.problema}
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip estado={wo.estado} />
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">
                      {formatDate(wo.dataAbertura)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-zinc-900 whitespace-nowrap">
                      {formatEUR(wo.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile list */}
            <div className="md:hidden divide-y divide-zinc-100">
              {workOrders.map((wo) => (
                <div
                  key={wo.id}
                  onClick={() => router.push(`/folhas/${wo.id}`)}
                  className="p-4 hover:bg-zinc-50 cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-semibold text-zinc-700 text-xs">
                      #{wo.numero}
                    </span>
                    <StatusChip estado={wo.estado} />
                  </div>
                  <div className="font-medium text-zinc-900 text-sm">{wo.customer.nome}</div>
                  {wo.vehicle && (
                    <div className="text-xs text-zinc-500 inline-flex items-center gap-1.5 mt-0.5">
                      <CarIcon className="w-3 h-3 text-zinc-400" />
                      <span className="font-mono tracking-wider">{wo.vehicle.matricula}</span>
                      <span>· {wo.vehicle.marca} {wo.vehicle.modelo}</span>
                    </div>
                  )}
                  <div className="text-xs text-zinc-600 mt-1 truncate">{wo.problema}</div>
                  <div className="flex items-center justify-between mt-2 text-xs">
                    <span className="text-zinc-500">{formatDate(wo.dataAbertura)}</span>
                    <span className="font-bold text-zinc-900">{formatEUR(wo.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <WorkOrderModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        workOrder={null}
        customers={customers}
        defaultCustomerId={filters.customerId}
      />
    </>
  )
}

function StatusChip({ estado }: { estado: WorkOrderStatus }) {
  const meta = STATUS_META[estado]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap',
        meta.chip
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  )
}
