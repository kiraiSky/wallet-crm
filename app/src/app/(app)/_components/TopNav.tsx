'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus, LogOut, Users, ChevronDown, ShieldCheck, Plug, Building2 } from 'lucide-react'
import { useEffect, useRef, useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { logoutAction } from '@/app/login/actions'
import { dispatchNewTx } from '@/lib/newTxBus'
import { CrmSubNav } from '../crm/_components/CrmSubNav'
import { ShiftLogo } from '@/components/ShiftLogo'

const navItems = [
  { href: '/dashboard', label: 'Painel', ownerOnly: true, match: (p: string) => p.startsWith('/dashboard') },
  { href: '/lancamentos', label: 'Movimentos', ownerOnly: true, match: (p: string) => p.startsWith('/lancamentos') },
  {
    href: '/crm',
    label: 'CRM',
    match: (p: string) => p.startsWith('/crm') || p.startsWith('/clientes') || p.startsWith('/folhas'),
  },
  { href: '/relatorios', label: 'Relatórios', ownerOnly: true, match: (p: string) => p.startsWith('/relatorios') },
  { href: '/caixas', label: 'Contas', ownerOnly: true, match: (p: string) => p.startsWith('/caixas') },
  { href: '/categorias', label: 'Categorias', ownerOnly: true, match: (p: string) => p.startsWith('/categorias') },
]

export function TopNav({
  userName,
  userInitials,
  userPhotoUrl,
  userRole,
}: {
  userName: string
  userInitials: string
  userPhotoUrl?: string | null
  userRole: 'OWNER' | 'EMPLOYEE'
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pending, start] = useTransition()

  const isOwner = userRole === 'OWNER'
  const visibleNav = navItems.filter((item) => !item.ownerOnly || isOwner)
  const homeHref = isOwner ? '/dashboard' : '/crm'

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
          <div className="flex items-center gap-5 min-w-0">
            <Link href={homeHref} className="flex items-center flex-shrink-0">
              <ShiftLogo size={28} />
            </Link>
            <div className="hidden md:flex items-center gap-1 min-w-0">
              {visibleNav.map((item) => {
                const active = item.match(pathname)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'px-3 py-2 rounded-lg font-medium text-sm transition whitespace-nowrap',
                      active
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-zinc-600 hover:bg-zinc-100'
                    )}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {isOwner && (
              <button
                type="button"
                onClick={() => dispatchNewTx('SAIDA')}
                className="hidden xl:inline-flex btn-danger active:scale-[0.97] ease-apple flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Nova despesa</span>
              </button>
            )}

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full hover:bg-zinc-100 transition pl-1 pr-2 py-1"
              >
                <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                  {userPhotoUrl ? (
                    <img src={userPhotoUrl} alt={userName} className="w-full h-full object-cover" />
                  ) : (
                    userInitials
                  )}
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
                      <>
                        <Link
                          href="/utilizadores"
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                        >
                          <Users className="w-4 h-4" />
                          Utilizadores
                        </Link>
                        <Link
                          href="/auditoria"
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          Auditoria
                        </Link>
                        <Link
                          href="/definicoes/empresa"
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                        >
                          <Building2 className="w-4 h-4" />
                          Empresa
                        </Link>
                        <Link
                          href="/integracoes/moloni"
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                        >
                          <Plug className="w-4 h-4" />
                          Integrações
                        </Link>
                      </>
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
      <CrmSubNav isOwner={isOwner} />
    </nav>
  )
}
