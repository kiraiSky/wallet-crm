import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/current-user'
import { formatDateTime } from '@/lib/format'
import {
  ArrowLeftRight,
  UserCog,
  Wrench,
  Car,
  User,
  ClipboardList,
  Tag,
  Wallet,
  Plus,
  Pencil,
  Trash2,
  Archive,
  Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

type EntityKey =
  | 'TRANSACTION'
  | 'CUSTOMER'
  | 'VEHICLE'
  | 'WORK_ORDER'
  | 'WORK_ORDER_ITEM'
  | 'USER'
  | 'ACCOUNT'
  | 'CATEGORY'

const entityMeta: Record<EntityKey, { label: string; icon: typeof User; href?: (id: string) => string }> = {
  TRANSACTION: { label: 'Movimento', icon: ArrowLeftRight, href: () => `/lancamentos` },
  CUSTOMER: { label: 'Cliente', icon: User, href: (id) => `/clientes/${id}` },
  VEHICLE: { label: 'Viatura', icon: Car },
  WORK_ORDER: { label: 'Folha de obra', icon: ClipboardList, href: (id) => `/folhas/${id}` },
  WORK_ORDER_ITEM: { label: 'Item de folha', icon: Wrench },
  USER: { label: 'Utilizador', icon: UserCog, href: () => `/utilizadores` },
  ACCOUNT: { label: 'Conta', icon: Wallet, href: () => `/caixas` },
  CATEGORY: { label: 'Categoria', icon: Tag, href: () => `/categorias` },
}

const actionMeta: Record<string, { label: string; icon: typeof Plus; tone: string }> = {
  CREATE: { label: 'Criado', icon: Plus, tone: 'bg-indigo-50 text-indigo-700' },
  UPDATE: { label: 'Editado', icon: Pencil, tone: 'bg-sky-50 text-sky-700' },
  DELETE: { label: 'Eliminado', icon: Trash2, tone: 'bg-rose-50 text-rose-700' },
  ARCHIVE: { label: 'Arquivado', icon: Archive, tone: 'bg-amber-50 text-amber-700' },
  STATUS_CHANGE: { label: 'Estado', icon: Activity, tone: 'bg-violet-50 text-violet-700' },
}

type SearchParams = Record<string, string | undefined>

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await requireOwner()
  const params = await searchParams
  const entity = params.entity as EntityKey | undefined
  const action = params.action

  const logs = await prisma.auditLog.findMany({
    where: {
      ...(entity && { entityType: entity }),
      ...(action && { action: action as 'CREATE' | 'UPDATE' | 'DELETE' | 'ARCHIVE' | 'STATUS_CHANGE' }),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { user: { select: { nome: true } } },
  })

  const totalToday = await prisma.auditLog.count({
    where: {
      createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    },
  })

  const filters: { key: string; label: string; value?: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'TRANSACTION', label: 'Movimentos', value: 'TRANSACTION' },
    { key: 'WORK_ORDER', label: 'Folhas', value: 'WORK_ORDER' },
    { key: 'CUSTOMER', label: 'Clientes', value: 'CUSTOMER' },
    { key: 'USER', label: 'Utilizadores', value: 'USER' },
  ]

  return (
    <>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Auditoria</h1>
          <p className="text-zinc-500 text-sm">
            Quem mudou o quê e quando. {totalToday > 0 && `${totalToday} eventos hoje.`}
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {filters.map((f) => {
          const active =
            (!entity && f.key === 'all') || (entity === (f.value as EntityKey))
          const href = f.value ? `/auditoria?entity=${f.value}` : '/auditoria'
          return (
            <Link
              key={f.key}
              href={href}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition',
                active
                  ? 'bg-indigo-500 text-white'
                  : 'bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-300'
              )}
            >
              {f.label}
            </Link>
          )
        })}
      </div>

      <div className="card divide-y divide-zinc-100">
        {logs.length === 0 ? (
          <div className="p-10 text-center text-sm text-zinc-500">
            Sem eventos registados para este filtro.
          </div>
        ) : (
          logs.map((log) => {
            const ent = entityMeta[log.entityType as EntityKey] ?? {
              label: log.entityType,
              icon: Activity,
            }
            const act = actionMeta[log.action] ?? actionMeta.UPDATE
            const Icon = ent.icon
            const ActIcon = act.icon
            const href = ent.href?.(log.entityId)
            const row = (
              <div className="flex items-center gap-3 p-3 hover:bg-zinc-50/60 transition">
                <div className="w-9 h-9 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-600 flex-shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-zinc-900 truncate">
                    {log.summary ?? `${ent.label} ${log.entityId.slice(0, 8)}…`}
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    {ent.label} · {log.user?.nome ?? 'Sistema'} · {formatDateTime(log.createdAt)}
                  </div>
                </div>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full flex-shrink-0',
                    act.tone
                  )}
                >
                  <ActIcon className="w-3 h-3" />
                  {act.label}
                </span>
              </div>
            )
            return href ? (
              <Link key={log.id} href={href}>
                {row}
              </Link>
            ) : (
              <div key={log.id}>{row}</div>
            )
          })
        )}
      </div>
    </>
  )
}
