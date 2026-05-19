'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Wallet, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Painel' },
  { href: '/lancamentos', label: 'Movimentos' },
  { href: '/clientes', label: 'Clientes' },
  { href: '/folhas', label: 'Folhas' },
  { href: '/caixas', label: 'Contas' },
  { href: '/categorias', label: 'Categorias' },
]

export function TopNav({ userInitials }: { userInitials: string }) {
  const pathname = usePathname()

  return (
    <nav className="bg-white border-b border-zinc-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-zinc-900 hidden sm:inline">Carteira</span>
            </Link>
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const active = pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'px-3 py-2 rounded-lg font-medium text-sm transition',
                      active
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'text-zinc-600 hover:bg-zinc-100'
                    )}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/lancamentos?new=despesa" className="hidden sm:inline-flex btn-primary">
              <Plus className="w-4 h-4" />
              <span>Nova despesa</span>
            </Link>
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
              {userInitials}
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
