'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CalendarClock,
  CheckCircle2,
  CalendarDays,
  AlertTriangle,
  Trash2,
  X as XIcon,
  ClipboardList,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatEUR } from '@/lib/format'
import { DynamicIcon } from '@/components/DynamicIcon'
import { colorIconBg } from '@/lib/colors'
import {
  confirmScheduledTransaction,
  rescheduleTransaction,
  deleteTransaction,
} from '../lancamentos/actions'

export type ScheduledItem = {
  id: string
  tipo: 'ENTRADA' | 'SAIDA'
  valor: number
  descricao: string
  dataAgendada: string // ISO
  account: { nome: string }
  category: { nome: string; cor: string; icone: string }
  workOrder: { id: string; numero: number } | null
}

interface Props {
  items: ScheduledItem[]
}

function bucketOf(iso: string, today: Date): 'late' | 'today' | 'soon' | 'later' {
  const d = new Date(iso)
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const t = today.getTime()
  if (day.getTime() < t) return 'late'
  if (day.getTime() === t) return 'today'
  const seven = new Date(today)
  seven.setDate(seven.getDate() + 7)
  if (day.getTime() <= seven.getTime()) return 'soon'
  return 'later'
}

function formatPtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function ScheduledBlock({ items }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [rescheduleFor, setRescheduleFor] = useState<string | null>(null)
  const [newDate, setNewDate] = useState('')

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const buckets = {
    late: items.filter((i) => bucketOf(i.dataAgendada, today) === 'late'),
    today: items.filter((i) => bucketOf(i.dataAgendada, today) === 'today'),
    soon: items.filter((i) => bucketOf(i.dataAgendada, today) === 'soon'),
    later: items.filter((i) => bucketOf(i.dataAgendada, today) === 'later'),
  }

  const totalLate = buckets.late.reduce(
    (s, i) => s + (i.tipo === 'ENTRADA' ? i.valor : -i.valor),
    0
  )
  const totalToday = buckets.today.reduce(
    (s, i) => s + (i.tipo === 'ENTRADA' ? i.valor : -i.valor),
    0
  )
  const totalSoon = buckets.soon.reduce(
    (s, i) => s + (i.tipo === 'ENTRADA' ? i.valor : -i.valor),
    0
  )

  const visible = [...buckets.late, ...buckets.today, ...buckets.soon].slice(0, 6)

  function handleConfirm(id: string) {
    startTransition(async () => {
      await confirmScheduledTransaction(id)
      router.refresh()
    })
  }

  function cancel(id: string) {
    if (!window.confirm('Cancelar este pagamento agendado? Será eliminado.')) return
    startTransition(async () => {
      await deleteTransaction(id)
      router.refresh()
    })
  }

  function reschedule(id: string) {
    if (!newDate) return
    startTransition(async () => {
      await rescheduleTransaction(id, newDate)
      setRescheduleFor(null)
      setNewDate('')
      router.refresh()
    })
  }

  if (items.length === 0) return null

  return (
    <div className="card overflow-hidden mb-4 border-amber-200">
      <div className="p-5 border-b border-amber-100 bg-gradient-to-br from-amber-50 to-white">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-900">Pagamentos agendados</h3>
              <p className="text-xs text-zinc-500">
                Confirma quando o pagamento entrar/sair efetivamente da conta.
              </p>
            </div>
          </div>
          <Link
            href="/lancamentos"
            className="text-xs text-amber-700 hover:text-amber-800 font-medium hidden sm:inline"
          >
            Ver todos →
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <BucketStat
            color="red"
            icon={<AlertTriangle className="w-4 h-4" />}
            label="Atrasados"
            count={buckets.late.length}
            total={totalLate}
          />
          <BucketStat
            color="amber"
            icon={<CalendarDays className="w-4 h-4" />}
            label="Hoje"
            count={buckets.today.length}
            total={totalToday}
          />
          <BucketStat
            color="zinc"
            icon={<CalendarClock className="w-4 h-4" />}
            label="Próx. 7 dias"
            count={buckets.soon.length}
            total={totalSoon}
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="p-6 text-center text-sm text-zinc-400">
          Nenhum pagamento próximo. Tens {buckets.later.length} agendado(s) mais à frente.
        </div>
      ) : (
        <div className="divide-y divide-amber-100">
          {visible.map((it) => {
            const b = bucketOf(it.dataAgendada, today)
            return (
              <div key={it.id} className="px-5 py-3 flex items-center gap-3">
                <div
                  className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                    colorIconBg[it.category.cor] || colorIconBg.violet
                  )}
                >
                  <DynamicIcon name={it.category.icone} className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-zinc-900 truncate flex items-center gap-1.5">
                    {it.descricao}
                    {it.workOrder && (
                      <Link
                        href={`/folhas/${it.workOrder.id}`}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-indigo-100 text-indigo-700"
                        title={`Folha #${it.workOrder.numero}`}
                      >
                        <ClipboardList className="w-3 h-3" />#{it.workOrder.numero}
                      </Link>
                    )}
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold',
                        b === 'late'
                          ? 'bg-red-100 text-red-700'
                          : b === 'today'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-zinc-100 text-zinc-600'
                      )}
                    >
                      {b === 'late' && 'ATRASADO'}
                      {b === 'today' && 'HOJE'}
                      {b === 'soon' && formatPtDate(it.dataAgendada)}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500 truncate">
                    {it.category.nome} · {it.account.nome} · prev.{' '}
                    {formatPtDate(it.dataAgendada)}
                  </div>
                </div>
                <div
                  className={cn(
                    'text-sm font-bold whitespace-nowrap mr-1',
                    it.tipo === 'ENTRADA' ? 'text-emerald-600' : 'text-rose-600'
                  )}
                >
                  {it.tipo === 'ENTRADA' ? '+ ' : '- '}
                  {formatEUR(it.valor)}
                </div>
                {rescheduleFor === it.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="input-base !py-1 !px-2 text-xs !w-auto"
                    />
                    <button
                      onClick={() => reschedule(it.id)}
                      disabled={pending || !newDate}
                      className="px-2 py-1 text-xs rounded bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
                    >
                      OK
                    </button>
                    <button
                      onClick={() => {
                        setRescheduleFor(null)
                        setNewDate('')
                      }}
                      className="px-1.5 py-1 text-xs rounded text-zinc-500 hover:bg-zinc-100"
                      aria-label="Cancelar"
                    >
                      <XIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleConfirm(it.id)}
                      disabled={pending}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50"
                      title="Confirmar recebido/pago"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Confirmar
                    </button>
                    <button
                      onClick={() => {
                        setRescheduleFor(it.id)
                        setNewDate(it.dataAgendada.slice(0, 10))
                      }}
                      disabled={pending}
                      className="inline-flex items-center px-1.5 py-1 text-xs rounded-lg text-zinc-500 hover:bg-zinc-100"
                      title="Reagendar"
                    >
                      <CalendarDays className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => cancel(it.id)}
                      disabled={pending}
                      className="inline-flex items-center px-1.5 py-1 text-xs rounded-lg text-red-500 hover:bg-red-50"
                      title="Cancelar agendamento"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function BucketStat({
  color,
  icon,
  label,
  count,
  total,
}: {
  color: 'red' | 'amber' | 'zinc'
  icon: React.ReactNode
  label: string
  count: number
  total: number
}) {
  const colors = {
    red: 'bg-red-50 text-red-700 border-red-200',
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
    zinc: 'bg-zinc-50 text-zinc-700 border-zinc-200',
  }
  return (
    <div className={cn('rounded-lg border p-2', colors[color])}>
      <div className="flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <div className="text-lg font-bold mt-0.5">{count}</div>
      {count > 0 && (
        <div className="text-[10px] opacity-70">
          {total >= 0 ? '+' : ''}
          {formatEUR(total)}
        </div>
      )}
    </div>
  )
}
