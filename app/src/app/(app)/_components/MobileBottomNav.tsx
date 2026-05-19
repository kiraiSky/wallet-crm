'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, List, Plus, Wallet, Tags } from 'lucide-react'
import { cn } from '@/lib/utils'

export function MobileBottomNav() {
  const pathname = usePathname()
  const isActive = (path: string) => pathname.startsWith(path)

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 z-30">
      <div className="grid grid-cols-5 h-16">
        <Link
          href="/dashboard"
          className={cn(
            'flex flex-col items-center justify-center gap-0.5',
            isActive('/dashboard') ? 'text-emerald-600' : 'text-zinc-500'
          )}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] font-medium">Home</span>
        </Link>
        <Link
          href="/lancamentos"
          className={cn(
            'flex flex-col items-center justify-center gap-0.5',
            isActive('/lancamentos') && pathname !== '/lancamentos?new=despesa'
              ? 'text-emerald-600'
              : 'text-zinc-500'
          )}
        >
          <List className="w-5 h-5" />
          <span className="text-[10px] font-medium">Lançamentos</span>
        </Link>
        <Link
          href="/lancamentos?new=despesa"
          className="flex flex-col items-center justify-center"
        >
          <div className="w-12 h-12 -mt-4 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30 text-white">
            <Plus className="w-6 h-6" />
          </div>
        </Link>
        <Link
          href="/caixas"
          className={cn(
            'flex flex-col items-center justify-center gap-0.5',
            isActive('/caixas') ? 'text-emerald-600' : 'text-zinc-500'
          )}
        >
          <Wallet className="w-5 h-5" />
          <span className="text-[10px] font-medium">Caixas</span>
        </Link>
        <Link
          href="/categorias"
          className={cn(
            'flex flex-col items-center justify-center gap-0.5',
            isActive('/categorias') ? 'text-emerald-600' : 'text-zinc-500'
          )}
        >
          <Tags className="w-5 h-5" />
          <span className="text-[10px] font-medium">Categorias</span>
        </Link>
      </div>
    </nav>
  )
}
