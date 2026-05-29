'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Plus, Search, ClipboardList, Car as CarIcon,
  LayoutList, Columns2, ArrowRight, CheckCircle, XCircle,
  Archive, CheckCircle2, XOctagon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatEUR, formatDate } from '@/lib/format'
import { ACTIVE_STATUSES, ARQUIVO_STATUSES, STATUS_META, STATUS_FLOW, nextStatus, type WorkOrderStatus } from './status'
import { WorkOrderModal } from './WorkOrderModal'
import { WorkOrderPreviewModal } from './WorkOrderPreviewModal'
import { changeStatus } from './actions'
import type { WorkOrderRow, CustomerOption } from './page'

interface Props {
  workOrders: WorkOrderRow[]
  archivedOrders: WorkOrderRow[]
  customers: CustomerOption[]
  counts: Record<WorkOrderStatus | 'TOTAL' | 'ARQUIVO', number>
  valorEmAberto: number
  filters: { search?: string; estado?: WorkOrderStatus; customerId?: string }
}

const KANBAN_COL_BG: Record<WorkOrderStatus, string> = {
  ABERTA: 'bg-sky-50',
  EM_DIAGNOSTICO: 'bg-violet-50',
  AGUARDA_PECAS: 'bg-amber-50',
  EM_REPARACAO: 'bg-orange-50',
  CONCLUIDA: 'bg-emerald-50',
  FATURADA: 'bg-teal-50',
  CANCELADA: 'bg-zinc-100',
  FINALIZADA: 'bg-emerald-50',
  PERDIDA: 'bg-red-50',
}

const KANBAN_COL_OVER: Record<WorkOrderStatus, string> = {
  ABERTA: 'ring-2 ring-sky-400',
  EM_DIAGNOSTICO: 'ring-2 ring-violet-400',
  AGUARDA_PECAS: 'ring-2 ring-amber-400',
  EM_REPARACAO: 'ring-2 ring-orange-400',
  CONCLUIDA: 'ring-2 ring-emerald-400',
  FATURADA: 'ring-2 ring-teal-400',
  CANCELADA: 'ring-2 ring-zinc-400',
  FINALIZADA: 'ring-2 ring-emerald-600',
  PERDIDA: 'ring-2 ring-red-400',
}

const KANBAN_COLS: WorkOrderStatus[] = [...STATUS_FLOW, 'CANCELADA']
const VIEW_KEY = 'carteira.folhas.view'

type Columns = Record<WorkOrderStatus, string[]>

function buildColumns(workOrders: WorkOrderRow[]): Columns {
  return ACTIVE_STATUSES.reduce((acc, s) => {
    acc[s] = workOrders.filter((w) => w.estado === s).map((w) => w.id)
    return acc
  }, { FINALIZADA: [], PERDIDA: [] } as unknown as Columns)
}

function findColumn(columns: Columns, id: string): WorkOrderStatus | null {
  if ((ACTIVE_STATUSES as string[]).includes(id)) return id as WorkOrderStatus
  for (const status of ACTIVE_STATUSES) {
    if (columns[status]?.includes(id)) return status
  }
  return null
}

export function WorkOrdersClient({
  workOrders,
  archivedOrders,
  customers,
  counts,
  valorEmAberto,
  filters,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [view, setView] = useState<'list' | 'kanban'>('kanban')
  const [showArquivo, setShowArquivo] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [columns, setColumns] = useState<Columns>(() => buildColumns(workOrders))

  useEffect(() => {
    setMounted(true)
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(VIEW_KEY) : null
    if (stored === 'list' || stored === 'kanban') setView(stored)
  }, [])

  function changeView(v: 'list' | 'kanban') {
    setView(v)
    try { window.localStorage.setItem(VIEW_KEY, v) } catch { /* ignore */ }
  }

  const dragInProgress = useRef(false)
  useEffect(() => {
    if (dragInProgress.current) return
    setColumns(buildColumns(workOrders))
  }, [workOrders])

  const wosById = useMemo(() => {
    const m: Record<string, WorkOrderRow> = {}
    for (const w of [...workOrders, ...archivedOrders]) m[w.id] = w
    return m
  }, [workOrders, archivedOrders])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function setQuery(key: string, value: string | null) {
    const url = new URL(window.location.href)
    if (value === null || value === '') url.searchParams.delete(key)
    else url.searchParams.set(key, value)
    router.push(url.pathname + url.search)
  }

  function handleAdvanceStatus(wo: WorkOrderRow, e: React.MouseEvent) {
    e.stopPropagation()
    const fromCol = findColumn(columns, wo.id) ?? wo.estado
    const next = nextStatus(fromCol)
    if (!next) return
    moveCard(wo.id, fromCol, next)
    commitStatus(wo.id, next)
  }

  function moveCard(cardId: string, from: WorkOrderStatus, to: WorkOrderStatus, toIndex?: number) {
    setColumns((prev) => {
      const fromArr = (prev[from] ?? []).filter((id) => id !== cardId)
      const toArr = (prev[to] ?? []).filter((id) => id !== cardId)
      const insertAt = toIndex === undefined ? toArr.length : Math.max(0, Math.min(toIndex, toArr.length))
      toArr.splice(insertAt, 0, cardId)
      return { ...prev, [from]: fromArr, [to]: toArr }
    })
  }

  function commitStatus(woId: string, newStatus: WorkOrderStatus) {
    startTransition(async () => {
      await changeStatus(woId, newStatus)
      router.refresh()
    })
  }

  function handleDragStart({ active }: DragStartEvent) {
    dragInProgress.current = true
    setActiveId(active.id as string)
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return
    const activeCol = findColumn(columns, active.id as string)
    const overCol = findColumn(columns, over.id as string)
    if (!activeCol || !overCol || activeCol === overCol) return
    setColumns((prev) => {
      const fromArr = (prev[activeCol] ?? []).filter((id) => id !== active.id)
      const toArr = (prev[overCol] ?? []).filter((id) => id !== active.id)
      const overIsColumn = (ACTIVE_STATUSES as string[]).includes(over.id as string)
      const overIndex = overIsColumn ? toArr.length : toArr.indexOf(over.id as string)
      const insertAt = overIndex < 0 ? toArr.length : overIndex
      toArr.splice(insertAt, 0, active.id as string)
      return { ...prev, [activeCol]: fromArr, [overCol]: toArr }
    })
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    if (!over) { dragInProgress.current = false; return }
    const fromOriginalStatus = wosById[active.id as string]?.estado
    const endCol = findColumn(columns, active.id as string)
    if (endCol && endCol === findColumn(columns, over.id as string) && active.id !== over.id) {
      setColumns((prev) => {
        const arr = prev[endCol] ?? []
        const oldIndex = arr.indexOf(active.id as string)
        const newIndex = arr.indexOf(over.id as string)
        if (oldIndex < 0 || newIndex < 0) return prev
        return { ...prev, [endCol]: arrayMove(arr, oldIndex, newIndex) }
      })
    }
    if (endCol && fromOriginalStatus && endCol !== fromOriginalStatus) {
      commitStatus(active.id as string, endCol)
    }
    requestAnimationFrame(() => { dragInProgress.current = false })
  }

  function handleDragCancel() {
    setActiveId(null)
    setColumns(buildColumns(workOrders))
    dragInProgress.current = false
  }

  const collisionDetection: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args)
    if (pointerCollisions.length > 0) return pointerCollisions
    const rectCollisions = rectIntersection(args)
    if (rectCollisions.length > 0) return rectCollisions
    return closestCorners(args)
  }

  const activeWO = activeId ? wosById[activeId] ?? null : null
  const emCurso = counts.ABERTA + counts.EM_DIAGNOSTICO + counts.AGUARDA_PECAS + counts.EM_REPARACAO

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Folhas de obra</h1>
          <p className="text-zinc-500 text-sm">Trabalhos abertos, em curso e concluídos.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-zinc-200 overflow-hidden">
            <button
              onClick={() => changeView('list')}
              className={cn('px-3 py-1.5 flex items-center text-sm font-medium transition', view === 'list' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-50')}
              title="Vista em lista"
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              onClick={() => changeView('kanban')}
              className={cn('px-3 py-1.5 flex items-center text-sm font-medium transition border-l border-zinc-200', view === 'kanban' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-50')}
              title="Vista em kanban"
            >
              <Columns2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowArquivo((v) => !v)}
              className={cn('px-3 py-1.5 flex items-center gap-1.5 text-sm font-medium transition border-l border-zinc-200', showArquivo ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-50')}
              title="Arquivo — obras finalizadas e perdidas"
            >
              <Archive className="w-4 h-4" />
              {counts.ARQUIVO > 0 && (
                <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-semibold leading-none', showArquivo ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-600')}>
                  {counts.ARQUIVO}
                </span>
              )}
            </button>
          </div>
          <button onClick={() => setModalOpen(true)} className="btn-primary active:scale-[0.97] ease-apple">
            <Plus className="w-4 h-4" /><span>Nova folha</span>
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="card p-4">
          <div className="text-xs text-zinc-500 mb-1">Ativas</div>
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
            onKeyDown={(e) => { if (e.key === 'Enter') setQuery('q', (e.target as HTMLInputElement).value) }}
            className="input-base pl-10"
          />
        </div>
        {view === 'list' && (
          <select value={filters.estado ?? ''} onChange={(e) => setQuery('estado', e.target.value || null)} className="input-base !w-auto">
            <option value="">Todos os estados</option>
            {ACTIVE_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
        )}
        <select value={filters.customerId ?? ''} onChange={(e) => setQuery('customer', e.target.value || null)} className="input-base !w-auto">
          <option value="">Todos os clientes</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>

      {/* ─── Lista ─── */}
      {view === 'list' && (
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
                    <tr key={wo.id} onClick={() => router.push(`/folhas/${wo.id}`)} className="hover:bg-zinc-50 cursor-pointer">
                      <td className="px-4 py-3 font-mono font-semibold text-zinc-700">#{wo.numero}</td>
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
                      <td className="px-4 py-3 text-zinc-700 max-w-xs truncate">{wo.problema}</td>
                      <td className="px-4 py-3"><StatusChip estado={wo.estado} /></td>
                      <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">{formatDate(wo.dataAbertura)}</td>
                      <td className="px-4 py-3 text-right font-bold text-zinc-900 whitespace-nowrap">{formatEUR(wo.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="md:hidden divide-y divide-zinc-100">
                {workOrders.map((wo) => (
                  <div key={wo.id} onClick={() => router.push(`/folhas/${wo.id}`)} className="p-4 hover:bg-zinc-50 cursor-pointer">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-semibold text-zinc-700 text-xs">#{wo.numero}</span>
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
      )}

      {/* ─── Kanban ─── */}
      {view === 'kanban' && mounted && (
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="overflow-x-auto pb-4 -mx-4 px-4">
            <div className="flex gap-3" style={{ minWidth: `${KANBAN_COLS.length * 272 + (KANBAN_COLS.length - 1) * 12}px` }}>
              {KANBAN_COLS.map((status) => {
                const ids = columns[status] ?? []
                const cards = ids.map((id) => wosById[id]).filter(Boolean) as WorkOrderRow[]
                const colTotal = cards.reduce((s, c) => s + c.total, 0)
                return (
                  <KanbanColumn
                    key={status}
                    status={status}
                    ids={ids}
                    cards={cards}
                    colTotal={colTotal}
                    activeId={activeId}
                    onAdvance={handleAdvanceStatus}
                    onCardClick={(id) => setPreviewId(id)}
                  />
                )
              })}
            </div>
          </div>
          <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' }}>
            {activeWO ? <CardContent wo={activeWO} isDragOverlay /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* ─── Arquivo (Finalizada + Perdida) ─── */}
      {showArquivo && (
        <div className="mt-6">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Arquivo</p>
          {archivedOrders.length === 0 ? (
            <div className="card p-8 text-center text-sm text-zinc-400">
              Nenhuma obra finalizada ou perdida ainda.
            </div>
          ) : (
            <div className="card overflow-hidden">
              {/* desktop */}
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
                  {archivedOrders.map((wo) => (
                    <tr
                      key={wo.id}
                      onClick={() => setPreviewId(wo.id)}
                      className="hover:bg-zinc-50 cursor-pointer opacity-75 hover:opacity-100 transition-opacity"
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-zinc-500">#{wo.numero}</td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-zinc-700">{wo.customer.nome}</div>
                        {wo.vehicle && (
                          <div className="text-xs text-zinc-400 inline-flex items-center gap-1.5">
                            <CarIcon className="w-3 h-3" />
                            <span className="font-mono tracking-wider">{wo.vehicle.matricula}</span>
                            <span>· {wo.vehicle.marca} {wo.vehicle.modelo}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 max-w-xs truncate">{wo.problema}</td>
                      <td className="px-4 py-3"><StatusChip estado={wo.estado} /></td>
                      <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap">{formatDate(wo.dataAbertura)}</td>
                      <td className="px-4 py-3 text-right font-bold text-zinc-700 whitespace-nowrap">{formatEUR(wo.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* mobile */}
              <div className="md:hidden divide-y divide-zinc-100">
                {archivedOrders.map((wo) => (
                  <div key={wo.id} onClick={() => setPreviewId(wo.id)} className="p-4 hover:bg-zinc-50 cursor-pointer opacity-75">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-semibold text-zinc-500 text-xs">#{wo.numero}</span>
                      <StatusChip estado={wo.estado} />
                    </div>
                    <div className="font-medium text-zinc-700 text-sm">{wo.customer.nome}</div>
                    <div className="text-xs text-zinc-600 mt-1 truncate">{wo.problema}</div>
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className="text-zinc-400">{formatDate(wo.dataAbertura)}</span>
                      <span className="font-bold text-zinc-700">{formatEUR(wo.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <WorkOrderModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        workOrder={null}
        customers={customers}
        defaultCustomerId={filters.customerId}
      />

      <WorkOrderPreviewModal
        workOrderId={previewId}
        onClose={() => setPreviewId(null)}
        onStatusChanged={(woId, newStatus) => {
          if (ARQUIVO_STATUSES.includes(newStatus)) {
            // Sai do kanban — remove da coluna ativa
            const fromCol = findColumn(columns, woId) ?? (wosById[woId]?.estado as WorkOrderStatus)
            if (fromCol) setColumns((prev) => ({ ...prev, [fromCol]: (prev[fromCol] ?? []).filter((id) => id !== woId) }))
          } else {
            const fromCol = findColumn(columns, woId) ?? (wosById[woId]?.estado as WorkOrderStatus)
            if (fromCol && fromCol !== newStatus) moveCard(woId, fromCol, newStatus)
          }
          commitStatus(woId, newStatus)
        }}
        onDeleted={(woId) => {
          const col = findColumn(columns, woId)
          if (col) setColumns((prev) => ({ ...prev, [col]: (prev[col] ?? []).filter((id) => id !== woId) }))
          setPreviewId(null)
          router.refresh()
        }}
      />
    </>
  )
}

/* ─── Droppable column ─── */
function KanbanColumn({ status, ids, cards, colTotal, activeId, onAdvance, onCardClick }: {
  status: WorkOrderStatus; ids: string[]; cards: WorkOrderRow[]
  colTotal: number; activeId: string | null
  onAdvance: (wo: WorkOrderRow, e: React.MouseEvent) => void
  onCardClick: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const meta = STATUS_META[status]
  return (
    <div className={cn('flex flex-col rounded-2xl p-3 w-[268px] flex-shrink-0 transition-[box-shadow,background-color] duration-200 ease-apple', KANBAN_COL_BG[status], isOver && KANBAN_COL_OVER[status])}>
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', meta.dot)} />
        <span className="font-semibold text-sm text-zinc-800 flex-1">{meta.label}</span>
        <span className="text-xs font-semibold text-zinc-500 bg-white/70 px-1.5 py-0.5 rounded-full">{cards.length}</span>
      </div>
      {colTotal > 0 && <div className="text-xs text-zinc-500 mb-2.5 px-1 font-medium">{formatEUR(colTotal)}</div>}
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="space-y-2.5 flex-1" style={{ minHeight: 80 }}>
          {cards.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-xs text-zinc-400 border-2 border-dashed border-zinc-200/60 rounded-lg">Largar aqui</div>
          ) : (
            cards.map((wo) => (
              <SortableCard key={wo.id} wo={wo} isBeingDragged={wo.id === activeId} onAdvance={onAdvance} onCardClick={onCardClick} />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  )
}

function SortableCard({ wo, isBeingDragged, onAdvance, onCardClick }: {
  wo: WorkOrderRow; isBeingDragged: boolean
  onAdvance: (wo: WorkOrderRow, e: React.MouseEvent) => void
  onCardClick: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: wo.id })
  const style: React.CSSProperties = { transform: CSS.Translate.toString(transform), transition: transition ?? undefined }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={cn('touch-none', isDragging || isBeingDragged ? 'cursor-grabbing-hc opacity-30' : 'cursor-grab-hc')}>
      <CardContent wo={wo} onAdvance={onAdvance} onCardClick={onCardClick} />
    </div>
  )
}

function CardContent({ wo, onAdvance, onCardClick, isDragOverlay }: {
  wo: WorkOrderRow; onAdvance?: (wo: WorkOrderRow, e: React.MouseEvent) => void
  onCardClick?: (id: string) => void; isDragOverlay?: boolean
}) {
  const next = nextStatus(wo.estado)
  const isPastDue = wo.dataPrevista && new Date(wo.dataPrevista) < new Date() && wo.estado !== 'CONCLUIDA' && wo.estado !== 'FATURADA' && wo.estado !== 'CANCELADA'
  return (
    <div className={cn('bg-white rounded-xl border border-zinc-200 shadow-sm select-none', isDragOverlay ? 'shadow-2xl rotate-1 scale-105 border-indigo-300' : 'hover:border-indigo-400 hover:shadow-md transition group')}>
      <div className="p-3" onClick={() => onCardClick?.(wo.id)}>
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-xs font-bold text-zinc-500">#{wo.numero}</span>
          <span className={cn('text-xs', isPastDue ? 'text-red-500 font-semibold' : 'text-zinc-400')}>
            {isPastDue ? '⚠ ' : ''}{formatDate(wo.dataAbertura)}
          </span>
        </div>
        <div className="font-semibold text-sm text-zinc-900 truncate leading-tight">{wo.customer.nome}</div>
        {wo.vehicle && (
          <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1">
            <CarIcon className="w-3 h-3 flex-shrink-0" />
            <span className="font-mono tracking-wider">{wo.vehicle.matricula}</span>
            <span className="truncate">· {wo.vehicle.marca}</span>
          </div>
        )}
        <p className="text-xs text-zinc-600 mt-1.5 line-clamp-2 leading-relaxed">{wo.problema}</p>
        {wo.lastMessage && (
          <div className={cn('flex items-center gap-1 text-xs mt-1.5 px-1.5 py-0.5 rounded-md w-fit', wo.lastMessage.webhookOk ? 'bg-indigo-50 text-indigo-700' : 'bg-red-50 text-red-500')}>
            {wo.lastMessage.webhookOk ? <CheckCircle className="w-3 h-3 flex-shrink-0" /> : <XCircle className="w-3 h-3 flex-shrink-0" />}
            <span className="truncate max-w-[140px]">{wo.lastMessage.templateNome}</span>
          </div>
        )}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100">
          {wo.total > 0 ? <span className="text-xs font-bold text-zinc-800">{formatEUR(wo.total)}</span> : <span />}
          {next && onAdvance && (
            <button onClick={(e) => onAdvance(wo, e)} className={cn('flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium transition opacity-0 group-hover:opacity-100', STATUS_META[next].chip)} title={`Avançar para ${STATUS_META[next].label}`}>
              {STATUS_META[next].label}<ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function StatusChip({ estado }: { estado: WorkOrderStatus }) {
  const meta = STATUS_META[estado]
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap', meta.chip)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  )
}
