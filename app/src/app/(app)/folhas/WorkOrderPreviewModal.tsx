'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  X, ExternalLink, Loader2, Car, Phone, Package, Wrench,
  Plus, Pencil, Trash2, TrendingUp, TrendingDown, ChevronRight,
  ArrowRight, CheckCircle2, MessageCircle, PartyPopper, XOctagon,
} from 'lucide-react'
import { whatsappUrl } from '@/lib/format'
import { cn } from '@/lib/utils'
import { formatEUR, formatDate } from '@/lib/format'
import { STATUS_META, STATUS_LIST, ACTIVE_STATUSES, ARQUIVO_STATUSES, nextStatus, type WorkOrderStatus } from './status'
import { getWorkOrderPreview, changeStatus, deleteWorkOrder, deleteWorkOrderItem } from './actions'
import { getActiveTemplates } from '@/app/(app)/crm/automacoes/actions'
import { AutoSendModal } from './AutoSendModal'
import { WorkOrderModal } from './WorkOrderModal'
import { ItemModal } from './[id]/ItemModal'
import { TransactionModal } from '@/app/(app)/lancamentos/TransactionModal'
import { MensagensSection } from './[id]/MensagensSection'
import type { TemplateParaEnvio } from './ConfirmacaoEnvioModal'

type Preview = NonNullable<Awaited<ReturnType<typeof getWorkOrderPreview>>>
type ItemRow = Preview['items'][0]
type TxRow = Preview['transactions'][0]

interface Props {
  workOrderId: string | null
  onClose: () => void
  onStatusChanged: (woId: string, newStatus: WorkOrderStatus) => void
  onDeleted?: (woId: string) => void
}

export function WorkOrderPreviewModal({ workOrderId, onClose, onStatusChanged, onDeleted }: Props) {
  const router = useRouter()
  const [data, setData] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(false)
  const [, startTransition] = useTransition()

  // sub-modals
  const [editWoOpen, setEditWoOpen] = useState(false)
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ItemRow | null>(null)
  const [itemTipo, setItemTipo] = useState<'PECA' | 'MAO_OBRA'>('PECA')
  const [statusOpen, setStatusOpen] = useState(false)
  const [confirmArquivo, setConfirmArquivo] = useState<'FINALIZADA' | 'PERDIDA' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<ItemRow | null>(null)
  const [txModalOpen, setTxModalOpen] = useState(false)
  const [txTipo, setTxTipo] = useState<'ENTRADA' | 'SAIDA'>('SAIDA')
  const [editingTx, setEditingTx] = useState<TxRow | null>(null)
  const [autoSend, setAutoSend] = useState<{ templates: TemplateParaEnvio[]; estado: WorkOrderStatus } | null>(null)

  const open = workOrderId !== null
  const prevId = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    if (!workOrderId) return
    const d = await getWorkOrderPreview(workOrderId)
    setData(d)
  }, [workOrderId])

  useEffect(() => {
    if (!workOrderId) {
      setData(null)
      prevId.current = null   // reset para que reabrir a mesma obra faça fetch
      return
    }
    if (prevId.current === workOrderId) return
    prevId.current = workOrderId
    setLoading(true)
    setData(null)
    getWorkOrderPreview(workOrderId).then((d) => { setData(d); setLoading(false) })
  }, [workOrderId])

  useEffect(() => {
    if (!open) return
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !editWoOpen && !itemModalOpen && !txModalOpen && !statusOpen) onClose() }
    window.addEventListener('keydown', onEsc)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onEsc); document.body.style.overflow = '' }
  }, [open, onClose, editWoOpen, itemModalOpen, txModalOpen, statusOpen])

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
      const all = await getActiveTemplates()
      const matching = all.filter((t) => {
        if (t.trigger !== 'STATUS_FOLHA') return false
        try { return (JSON.parse(t.triggerEstados) as string[]).includes(next) } catch { return false }
      })
      if (matching.length > 0) { setAutoSend({ templates: matching, estado: next }) }
      else { onClose() }
      router.refresh()
    })
  }

  function handleChangeStatus(novo: WorkOrderStatus) {
    if (!data) return
    startTransition(async () => {
      await changeStatus(data.id, novo)
      onStatusChanged(data.id, novo)
      setStatusOpen(false)
      const all = await getActiveTemplates()
      const matching = all.filter((t) => {
        if (t.trigger !== 'STATUS_FOLHA') return false
        try { return (JSON.parse(t.triggerEstados) as string[]).includes(novo) } catch { return false }
      })
      if (matching.length > 0) setAutoSend({ templates: matching, estado: novo })
      await refresh()
      router.refresh()
    })
  }

  function handleDelete() {
    if (!data) return
    setConfirmDelete(true)
  }

  function doDelete() {
    if (!data) return
    setConfirmDelete(false)
    startTransition(async () => {
      await deleteWorkOrder(data.id)
      onDeleted?.(data.id)
      onClose()
      router.refresh()
    })
  }

  function handleDeleteItem(item: ItemRow) {
    setConfirmDeleteItem(item)
  }

  function doDeleteItem(item: ItemRow) {
    setConfirmDeleteItem(null)
    startTransition(async () => {
      await deleteWorkOrderItem(item.id)
      await refresh()
      router.refresh()
    })
  }

  const woForModal = data ? {
    id: data.id, customerId: data.customer.id, vehicleId: data.vehicle?.id ?? null,
    problema: data.problema, diagnostico: data.diagnostico, trabalho: data.trabalho,
    observacoes: data.observacoes, kmEntrada: data.kmEntrada, dataPrevista: data.dataPrevista,
  } : null

  return (
    <>
      {autoSend && data && (
        <AutoSendModal
          templates={autoSend.templates}
          novoEstado={autoSend.estado}
          customerId={data.customer.id}
          workOrderId={data.id}
          onClose={() => { setAutoSend(null); onClose() }}
        />
      )}

      <div
        className="fixed inset-0 z-50 bg-zinc-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={() => !statusOpen && onClose()}
      >
        <div
          className="bg-white w-full sm:rounded-2xl sm:max-w-5xl max-h-[96vh] overflow-y-auto shadow-2xl rounded-t-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="sticky top-0 bg-white z-20 flex items-center justify-between px-5 py-4 border-b border-zinc-100 rounded-t-2xl">
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
              ) : <span className="text-zinc-400 text-sm">A carregar…</span>}
            </div>
            <div className="flex items-center gap-2">
              {data && (
                <>
                  <button onClick={() => setEditWoOpen(true)} className="btn-secondary text-xs py-1.5">
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </button>
                  {confirmDelete ? (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                      <span className="text-xs text-red-700 font-medium">Eliminar folha?</span>
                      <button onClick={doDelete} className="text-xs px-2 py-0.5 rounded bg-red-600 text-white hover:bg-red-700 font-semibold transition">Sim</button>
                      <button onClick={() => setConfirmDelete(false)} className="text-xs px-2 py-0.5 rounded text-zinc-600 hover:bg-zinc-200 transition">Não</button>
                    </div>
                  ) : (
                    <button onClick={handleDelete} className="btn-secondary text-xs py-1.5 text-red-600 hover:bg-red-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <Link href={`/folhas/${data.id}`} onClick={onClose} className="btn-secondary text-xs py-1.5">
                    <ExternalLink className="w-3.5 h-3.5" /> Abrir
                  </Link>
                </>
              )}
              <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ── Body ── */}
          {loading || !data ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Coluna esquerda */}
                <div className="lg:col-span-1 space-y-4">
                  {/* Cliente */}
                  <div className="card p-4">
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Cliente</p>
                    <Link href={`/clientes/${data.customer.id}`} onClick={onClose} className="font-semibold text-zinc-900 hover:text-indigo-700 transition block">
                      {data.customer.nome}
                    </Link>
                    {data.customer.telefone && (() => {
                      const wa = whatsappUrl(data.customer.telefone)
                      return (
                        <div className="flex items-center gap-2 mt-1">
                          {wa && (
                            <a href={wa} target="_blank" rel="noreferrer" title="Abrir no WhatsApp"
                              className="flex items-center gap-1.5 text-sm text-zinc-700 hover:text-indigo-600 transition">
                              <MessageCircle className="w-4 h-4 text-indigo-500" />
                              {data.customer.telefone}
                            </a>
                          )}
                          {!wa && <span className="text-sm text-zinc-600">{data.customer.telefone}</span>}
                          <a href={`tel:${data.customer.telefone}`} title="Ligar"
                            className="text-zinc-400 hover:text-zinc-700 transition">
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      )
                    })()}
                  </div>

                  {/* Mensagens — logo após o cliente */}
                  <MensagensSection
                    customerId={data.customer.id}
                    workOrderId={data.id}
                    workOrderEstado={estado!}
                    templates={data.templates}
                    logs={data.automationLogs}
                  />

                  {/* Viatura */}
                  {data.vehicle && (
                    <div className="card p-4">
                      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Viatura</p>
                      <div className="flex items-center gap-1.5 font-mono font-bold tracking-wider text-zinc-900">
                        <Car className="w-4 h-4 text-zinc-400" />{data.vehicle.matricula}
                      </div>
                      <p className="text-sm text-zinc-600 mt-0.5">{data.vehicle.marca} {data.vehicle.modelo}{data.vehicle.ano ? ` (${data.vehicle.ano})` : ''}</p>
                      {data.kmEntrada && <p className="text-xs text-zinc-400 mt-0.5">{data.kmEntrada.toLocaleString('pt-PT')} km entrada</p>}
                    </div>
                  )}

                  {/* Datas */}
                  <div className="card p-4">
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Datas</p>
                    <p className="text-sm text-zinc-700">Aberta: {formatDate(data.dataAbertura)}</p>
                    {data.dataPrevista && (
                      <p className={cn('text-sm', new Date(data.dataPrevista) < new Date() && !data.dataConclusao ? 'text-red-500 font-medium' : 'text-zinc-500')}>
                        Prevista: {formatDate(data.dataPrevista)}
                      </p>
                    )}
                    {data.dataConclusao && <p className="text-sm text-emerald-600">Concluída: {formatDate(data.dataConclusao)}</p>}
                  </div>

                  {/* Problema */}
                  <div className="card p-4">
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Problema</p>
                    <p className="text-sm text-zinc-800 whitespace-pre-wrap">{data.problema}</p>
                  </div>

                  {data.diagnostico && (
                    <div className="card p-4">
                      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Diagnóstico</p>
                      <p className="text-sm text-zinc-800 whitespace-pre-wrap">{data.diagnostico}</p>
                    </div>
                  )}

                  {data.trabalho && (
                    <div className="card p-4">
                      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Trabalho efetuado</p>
                      <p className="text-sm text-zinc-800 whitespace-pre-wrap">{data.trabalho}</p>
                    </div>
                  )}

                  {data.observacoes && (
                    <div className="card p-4">
                      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Observações</p>
                      <p className="text-sm text-zinc-600 whitespace-pre-wrap">{data.observacoes}</p>
                    </div>
                  )}
                </div>

                {/* Coluna direita */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Peças */}
                  <PreviewItemList
                    title="Peças" icon={Package} iconBg="bg-violet-100 text-violet-700"
                    items={pecas} emptyText="Sem peças."
                    onAdd={() => { setEditingItem(null); setItemTipo('PECA'); setItemModalOpen(true) }}
                    onEdit={(it) => { setEditingItem(it); setItemTipo(it.tipo); setItemModalOpen(true) }}
                    onDelete={(it) => setConfirmDeleteItem(it)}
                  />

                  {/* Mão de obra */}
                  <PreviewItemList
                    title="Mão de obra" icon={Wrench} iconBg="bg-orange-100 text-orange-700"
                    items={maoObra} emptyText="Sem mão de obra."
                    onAdd={() => { setEditingItem(null); setItemTipo('MAO_OBRA'); setItemModalOpen(true) }}
                    onEdit={(it) => { setEditingItem(it); setItemTipo(it.tipo); setItemModalOpen(true) }}
                    onDelete={(it) => setConfirmDeleteItem(it)}
                  />

                  {/* Totais */}
                  <div className="card p-4">
                    <h3 className="font-semibold text-zinc-900 mb-3">Totais</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-zinc-500">Peças</span><span className="font-semibold">{formatEUR(data.totalPecas)}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">Mão de obra</span><span className="font-semibold">{formatEUR(data.totalMaoObra)}</span></div>
                      <div className="flex justify-between pt-2 border-t border-zinc-100">
                        <span className="font-bold text-zinc-900">Total</span>
                        <span className="text-xl font-bold text-zinc-900">{formatEUR(data.total)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Movimentos */}
                  <div className="card overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-zinc-100">
                      <h3 className="font-semibold text-zinc-900">Movimentos</h3>
                      <div className="flex gap-2">
                        <button onClick={() => { setTxTipo('ENTRADA'); setEditingTx(null); setTxModalOpen(true) }} className="btn-secondary text-xs py-1.5 text-emerald-600 hover:bg-emerald-50">
                          <TrendingUp className="w-3.5 h-3.5" /> Receita
                        </button>
                        <button onClick={() => { setTxTipo('SAIDA'); setEditingTx(null); setTxModalOpen(true) }} className="btn-danger text-xs py-1.5">
                          <TrendingDown className="w-3.5 h-3.5" /> Despesa
                        </button>
                      </div>
                    </div>
                    {data.transactions.length === 0 ? (
                      <p className="p-6 text-center text-sm text-zinc-400">Sem movimentos financeiros.</p>
                    ) : (
                      <div className="divide-y divide-zinc-100">
                        {data.transactions.map((tx) => (
                          <div key={tx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 cursor-pointer" onClick={() => { setEditingTx(tx); setTxTipo(tx.tipo); setTxModalOpen(true) }}>
                            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', tx.tipo === 'ENTRADA' ? 'bg-emerald-100' : 'bg-rose-100')}>
                              {tx.tipo === 'ENTRADA' ? <TrendingUp className="w-4 h-4 text-emerald-600" /> : <TrendingDown className="w-4 h-4 text-rose-600" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-zinc-900 truncate">{tx.descricao}</p>
                              <p className="text-xs text-zinc-500">{tx.account.nome} · {formatDate(tx.data)}</p>
                            </div>
                            <span className={cn('font-bold text-sm', tx.tipo === 'ENTRADA' ? 'text-emerald-600' : 'text-rose-600')}>
                              {tx.tipo === 'ENTRADA' ? '+' : '-'}{formatEUR(tx.valor)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Footer: status ── */}
          {data && (
            <div className="sticky bottom-0 bg-white border-t border-zinc-100 px-5 py-3 flex items-center gap-2 flex-wrap rounded-b-2xl">
              {next && (
                <button onClick={handleAdvance} className="btn-primary">
                  <CheckCircle2 className="w-4 h-4" /> {STATUS_META[next].label}
                </button>
              )}
              <div className="relative">
                <button onClick={() => setStatusOpen((v) => !v)} className="btn-secondary">
                  Estado <ChevronRight className="w-4 h-4 rotate-90" />
                </button>
                {statusOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setStatusOpen(false)} />
                    <div className="absolute left-0 bottom-full mb-1 bg-white border border-zinc-200 rounded-xl shadow-lg w-52 py-1 z-20">
                      <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">Ativas</div>
                      {ACTIVE_STATUSES.map((s) => (
                        <button key={s} onClick={() => handleChangeStatus(s)} className={cn('w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 flex items-center gap-2', s === data.estado && 'bg-zinc-50 font-semibold')}>
                          <span className={cn('w-2 h-2 rounded-full', STATUS_META[s].dot)} />{STATUS_META[s].label}
                        </button>
                      ))}
                      <div className="border-t border-zinc-100 mt-1 pt-1 px-3 py-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">Arquivo</div>
                      {ARQUIVO_STATUSES.map((s) => (
                        <button key={s} onClick={() => handleChangeStatus(s)} className={cn('w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 flex items-center gap-2', s === data.estado && 'bg-zinc-50 font-semibold')}>
                          <span className={cn('w-2 h-2 rounded-full', STATUS_META[s].dot)} />{STATUS_META[s].label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Botões de arquivo — apenas para obras ativas */}
              {!ARQUIVO_STATUSES.includes(estado!) && !confirmArquivo && (
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={() => setConfirmArquivo('FINALIZADA')}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition"
                  >
                    <PartyPopper className="w-3.5 h-3.5" /> Finalizar
                  </button>
                  <button
                    onClick={() => setConfirmArquivo('PERDIDA')}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition"
                  >
                    <XOctagon className="w-3.5 h-3.5" /> Perdida
                  </button>
                  <Link href={`/folhas/${data.id}`} onClick={onClose} className="btn-secondary text-xs py-1.5">
                    <ExternalLink className="w-4 h-4" /> Ver página completa
                  </Link>
                </div>
              )}

              {/* Confirmação inline — sem confirm() nativo */}
              {!ARQUIVO_STATUSES.includes(estado!) && confirmArquivo && (
                <div className="ml-auto flex items-center gap-3 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5">
                  <span className="text-sm text-zinc-700">
                    {confirmArquivo === 'FINALIZADA'
                      ? 'Marcar como finalizada e retirar do Kanban?'
                      : 'Marcar como perdida e retirar do Kanban?'}
                  </span>
                  <button
                    onClick={() => { handleChangeStatus(confirmArquivo); setConfirmArquivo(null) }}
                    className={cn(
                      'text-xs px-3 py-1.5 rounded-lg font-semibold transition',
                      confirmArquivo === 'FINALIZADA'
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-red-600 text-white hover:bg-red-700'
                    )}
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => setConfirmArquivo(null)}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium text-zinc-600 hover:bg-zinc-200 transition"
                  >
                    Cancelar
                  </button>
                </div>
              )}

              {/* Para obras já arquivadas, apenas o link */}
              {ARQUIVO_STATUSES.includes(estado!) && (
                <Link href={`/folhas/${data.id}`} onClick={onClose} className="btn-secondary ml-auto">
                  <ExternalLink className="w-4 h-4" /> Ver página completa
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sub-modais */}
      {data && (
        <>
          <WorkOrderModal
            open={editWoOpen}
            onClose={() => setEditWoOpen(false)}
            workOrder={woForModal}
            customers={[data.customer]}
          />

          <ItemModal
            open={itemModalOpen}
            onClose={() => setItemModalOpen(false)}
            workOrderId={data.id}
            item={editingItem}
            defaultTipo={itemTipo}
            onSaved={refresh}
          />

          <TransactionModal
            open={txModalOpen}
            onClose={() => { setTxModalOpen(false); setEditingTx(null) }}
            tipo={txTipo}
            transaction={editingTx ? {
              id: editingTx.id, tipo: editingTx.tipo, valor: editingTx.valor,
              descricao: editingTx.descricao, data: editingTx.data,
              observacao: null, agendado: editingTx.agendado, dataAgendada: null,
              accountId: editingTx.accountId, categoryId: editingTx.categoryId,
              workOrderId: data.id,
            } : null}
            accounts={data.accounts}
            categories={data.categories}
            defaultWorkOrderId={data.id}
            onSaved={refresh}
          />
        </>
      )}

      {/* Confirmação inline de eliminar item */}
      {confirmDeleteItem && (
        <div className="fixed inset-0 z-[60] bg-zinc-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <p className="text-sm font-semibold text-zinc-900 mb-1">Eliminar item?</p>
            <p className="text-sm text-zinc-500 mb-5">"{confirmDeleteItem.descricao}" será removido permanentemente.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDeleteItem(null)} className="btn-secondary text-sm">Cancelar</button>
              <button onClick={() => doDeleteItem(confirmDeleteItem)} className="text-sm px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ── Item list inline ── */
function PreviewItemList({ title, icon: Icon, iconBg, items, emptyText, onAdd, onEdit, onDelete }: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  iconBg: string
  items: ItemRow[]
  emptyText: string
  onAdd: () => void
  onEdit: (it: ItemRow) => void
  onDelete: (it: ItemRow) => void
}) {
  const subtotal = items.reduce((s, i) => s + i.total, 0)
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', iconBg)}>
            <Icon className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-zinc-900 text-sm">{title}</span>
          {subtotal > 0 && <span className="text-xs text-zinc-400">{formatEUR(subtotal)}</span>}
        </div>
        <button onClick={onAdd} className="btn-secondary text-xs py-1.5">
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </button>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-3 text-sm text-zinc-400">{emptyText}</p>
      ) : (
        <div className="divide-y divide-zinc-100">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 px-4 py-2.5 group hover:bg-zinc-50">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-800 truncate">{it.descricao}</p>
                <p className="text-xs text-zinc-400">{it.quantidade}× {formatEUR(it.precoUnit)}</p>
              </div>
              <span className="text-sm font-semibold text-zinc-800 flex-shrink-0">{formatEUR(it.total)}</span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <button onClick={() => onEdit(it)} className="p-1 text-zinc-400 hover:text-zinc-700 rounded hover:bg-zinc-100">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => onDelete(it)} className="p-1 text-zinc-400 hover:text-red-500 rounded hover:bg-red-50">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
