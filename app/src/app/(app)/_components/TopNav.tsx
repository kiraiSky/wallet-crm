'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Wallet, Plus, LogOut, User as UserIcon, Users, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { logoutAction } from '@/app/login/actions'

const navItems = [
  { href: '/dashboard', label: 'Painel' },
  { href: '/lancamentos', label: 'Movimentos' },
  { href: '/clientes', label: 'Clientes' },
  { href: '/folhas', label: 'Folhas' },
  { href: '/caixas', label: 'Contas' },
  { href: '/categorias', label: 'Categorias' },
]

export function TopNav({
  userName,
  userInitials,
  userRole,
}: {
  userName: string
  userInitials: string
  userRole: 'OWNER' | 'EMPLOYEE'
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pending, start] = useTransition()

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function logout() {
    start(async () => {
      await logoutAction()
    })
  }

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

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full hover:bg-zinc-100 transition pl-1 pr-2 py-1"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  {userInitials}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
              </button>

              {open && (
                <div className="absolute right-0 mt-2 w-60 bg-white border border-zinc-200 rounded-xl shadow-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-zinc-100">
                    <div className="font-semibold text-zinc-900 text-sm">{userName}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {userRole === 'OWNER' ? 'Proprietário' : 'Colaborador'}
                    </div>
                  </div>
                  <div className="py-1">
                    {userRole === 'OWNER' && (
                      <Link
                        href="/utilizadores"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                      >
                        <Users className="w-4 h-4" />
                        Utilizadores
                      </Link>
                    )}
                    <button
                      onClick={logout}
                      disabled={pending}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                    >
                      <LogOut className="w-4 h-4" />
                      {pending ? 'A sair…' : 'Sair'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
