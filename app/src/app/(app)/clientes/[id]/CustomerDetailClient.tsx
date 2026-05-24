'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Phone, Mail, Hash, MapPin, Cake, Plus, Pencil, Trash2,
  Car, ClipboardList, Paperclip,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate, formatDateTime, formatEUR } from '@/lib/format'
import { colorIconBg } from '@/lib/colors'
import { DynamicIcon } from '@/components/DynamicIcon'
import { CustomerModal, type CustomerForModal } from '../CustomerModal'
import { VehicleModal } from './VehicleModal'
import { deleteCustomer, deleteVehicle } from '../actions'
import { STATUS_META } from '../../folhas/status'
import type { CustomerDetail, VehicleRow, CustomerWorkOrderRow, CustomerTransactionRow } from './page'
import type { CustomerTag } from '../page'
import { EnviarMensagemButton } from '@/components/EnviarMensagemButton'

interface Props {
  customer: CustomerDetail
  vehicles: VehicleRow[]
  workOrders: CustomerWorkOrderRow[]
  transactions: CustomerTransactionRow[]
}

const TAG_META: Record<CustomerTag, { label: string; chip: string }> = {
  VIP: { label: 'VIP', chip: 'bg-amber-100 text-amber-700' },
  RECORRENTE: { label: 'Recorrente', chip: 'bg-emerald-100 text-emerald-700' },
  NOVO: { label: 'Novo', chip: 'bg-sky-100 text-sky-700' },
  INATIVO: { label: 'Inativo', chip: 'bg-zinc-100 text-zinc-600' },
}

export function CustomerDetailClient({ customer, vehicles, workOrders, transactions }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [editOpen, setEditOpen] = useState(false)
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<VehicleRow | null>(null)

  const customerForModal: CustomerForModal = {
    id: customer.id,
    nome: customer.nome,
    telefone: customer.telefone,
    email: customer.email,
    nif: customer.nif,
    morada: customer.morada,
    observacoes: customer.observacoes,
    aniversario: customer.aniversario,
    tag: customer.tag,
    linguagem: customer.linguagem,
  }

  function openNewVehicle() {
    setEditingVehicle(null)
    setVehicleModalOpen(true)
  }

  function openEditVehicle(v: VehicleRow) {
    setEditingVehicle(v)
    setVehicleModalOpen(true)
  }

  function handleDeleteVehicle(v: VehicleRow) {
    if (!confirm(`Eliminar a viatura ${v.matricula}?`)) return
    startTransition(async () => {
      await deleteVehicle(v.id, customer.id)
      router.refresh()
    })
  }

  function handleDeleteCustomer() {
    if (
      !confirm(
        `Eliminar o cliente "${customer.nome}"?\nIsto também apaga ${vehicles.length} viatura(s) associada(s).`
      )
    )
      return
    startTransition(async () => {
      await deleteCustomer(customer.id)
      router.push('/clientes')
    })
  }

  return (
    <>
      <Link
        href="/clientes"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Clientes
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              'w-14 h-14 rounded-2xl flex items-center justify-center text-base font-bold flex-shrink-0',
              TAG_META[customer.tag].chip
            )}
          >
            {initials(customer.nome)}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-zinc-900 truncate">{customer.nome}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                  TAG_META[customer.tag].chip
                )}
              >
                {TAG_META[customer.tag].label}
              </span>
              <span className="text-xs text-zinc-500">
                Cliente desde {formatDate(customer.createdAt)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <EnviarMensagemButton customerId={customer.id} />
          <button onClick={() => setEditOpen(true)} className="btn-secondary">
            <Pencil className="w-4 h-4" /> Editar
          </button>
          <button onClick={handleDeleteCustomer} className="btn-secondary text-red-600 hover:bg-red-50">
            <Trash2 className="w-4 h-4" /> Eliminar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Coluna esquerda: dados */}
        <div className="card p-5 space-y-3 lg:col-span-1">
          <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide mb-1">
            Dados de contacto
          </h2>
          <InfoRow icon={Phone} label="Telefone" value={customer.telefone} href={customer.telefone ? `tel:${customer.telefone}` : null} />
          <InfoRow icon={Mail} label="Email" value={customer.email} href={customer.email ? `mailto:${customer.email}` : null} />
          <InfoRow icon={Hash} label="NIF" value={customer.nif} />
          <InfoRow icon={MapPin} label="Morada" value={customer.morada} />
          <InfoRow
            icon={Cake}
            label="Aniversário"
            value={customer.aniversario ? formatDate(customer.aniversario, 'dd/MM') : null}
          />
          {customer.observacoes && (
            <div className="pt-3 border-t border-zinc-100">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium mb-1">
                Observações
              </div>
              <p className="text-sm text-zinc-700 whitespace-pre-wrap">{customer.observacoes}</p>
            </div>
          )}
        </div>

        {/* Coluna direita: viaturas + histórico (placeholder) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-zinc-900">
                Viaturas <span className="text-zinc-400 font-normal">({vehicles.length})</span>
              </h2>
              <button onClick={openNewVehicle} className="btn-primary">
                <Plus className="w-4 h-4" /> Adicionar viatura
              </button>
            </div>

            {vehicles.length === 0 ? (
              <div className="text-center py-10 text-sm text-zinc-500">
                <Car className="w-10 h-10 mx-auto text-zinc-300 mb-2" />
                Sem viaturas associadas a este cliente.
              </div>
            ) : (
              <div className="space-y-3">
                {vehicles.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-start gap-3 p-3 rounded-xl border border-zinc-200 hover:border-emerald-300 hover:bg-emerald-50/30 transition group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center flex-shrink-0">
                      <Car className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-zinc-900 tracking-wider">
                          {v.matricula}
                        </span>
                        <span className="text-sm text-zinc-700">
                          {v.marca} {v.modelo}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                        {v.ano && <span>Ano: {v.ano}</span>}
                        {v.cor && <span>Cor: {v.cor}</span>}
                        {v.km !== null && <span>{v.km.toLocaleString('pt-PT')} km</span>}
                      </div>
                      {v.observacoes && (
                        <p className="text-xs text-zinc-500 mt-1 italic">{v.observacoes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                      <button
                        onClick={() => openEditVehicle(v)}
                        className="w-7 h-7 rounded-lg hover:bg-white text-zinc-500"
                        aria-label="Editar viatura"
                      >
                        <Pencil className="w-3.5 h-3.5 mx-auto" />
                      </button>
                      <button
                        onClick={() => handleDeleteVehicle(v)}
                        className="w-7 h-7 rounded-lg hover:bg-white text-red-500"
                        aria-label="Eliminar viatura"
                      >
                        <Trash2 className="w-3.5 h-3.5 mx-auto" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-zinc-900">
                Folhas de obra{' '}
                <span className="text-zinc-400 font-normal">({workOrders.length})</span>
              </h2>
              <Link
                href={`/folhas?customer=${customer.id}`}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
              >
                Ver todas →
              </Link>
            </div>
            {workOrders.length === 0 ? (
              <div className="text-center py-8 text-sm text-zinc-400 inline-flex flex-col items-center w-full gap-2">
                <ClipboardList className="w-8 h-8 text-zinc-300" />
                <span>Sem folhas de obra para este cliente.</span>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {workOrders.slice(0, 8).map((wo) => {
                  const meta = STATUS_META[wo.estado]
                  return (
                    <Link
                      key={wo.id}
                      href={`/folhas/${wo.id}`}
                      className="flex items-center gap-3 py-2.5 hover:bg-zinc-50 -mx-2 px-2 rounded-lg transition"
                    >
                      <span className="font-mono font-semibold text-xs text-zinc-500 w-12">
                        #{wo.numero}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-zinc-900 truncate">{wo.problema}</div>
                        <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-2">
                          {wo.vehicle && (
                            <span className="font-mono tracking-wider">
                              {wo.vehicle.matricula}
                            </span>
                          )}
                          <span>{formatDate(wo.dataAbertura)}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
                            meta.chip
                          )}
                        >
                          <span className={cn('w-1.5 h-1.5 rounded-full', meta.dot)} />
                          {meta.label}
                        </span>
                        <span className="text-sm font-bold text-zinc-900 whitespace-nowrap">
                          {formatEUR(wo.total)}
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Histórico financeiro */}
          <div className="card overflow-hidden">
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-zinc-900">
                  Histórico financeiro{' '}
                  <span className="text-zinc-400 font-normal">({transactions.length})</span>
                </h2>
                {transactions.length > 0 && (() => {
                  const entradas = transactions.filter(t => t.tipo === 'ENTRADA').reduce((s, t) => s + t.valor, 0)
                  const saidas = transactions.filter(t => t.tipo === 'SAIDA').reduce((s, t) => s + t.valor, 0)
                  return (
                    <div className="text-xs text-zinc-500 mt-0.5 flex gap-3">
                      <span>Entradas: <strong className="text-emerald-600">+{formatEUR(entradas)}</strong></span>
                      <span>Saídas: <strong className="text-red-500">-{formatEUR(saidas)}</strong></span>
                    </div>
                  )
                })()}
              </div>
              <Link
                href={`/lancamentos`}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
              >
                Ver em lançamentos →
              </Link>
            </div>

            {transactions.length === 0 ? (
              <div className="p-10 text-center text-sm text-zinc-400">
                Sem movimentos financeiros para este cliente.
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 max-h-80 overflow-y-auto">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50">
                    <div className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                      colorIconBg[tx.category.cor] || colorIconBg.violet
                    )}>
                      <DynamicIcon name={tx.category.icone} className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-zinc-900 flex items-center gap-1.5">
                        {tx.descricao}
                        {tx.hasAttachment && <Paperclip className="w-3 h-3 text-zinc-400" />}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {tx.category.nome} · {tx.account.nome}
                        {tx.workOrder && (
                          <> · <Link href={`/folhas/${tx.workOrderId}`} className="hover:text-emerald-600">
                            Folha #{tx.workOrder.numero}
                          </Link></>
                        )}
                        {' · '}{formatDateTime(tx.data)}
                      </div>
                    </div>
                    <div className={cn(
                      'text-sm font-bold whitespace-nowrap',
                      tx.tipo === 'ENTRADA' ? 'text-emerald-600' : 'text-red-500'
                    )}>
                      {tx.tipo === 'ENTRADA' ? '+ ' : '- '}{formatEUR(tx.valor)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <CustomerModal open={editOpen} onClose={() => setEditOpen(false)} customer={customerForModal} />
      <VehicleModal
        open={vehicleModalOpen}
        onClose={() => {
          setVehicleModalOpen(false)
          setEditingVehicle(null)
        }}
        customerId={customer.id}
        vehicle={editingVehicle}
      />
    </>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | null
  href?: string | null
}) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <Icon className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium">{label}</div>
        {value ? (
          href ? (
            <a href={href} className="text-zinc-900 hover:text-emerald-600 truncate block">
              {value}
            </a>
          ) : (
            <span className="text-zinc-900 break-words">{value}</span>
          )
        ) : (
          <span className="text-zinc-300">—</span>
        )}
      </div>
    </div>
  )
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
