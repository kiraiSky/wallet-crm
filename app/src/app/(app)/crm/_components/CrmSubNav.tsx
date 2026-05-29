'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, Users, Activity, ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils'

const items = [
  { href: '/crm', label: 'Visão geral', icon: LayoutGrid, match: (p: string) => p === '/crm' },
  { href: '/folhas', label: 'Folhas', icon: ClipboardList, match: (p: string) => p.startsWith('/folhas') },
  { href: '/clientes', label: 'Clientes', icon: Users, match: (p: string) => p.startsWith('/clientes') },
  { href: '/crm/atividade', label: 'Atividade', icon: Activity, match: (p: string) => p.startsWith('/crm/atividade') },
]

export function CrmSubNav({ isOwner: _isOwner }: { isOwner: boolean }) {
  const pathname = usePathname()
  const isCrmArea =
    pathname.startsWith('/crm') || pathname.startsWith('/clientes') || pathname.startsWith('/folhas')

  if (!isCrmArea) return null

  return (
    <div className="border-t border-zinc-100 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-1 overflow-x-auto py-2 scrollbar-thin">
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
                    ? 'bg-indigo-50 text-indigo-700'
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
    </div>
  )
}
