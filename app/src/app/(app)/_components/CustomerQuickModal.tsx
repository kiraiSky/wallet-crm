'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  User, Phone, Mail, Hash, MapPin, Car as CarIcon, ClipboardList,
  ArrowRight, ExternalLink, Loader2, TrendingUp, TrendingDown, MessageCircle,
} from 'lucide-react'
import { Modal } from '@/components/Modal'
import { cn } from '@/lib/utils'
import { formatEUR, formatDate, whatsappUrl } from '@/lib/format'
import { OPEN_CUSTOMER_EVENT, type OpenCustomerDetail } from '@/lib/customerBus'
import { getCustomerSummary, type CustomerQuickSummary } from '@/app/(app)/clientes/actions'
import { STATUS_META, type WorkOrderStatus } from '@/app/(app)/folhas/status'

const TAG_STYLE: Record<CustomerQuickSummary['tag'], string> = {
  VIP: 'bg-amber-100 text-amber-700',
  RECORRENTE: 'bg-emerald-100 text-emerald-700',
  NOVO: 'bg-sky-100 text-sky-700',
  INATIVO: 'bg-zinc-100 text-zinc-600',
}

export function CustomerQuickModal() {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [data, setData] = useState<CustomerQuickSummary | null>(null)
  const [loading, startLoad] = useTransition()

  useEffect(() => {
    function onOpen(e: Event) {
      const detail = (e as CustomEvent<OpenCustomerDetail>).detail
      if (!detail?.id) return
      // Don't open the modal if we're already on the customer's own page.
      if (pathname?.startsWith(`/clientes/${detail.id}`)) return
      setCustomerId(detail.id)
      setOpen(true)
    }
    window.addEventListener(OPEN_CUSTOMER_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_CUSTOMER_EVENT, onOpen)
  }, [pathname])

  useEffect(() => {
    if (!open || !customerId) return
    setData(null)
    startLoad(async () => {
      const s = await getCustomerSummary(customerId)
      setData(s)
    })
  }, [open, customerId])

  function close() {
    setOpen(false)
  }

  function openFullProfile() {
    if (!customerId) return
    setOpen(false)
    router.push(`/clientes/${customerId}`)
  }

  return (
    <Modal open={open} onClose={close} title="Cliente" size="lg">
      <div className="p-5 space-y-5">
        {loading || !data ? (
          <div className="flex items-center justify-center py-16 text-zinc-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center text-base font-bold flex-shrink-0">
                {data.nome
                  .split(/\s+/)
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold text-zinc-900 truncate">{data.nome}</h3>
                  <span
                    className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide',
                      TAG_STYLE[data.tag]
                    )}
                  >
                    {data.tag}
                  </span>
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  {data.contagemFolhas} {data.contagemFolhas === 1 ? 'folha' : 'folhas'} · {data.vehicles.length}{' '}
                  {data.vehicles.length === 1 ? 'viatura' : 'viaturas'}
                </div>
              </div>
            </div>

            {/* Contactos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {data.telefone && (() => {
                const wa = whatsappUrl(data.telefone)
                return (
                  <div className="flex items-stretch gap-1 bg-zinc-50 rounded-lg overflow-hidden">
                    {wa ? (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 text-sm text-zinc-700 hover:text-emerald-600 hover:bg-emerald-50 px-3 py-2 transition flex-1 min-w-0"
                        title="Abrir no WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4 text-emerald-500" />
                        <span className="truncate">{data.telefone}</span>
                      </a>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-zinc-700 px-3 py-2 flex-1 min-w-0">
                        <Phone className="w-4 h-4 text-zinc-400" />
                        <span className="truncate">{data.telefone}</span>
                      </div>
                    )}
                    <a
                      href={`tel:${data.telefone}`}
                      className="flex items-center justify-center w-9 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition border-l border-zinc-200"
                      title="Chamar"
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                  </div>
                )
              })()}
              {data.email && (
                <a
                  href={`mailto:${data.email}`}
                  className="flex items-center gap-2 text-sm text-zinc-700 hover:text-emerald-600 bg-zinc-50 hover:bg-emerald-50 rounded-lg px-3 py-2 transition"
                >
                  <Mail className="w-4 h-4 text-zinc-400" />
                  <span className="truncate">{data.email}</span>
                </a>
              )}
              {data.nif && (
                <div className="flex items-center gap-2 text-sm text-zinc-700 bg-zinc-50 rounded-lg px-3 py-2">
                  <Hash className="w-4 h-4 text-zinc-400" />
                  <span className="truncate">NIF {data.nif}</span>
                </div>
              )}
              {data.morada && (
                <div className="flex items-center gap-2 text-sm text-zinc-700 bg-zinc-50 rounded-lg px-3 py-2 sm:col-span-2">
                  <MapPin className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                  <span className="truncate">{data.morada}</span>
                </div>
              )}
              {!data.telefone && !data.email && !data.nif && !data.morada && (
                <div className="text-xs text-zinc-400 italic sm:col-span-2">Sem contactos guardados.</div>
              )}
            </div>

            {/* Financeiro */}
            {(data.totalReceitas > 0 || data.totalDespesas > 0) && (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-emerald-50 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-emerald-700 font-semibold flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> Entradas
                  </div>
                  <div className="text-base font-bold text-emerald-700 mt-0.5">+{formatEUR(data.totalReceitas)}</div>
                </div>
                <div className="rounded-lg bg-red-50 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-red-600 font-semibold flex items-center gap-1">
                    <TrendingDown className="w-3 h-3" /> Saídas
                  </div>
                  <div className="text-base font-bold text-red-600 mt-0.5">-{formatEUR(data.totalDespesas)}</div>
                </div>
              </div>
            )}

            {/* Viaturas */}
            {data.vehicles.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Viaturas</h4>
                <div className="space-y-1.5">
                  {data.vehicles.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center gap-3 bg-zinc-50 rounded-lg px-3 py-2"
                    >
                      <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center flex-shrink-0">
                        <CarIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-mono font-bold tracking-wider text-sm text-zinc-900">
                          {v.matricula}
                        </div>
                        <div className="text-xs text-zinc-500 truncate">
                          {v.marca} {v.modelo}{v.ano ? ` · ${v.ano}` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Últimas folhas */}
            {data.recentWorkOrders.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Últimas folhas</h4>
                <div className="space-y-1.5">
                  {data.recentWorkOrders.map((wo) => {
                    const meta = STATUS_META[wo.estado as WorkOrderStatus]
                    return (
                      <button
                        key={wo.id}
                        onClick={() => {
                          setOpen(false)
                          router.push(`/folhas/${wo.id}`)
                        }}
                        className="w-full text-left flex items-center gap-3 bg-zinc-50 hover:bg-zinc-100 rounded-lg px-3 py-2 transition group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-white border border-zinc-200 flex items-center justify-center flex-shrink-0">
                          <ClipboardList className="w-4 h-4 text-zinc-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-zinc-500">#{wo.numero}</span>
                            {meta && (
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium',
                                  meta.chip
                                )}
                              >
                                <span className={cn('w-1 h-1 rounded-full', meta.dot)} />
                                {meta.label}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-zinc-700 truncate mt-0.5">{wo.problema}</div>
                        </div>
                        <div className="text-xs text-right text-zinc-500 whitespace-nowrap">
                          <div className="font-bold text-zinc-900">{formatEUR(wo.total)}</div>
                          <div className="text-[10px]">{formatDate(wo.dataAbertura)}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {data.observacoes && (
              <div className="border-t border-zinc-100 pt-4">
                <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">Observações</h4>
                <p className="text-sm text-zinc-700 whitespace-pre-wrap">{data.observacoes}</p>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end pt-2 border-t border-zinc-100">
              <button onClick={openFullProfile} className="btn-primary">
                <ExternalLink className="w-4 h-4" /> Abrir ficha completa
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
