'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Check, ChevronDown, Users } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { UserOption } from '../folhas/page'
import { cn } from '@/lib/utils'

export function MechanicFilterSelect({
  users,
  selectedId,
}: {
  users: UserOption[]
  selectedId?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const selectedUser = users.find((user) => user.id === selectedId) ?? null

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function changeMechanic(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set('mechanic', value)
    else params.delete('mechanic')
    const query = params.toString()
    router.push(query ? `/crm?${query}` : '/crm')
    setOpen(false)
  }

  const selectedLabel = selectedUser
    ? `${selectedUser.nome}${selectedUser.role === 'OWNER' ? ' - Admin' : ''}`
    : 'Todos os colaboradores'

  function Avatar({ user }: { user: UserOption | null }) {
    if (!user) {
      return (
        <span className="w-7 h-7 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-500 flex items-center justify-center flex-shrink-0">
          <Users className="w-3.5 h-3.5" />
        </span>
      )
    }

    return (
      <span className="w-7 h-7 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0 overflow-hidden">
        {user.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.photoUrl} alt={user.nome} className="w-full h-full object-cover" />
        ) : (
          initials(user.nome)
        )}
      </span>
    )
  }

  return (
    <div ref={menuRef} className="relative w-full sm:w-72">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'w-full h-10 rounded-xl border bg-white px-3 text-left text-sm transition flex items-center gap-2',
          open ? 'border-indigo-400 ring-4 ring-indigo-50' : 'border-zinc-200 hover:border-zinc-300'
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Avatar user={selectedUser} />
        <span className="min-w-0 flex-1 truncate font-medium text-zinc-800">{selectedLabel}</span>
        <ChevronDown className={cn('w-4 h-4 text-zinc-400 transition', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full z-30 mt-2 w-full rounded-xl border border-zinc-200 bg-white p-1.5 shadow-lg"
        >
          <MechanicOption
            active={!selectedId}
            label="Todos os colaboradores"
            description="Visao geral da oficina"
            onClick={() => changeMechanic('')}
          />
          <div className="my-1 border-t border-zinc-100" />
          {users.map((user) => (
            <MechanicOption
              key={user.id}
              active={user.id === selectedId}
              label={user.nome}
              description={user.role === 'OWNER' ? 'Admin' : 'Colaborador'}
              user={user}
              onClick={() => changeMechanic(user.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function MechanicOption({
  active,
  label,
  description,
  user,
  onClick,
}: {
  active: boolean
  label: string
  description: string
  user?: UserOption
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition',
        active ? 'bg-indigo-50 text-indigo-700' : 'text-zinc-700 hover:bg-zinc-50'
      )}
    >
      {user ? (
        <span className="w-7 h-7 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0 overflow-hidden">
          {user.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.photoUrl} alt={user.nome} className="w-full h-full object-cover" />
          ) : (
            initials(user.nome)
          )}
        </span>
      ) : (
        <span className="w-7 h-7 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-500 flex items-center justify-center flex-shrink-0">
          <Users className="w-3.5 h-3.5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
        <span className={cn('block text-[10px] uppercase tracking-wide', active ? 'text-indigo-500' : 'text-zinc-400')}>
          {description}
        </span>
      </span>
      {active && <Check className="w-4 h-4 flex-shrink-0" />}
    </button>
  )
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}
