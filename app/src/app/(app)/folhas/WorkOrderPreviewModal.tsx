'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { X, ExternalLink, Loader2, Car, ArrowRight, Phone, Wrench, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatEUR, formatDate } from '@/lib/format'
import { STATUS_META, nextStatus, type WorkOrderStatus } from './status'
import { getWorkOrderPreview, changeStatus } from './actions'
import { getActiveTemplates } from '@/app/(app)/crm/automacoes/actions'
import { AutoSendModal } from './AutoSendModal'
import type { TemplateParaEnvio } from './ConfirmacaoEnvioModal'

type Preview = NonNullable<Awaited<ReturnType<typeof getWorkOrderPreview>>>

interface Props {
  workOrderId: string | null
  onClose: () => void
  onStatusChanged: (woId: string, newStatus: WorkOrderStatus) => void
}

export function WorkOrderPreviewModal({ workOrderId, onClose, onStatusChanged }: Props) {
  const [data, setData] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(false)
  const [autoSend, setAutoSend] = useState<{ templates: TemplateParaEnvio[]; estado: WorkOrderStatus } | null>(null)
  const [, startTransition] = useTransition()

  const open = workOrderId !== null

  useEffect(() => {
    if (!workOrderId) { setData(null); return }
    setLoading(true)
    setData(null)
    getWorkOrderPreview(workOrderId).then((d) => {
      setData(d)
      setLoading(false)
    })
  }, [workOrderId])

  useEffect(() => {
    if (!open) return
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onEsc)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onEsc)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const estado = data?.estado as WorkOrderStatus | undefined
  const meta = estado ? STATUS_META[estado] : null
  const next = estado ? nextStatus(estado) : null
  const pecas = data?.items.filter((i) => i.tipo === 'PECA') ?? []
  const maoObra = data?.items.filter((i) => i.tipo === 'MAO_OBRA') ?? []

  function handleAdvance() {
    if (!data || !next) return
    startTransition(async () => {
      await changeStatus(data.id, next)
      onStatusChanged(data.id, next)
      // Verificar templates automáticos para o novo estado
      const all = await getActiveTemplates()
      const matching = all.filter((t) => {
        if (t.trigger !== 'STATUS_FOLHA') return false
        try { return (JSON.parse(t.triggerEstados) as string[]).includes(next) }
        catch { return false }
      })
      if (matching.length > 0) {
        setAutoSend({ templates: matching, estado: next })
      } else {
        onClose()
      }
    })
  }

  return (
    <>
      {autoSend && (
        <AutoSendModal
          templates={autoSend.templates}
          novoEstado={autoSend.estado}
          customerId={data?.customer.id ?? ''}
          workOrderId={workOrderId ?? ''}
          onClose={() => { setAutoSend(null); onClose() }}
        />
      )}

      <div
        className="fixed inset-0 z-50 bg-zinc-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={onClose}
      >
      <div
        className={cn(
          'bg-white w-full sm:rounded-2xl sm:max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl',
          'rounded-t-2xl'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header fixo */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 py-4 border-b border-zinc-100 rounded-t-2xl">
          <div className="flex items-center gap-3 min-w-0">
            {data ? (
              <>
                <span className="font-bold text-zinc-900 text-lg">Folha #{data.numero}</span>
                {meta && (
                  <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium', meta.chip)}>
                    <span className={cn('w-1.5 h-1.5 rounded-full', meta.dot)} />
                    {meta.label}
                  </span>
                )}
              </>
            ) : (
              <span className="text-zinc-400 text-sm">A carregar…</span>
            )}
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100 transition flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo */}
        {loading || !data ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
          </div>
        ) : (
          <>
            <div className="p-5 space-y-5">

              {/* Cliente + Viatura + Datas */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-1">Cliente</div>
                  <Link
                    href={`/clientes/${data.customer.id}`}
                    onClick={onClose}
                    className="font-semibold text-zinc-900 hover:text-emerald-700 transition"
                  >
                    {data.customer.nome}
                  </Link>
                  {data.customer.telefone && (
                    <a
                      href={`tel:${data.customer.telefone}`}
                      className="flex items-center gap-1 text-sm text-emerald-600 hover:underline mt-0.5"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      {data.customer.telefone}
                    </a>
                  )}
                </div>

                {data.vehicle ? (
                  <div>
                    <div className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-1">Viatura</div>
                    <div className="flex items-center gap-1.5 font-semibold text-zinc-900">
                      <Car className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                      <span className="font-mono tracking-wider">{data.vehicle.matricula}</span>
                    </div>
                    <div className="text-sm text-zinc-600 mt-0.5">
                      {data.vehicle.marca} {data.vehicle.modelo}
                      {data.vehicle.ano ? ` (${data.vehicle.ano})` : ''}
                    </div>
                    {data.kmEntrada && (
                      <div className="text-xs text-zinc-400 mt-0.5">{data.kmEntrada.toLocaleString('pt-PT')} km entrada</div>
                    )}
                  </div>
                ) : <div />}

                <div>
                  <div className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-1">Datas</div>
                  <div className="text-sm text-zinc-700">Aberta: {formatDate(data.dataAbertura)}</div>
                  {data.dataPrevista && (
                    <div className={cn(
                      'text-sm',
                      new Date(data.dataPrevista) < new Date() && !data.dataConclusao
                        ? 'text-red-500 font-medium'
                        : 'text-zinc-500'
                    )}>
                      Prevista: {formatDate(data.dataPrevista)}
                    </div>
                  )}
                  {data.dataConclusao && (
                    <div className="text-sm text-emerald-600">Concluída: {formatDate(data.dataConclusao)}</div>
                  )}
                </div>
              </div>

              {/* Problema */}
              <Section label="Problema">
                <p className="text-sm text-zinc-800 leading-relaxed">{data.problema}</p>
              </Section>

              {/* Diagnóstico */}
              {data.diagnostico && (
                <Section label="Diagnóstico">
                  <p className="text-sm text-zinc-800 leading-relaxed">{data.diagnostico}</p>
                </Section>
              )}

              {/* Trabalho */}
              {data.trabalho && (
                <Section label="Trabalho realizado">
                  <p className="text-sm text-zinc-800 leading-relaxed">{data.trabalho}</p>
                </Section>
              )}

              {/* Items */}
              {data.items.length > 0 && (
                <Section label="Itens">
                  <div className="rounded-xl overflow-hidden border border-zinc-200">
                    {pecas.length > 0 && (
                      <ItemGroup
                        icon={<Package className="w-3.5 h-3.5" />}
                        label="Peças"
                        items={pecas}
                        borderTop={false}
                      />
                    )}
                    {maoObra.length > 0 && (
                      <ItemGroup
                        icon={<Wrench className="w-3.5 h-3.5" />}
                        label="Mão de obra"
                        items={maoObra}
                        borderTop={pecas.length > 0}
                      />
                    )}
                    <div className="flex justify-between items-center px-4 py-3 bg-zinc-50 border-t border-zinc-200">
                      <span className="text-sm text-zinc-500">Total</span>
                      <span className="font-bold text-zinc-900 text-base">{formatEUR(data.total)}</span>
                    </div>
                  </div>
                </Section>
              )}

              {data.observacoes && (
                <Section label="Observações">
                  <p className="text-sm text-zinc-600 leading-relaxed">{data.observacoes}</p>
                </Section>
              )}
            </div>

            {/* Footer de ações */}
            <div className="sticky bottom-0 bg-white border-t border-zinc-100 px-5 py-4 flex flex-wrap items-center gap-2 rounded-b-2xl">
              <Link
                href={`/folhas/${data.id}`}
                onClick={onClose}
                className="inline-flex items-center gap-2 border border-zinc-300 text-zinc-700 hover:bg-zinc-50 text-sm font-medium px-3 py-2 rounded-xl transition"
              >
                <ExternalLink className="w-4 h-4" />
                Ver detalhes
              </Link>
              {next && (
                <button
                  onClick={handleAdvance}
                  className={cn(
                    'ml-auto inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition',
                    STATUS_META[next].chip
                  )}
                >
                  {STATUS_META[next].label}
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
    </>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-zinc-400 font-semibold uppercase tracking-wide mb-1.5">{label}</div>
      {children}
    </div>
  )
}

function ItemGroup({
  icon,
  label,
  items,
  borderTop,
}: {
  icon: React.ReactNode
  label: string
  items: { id: string; descricao: string; quantidade: number; precoUnit: number; total: number }[]
  borderTop: boolean
}) {
  return (
    <>
      <div className={cn(
        'flex items-center gap-1.5 px-4 py-2 bg-zinc-50 text-xs font-semibold text-zinc-500 uppercase tracking-wide',
        borderTop && 'border-t border-zinc-200'
      )}>
        {icon}
        {label}
      </div>
      {items.map((item) => (
        <div key={item.id} className="flex items-center justify-between px-4 py-2 text-sm border-t border-zinc-100 first:border-t-0">
          <span className="text-zinc-700 flex-1 truncate pr-4">{item.descricao}</span>
          <span className="text-zinc-500 whitespace-nowrap text-xs">
            {item.quantidade}× {formatEUR(item.precoUnit)}
            {' = '}
            <span className="font-semibold text-zinc-800">{formatEUR(item.total)}</span>
          </span>
        </div>
      ))}
    </>
  )
}
