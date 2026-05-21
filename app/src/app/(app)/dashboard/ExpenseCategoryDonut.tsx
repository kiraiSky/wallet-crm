'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Donut } from '@/components/Charts'
import { cn } from '@/lib/utils'

export type ExpenseCategoryGroup = {
  id: string
  nome: string
  valor: number
  pct: number
  cor: string
  children: {
    id: string
    nome: string
    valor: number
    pctOfParent: number
  }[]
}

type Props = {
  groups: ExpenseCategoryGroup[]
  segments: { value: number; color: string }[]
}

export function ExpenseCategoryDonut({ groups, segments }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (groups.length === 0) {
    return <div className="text-center text-sm text-zinc-400 py-8">Sem despesas este mês.</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0">
          <Donut segments={segments} size={128} />
        </div>
        <div className="flex-1 space-y-2 text-sm">
          {groups.map((group) => {
            const canExpand = group.children.length > 0
            const expanded = expandedId === group.id
            return (
              <div key={group.id}>
                <button
                  type="button"
                  onClick={() => canExpand && setExpandedId(expanded ? null : group.id)}
                  className={cn(
                    'w-full flex items-center gap-2 min-w-0 rounded-md text-left',
                    canExpand && 'hover:bg-zinc-50'
                  )}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: group.cor }}
                  />
                  <span className="truncate flex-1 min-w-0" title={group.nome}>
                    {group.nome}
                  </span>
                  <span className="font-semibold text-zinc-700 flex-shrink-0 ml-2">
                    {group.pct.toFixed(0)}%
                  </span>
                  {canExpand && (
                    <ChevronDown
                      className={cn(
                        'w-3.5 h-3.5 text-zinc-400 transition-transform',
                        expanded && 'rotate-180'
                      )}
                    />
                  )}
                </button>
                {expanded && (
                  <div className="mt-1 ml-4 space-y-1 border-l border-zinc-100 pl-3">
                    {group.children.map((child) => (
                      <div key={child.id} className="flex items-center gap-2 text-xs text-zinc-500">
                        <span className="truncate flex-1 min-w-0" title={child.nome}>
                          {child.nome}
                        </span>
                        <span className="font-medium text-zinc-600">
                          {child.pctOfParent.toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
