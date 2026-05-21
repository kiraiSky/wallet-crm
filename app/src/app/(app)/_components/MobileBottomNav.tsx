'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  List,
  Plus,
  Wallet,
  Users,
  MoreHorizontal,
  BarChart3,
  Tag,
  ShieldCheck,
  X,
  UserCog,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { dispatchNewTx } from '@/lib/newTxBus'

export function MobileBottomNav({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const isActive = (path: string) => pathname.startsWith(path)

  // Fecha a folha ao mudar de rota
  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  // Bloqueia scroll do body quando a folha está aberta
  useEffect(() => {
    if (moreOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [moreOpen])

  const moreItems: { href: string; label: string; icon: typeof Wallet; ownerOnly?: boolean }[] = [
    { href: '/relatorios', label: 'Relatórios', icon: BarChart3 },
    { href: '/lancamentos', label: 'Movimentos', icon: List },
    { href: '/caixas', label: 'Contas', icon: Wallet },
    { href: '/categorias', label: 'Categorias', icon: Tag },
    { href: '/utilizadores', label: 'Utilizadores', icon: UserCog, ownerOnly: true },
    { href: '/auditoria', label: 'Auditoria', icon: ShieldCheck, ownerOnly: true },
  ]
  const visibleMore = moreItems.filter((i) => !i.ownerOnly || isOwner)

  return (
    <>
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
            <span className="text-[10px] font-medium">Painel</span>
          </Link>
          <Link
            href="/crm"
            className={cn(
              'flex flex-col items-center justify-center gap-0.5',
              isActive('/crm') || isActive('/clientes') ? 'text-emerald-600' : 'text-zinc-500'
            )}
          >
            <Users className="w-5 h-5" />
            <span className="text-[10px] font-medium">CRM</span>
          </Link>
          <button
            type="button"
            onClick={() => dispatchNewTx('SAIDA')}
            className="flex flex-col items-center justify-center"
            aria-label="Nova despesa"
          >
            <div className="w-12 h-12 -mt-4 bg-emerald-500 hover:bg-emerald-600 active:scale-95 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30 text-white transition-[transform,background-color] duration-200 ease-apple">
              <Plus className="w-6 h-6" />
            </div>
          </button>
          <Link
            href="/lancamentos"
            className={cn(
              'flex flex-col items-center justify-center gap-0.5',
              isActive('/lancamentos') ? 'text-emerald-600' : 'text-zinc-500'
            )}
          >
            <List className="w-5 h-5" />
            <span className="text-[10px] font-medium">Movim.</span>
          </Link>
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5',
              moreOpen ||
                isActive('/relatorios') ||
                isActive('/caixas') ||
                isActive('/categorias') ||
                isActive('/utilizadores') ||
                isActive('/auditoria')
                ? 'text-emerald-600'
                : 'text-zinc-500'
            )}
            aria-label="Mais"
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] font-medium">Mais</span>
          </button>
        </div>
      </nav>

      {/* Bottom sheet com itens secundários */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setMoreOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl px-4 pt-3 pb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-1 bg-zinc-200 rounded-full mx-auto" />
            </div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-zinc-900">Mais</h3>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-600 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {visibleMore.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex flex-col items-center justify-center gap-1.5 rounded-xl py-4 transition',
                      active
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
