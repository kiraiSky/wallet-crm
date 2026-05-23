'use client'

import { useState, useTransition, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { BadgeCheck, Phone, Search, UserRound } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { saveWorkOrder } from './actions'
import type { CustomerOption } from './page'
import { cn } from '@/lib/utils'

export type WorkOrderForModal = {
  id: string
  customerId: string
  vehicleId: string | null
  problema: string
  diagnostico: string | null
  trabalho: string | null
  observacoes: string | null
  kmEntrada: number | null
  dataPrevista: string | null // ISO
}

interface Props {
  open: boolean
  onClose: () => void
  workOrder: WorkOrderForModal | null
  customers: CustomerOption[]
  defaultCustomerId?: string
}

type VehicleOption = { id: string; matricula: string; marca: string; modelo: string }

function isoToDateInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function initialState(w: WorkOrderForModal | null, defaultCustomerId?: string) {
  return {
    customerId: w?.customerId ?? defaultCustomerId ?? '',
    vehicleId: w?.vehicleId ?? '',
    problema: w?.problema ?? '',
    diagnostico: w?.diagnostico ?? '',
    trabalho: w?.trabalho ?? '',
    observacoes: w?.observacoes ?? '',
    kmEntrada: w?.kmEntrada !== null && w?.kmEntrada !== undefined ? String(w.kmEntrada) : '',
    dataPrevista: isoToDateInput(w?.dataPrevista ?? null),
  }
}

export function WorkOrderModal({
  open,
  onClose,
  workOrder,
  customers,
  defaultCustomerId,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const init = initialState(workOrder, defaultCustomerId)
  const [customerId, setCustomerId] = useState(init.customerId)
  const [vehicleId, setVehicleId] = useState(init.vehicleId)
  const [problema, setProblema] = useState(init.problema)
  const [diagnostico, setDiagnostico] = useState(init.diagnostico)
  const [trabalho, setTrabalho] = useState(init.trabalho)
  const [observacoes, setObservacoes] = useState(init.observacoes)
  const [kmEntrada, setKmEntrada] = useState(init.kmEntrada)
  const [dataPrevista, setDataPrevista] = useState(init.dataPrevista)
  const [vehicles, setVehicles] = useState<VehicleOption[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false)

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === customerId) ?? null,
    [customers, customerId]
  )

  const customerMatches = useMemo(() => {
    const query = normalizeSearch(customerQuery)
    if (!query) return customers.slice(0, 8)

    return customers
      .filter((customer) => {
        const haystack = normalizeSearch([
          customer.nome,
          customer.nif ?? '',
          customer.telefone ?? '',
        ].join(' '))
        return haystack.includes(query)
      })
      .slice(0, 8)
  }, [customers, customerQuery])

  useEffect(() => {
    if (!open) return
    const s = initialState(workOrder, defaultCustomerId)
    setCustomerId(s.customerId)
    setVehicleId(s.vehicleId)
    setProblema(s.problema)
    setDiagnostico(s.diagnostico)
    setTrabalho(s.trabalho)
    setObservacoes(s.observacoes)
    setKmEntrada(s.kmEntrada)
    setDataPrevista(s.dataPrevista)
    const initialCustomer = customers.find((customer) => customer.id === s.customerId)
    setCustomerQuery(initialCustomer?.nome ?? '')
    setCustomerSearchOpen(false)
    setErrors({})
    setError(null)
  }, [open, workOrder?.id, defaultCustomerId, customers])

  // Carrega viaturas quando o cliente muda
  useEffect(() => {
    if (!customerId) {
      setVehicles([])
      return
    }
    let cancelled = false
    fetch(`/api/customers/${customerId}/vehicles`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setVehicles(data.vehicles ?? [])
      })
      .catch(() => {
        if (!cancelled) setVehicles([])
      })
    return () => {
      cancelled = true
    }
  }, [customerId])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setErrors({})
    const fd = new FormData()
    if (workOrder) fd.set('id', workOrder.id)
    fd.set('customerId', customerId)
    if (vehicleId) fd.set('vehicleId', vehicleId)
    fd.set('problema', problema)
    if (diagnostico) fd.set('diagnostico', diagnostico)
    if (trabalho) fd.set('trabalho', trabalho)
    if (observacoes) fd.set('observacoes', observacoes)
    if (kmEntrada) fd.set('kmEntrada', kmEntrada)
    if (dataPrevista) fd.set('dataPrevista', dataPrevista)

    startTransition(async () => {
      const res = await saveWorkOrder({ ok: false }, fd)
      if (res.ok) {
        onClose()
        if (res.id && !workOrder) {
          router.push(`/folhas/${res.id}`)
        } else {
          router.refresh()
        }
      } else if (res.errors) {
        setErrors(res.errors)
      } else if (res.message) {
        setError(res.message)
      }
    })
  }

  function selectCustomer(customer: CustomerOption) {
    setCustomerId(customer.id)
    setCustomerQuery(customer.nome)
    setVehicleId('')
    setCustomerSearchOpen(false)
    setErrors((current) => {
      const next = { ...current }
      delete next.customerId
      return next
    })
  }

  function clearCustomer() {
    setCustomerId('')
    setCustomerQuery('')
    setVehicleId('')
    setCustomerSearchOpen(true)
  }

  return (
    <Modal open={open} onClose={onClose} title={workOrder ? 'Editar folha de obra' : 'Nova folha de obra'} size="lg">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Cliente *</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
              <input
                type="text"
                value={customerQuery}
                onFocus={() => setCustomerSearchOpen(true)}
                onChange={(e) => {
                  setCustomerQuery(e.target.value)
                  setCustomerId('')
                  setVehicleId('')
                  setCustomerSearchOpen(true)
                }}
                placeholder="Pesquisar por nome, NIF ou telefone..."
                required
                className={cn('input-base pl-10', errors.customerId && 'border-red-300 focus:ring-red-500')}
              />
              {selectedCustomer && (
                <button
                  type="button"
                  onClick={clearCustomer}
                  className="absolute right-2 top-2 px-2 py-1 rounded-md text-xs font-medium text-zinc-500 hover:bg-zinc-100"
                >
                  Trocar
                </button>
              )}

              {customerSearchOpen && (
                <div className="absolute z-50 mt-1 w-full rounded-xl border border-zinc-200 bg-white shadow-lg overflow-hidden">
                  <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 border-b border-zinc-100">
                    {customerQuery.trim() ? 'Resultados' : 'Clientes recentes'}
                  </div>
                  {customerMatches.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-zinc-500">
                      Nenhum cliente encontrado.
                    </div>
                  ) : (
                    <div className="max-h-72 overflow-y-auto">
                      {customerMatches.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectCustomer(customer)}
                          className="w-full px-3 py-2.5 text-left hover:bg-emerald-50 border-b border-zinc-100 last:border-b-0"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium text-sm text-zinc-900 truncate">{customer.nome}</div>
                              <CustomerMeta customer={customer} />
                            </div>
                            {customer.id === customerId && (
                              <BadgeCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            {selectedCustomer && (
              <div className="mt-2 rounded-lg border border-emerald-100 bg-emerald-50/70 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
                  <UserRound className="w-4 h-4 text-emerald-700" />
                  {selectedCustomer.nome}
                </div>
                <CustomerMeta customer={selectedCustomer} className="mt-1 text-emerald-900/70" />
              </div>
            )}
            {customers.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">Regista um cliente primeiro.</p>
            )}
            {errors.customerId && <p className="text-xs text-red-500 mt-1">{errors.customerId}</p>}
          </div>
          <div>
            <label className="label">Viatura</label>
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              disabled={!customerId || vehicles.length === 0}
              className="input-base disabled:opacity-50"
            >
              <option value="">{vehicles.length === 0 ? '—' : 'Seleciona...'}</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.matricula} · {v.marca} {v.modelo}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Problema reportado *</label>
          <textarea
            value={problema}
            onChange={(e) => setProblema(e.target.value)}
            rows={3}
            placeholder="Ex: Travões a chiar quando trava com força..."
            required
            className="input-base resize-none"
          />
          {errors.problema && <p className="text-xs text-red-500 mt-1">{errors.problema}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Km à entrada</label>
            <input
              type="text"
              value={kmEntrada}
              onChange={(e) => setKmEntrada(e.target.value.replace(/\D/g, ''))}
              placeholder="125000"
              inputMode="numeric"
              className="input-base"
            />
          </div>
          <div>
            <label className="label">Data prevista de entrega</label>
            <input
              type="date"
              value={dataPrevista}
              onChange={(e) => setDataPrevista(e.target.value)}
              className="input-base"
            />
          </div>
        </div>

        {workOrder && (
          <>
            <div>
              <label className="label">Diagnóstico</label>
              <textarea
                value={diagnostico}
                onChange={(e) => setDiagnostico(e.target.value)}
                rows={2}
                placeholder="Conclusão técnica após inspeção..."
                className="input-base resize-none"
              />
            </div>
            <div>
              <label className="label">Trabalho efetuado</label>
              <textarea
                value={trabalho}
                onChange={(e) => setTrabalho(e.target.value)}
                rows={2}
                placeholder="Descrição do que foi feito..."
                className="input-base resize-none"
              />
            </div>
          </>
        )}

        <div>
          <label className="label">Observações</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
            placeholder="Notas internas, recomendações..."
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
          <button
            type="submit"
            disabled={pending || customers.length === 0}
            className="btn-primary flex-1"
          >
            {pending ? 'A guardar...' : workOrder ? 'Guardar alterações' : 'Abrir folha'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function CustomerMeta({
  customer,
  className,
}: {
  customer: CustomerOption
  className?: string
}) {
  const hasNif = Boolean(customer.nif)
  const hasPhone = Boolean(customer.telefone)

  if (!hasNif && !hasPhone) {
    return <div className={cn('text-xs text-zinc-400', className)}>Sem NIF ou telefone registado</div>
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500', className)}>
      {hasNif && (
        <span className="inline-flex items-center gap-1">
          <BadgeCheck className="w-3 h-3" />
          NIF {customer.nif}
        </span>
      )}
      {hasPhone && (
        <span className="inline-flex items-center gap-1">
          <Phone className="w-3 h-3" />
          {customer.telefone}
        </span>
      )}
    </div>
  )
}
