'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, Users, Activity, ClipboardList, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

const items = [
  { href: '/crm', label: 'Visão geral', icon: LayoutGrid, match: (p: string) => p === '/crm' },
  { href: '/clientes', label: 'Clientes', icon: Users, match: (p: string) => p.startsWith('/clientes') },
  { href: '/crm/atividade', label: 'Atividade', icon: Activity, match: (p: string) => p.startsWith('/crm/atividade') },
  { href: '/folhas', label: 'Folhas', icon: ClipboardList, match: (p: string) => p.startsWith('/folhas') },
  { href: '/crm/automacoes', label: 'Automações', icon: Zap, match: (p: string) => p.startsWith('/crm/automacoes') },
]

export function CrmSubNav() {
  const pathname = usePathname()
  return (
    <div className="mb-5 -mx-4 sm:mx-0 sm:rounded-xl sm:border sm:border-zinc-200 sm:bg-white sm:px-2 border-b border-zinc-200 sm:border-b">
      <div className="flex gap-1 overflow-x-auto px-4 sm:px-0 py-2 scrollbar-thin">
        {items.map((it) => {
          const active = it.match(pathname)
          const Icon = it.icon
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition flex-shrink-0',
                active
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-zinc-600 hover:bg-zinc-100'
              )}
            >
              <Icon className="w-4 h-4" />
              {it.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
