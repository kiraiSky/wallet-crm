'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Power, Trash2, Shield, User as UserIcon } from 'lucide-react'
import { UserModal } from './UserModal'
import { deleteUser, toggleUserActive } from './actions'
import type { UserRow } from './page'

interface Props {
  users: UserRow[]
  currentUserId: string
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function UsersClient({ users, currentUserId }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [pending, start] = useTransition()
  const [feedback, setFeedback] = useState<string | null>(null)

  function openNew() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(u: UserRow) {
    setEditing(u)
    setModalOpen(true)
  }

  function onSaved() {
    setModalOpen(false)
    router.refresh()
  }

  function toggle(u: UserRow) {
    if (u.id === currentUserId) return
    start(async () => {
      const r = await toggleUserActive(u.id)
      if (r.message) setFeedback(r.message)
      router.refresh()
    })
  }

  function remove(u: UserRow) {
    if (u.id === currentUserId) return
    const msg = u.transactionCount > 0
      ? `${u.nome} tem ${u.transactionCount} movimentos associados. A conta será desativada em vez de eliminada. Continuar?`
      : `Eliminar definitivamente ${u.nome}?`
    if (!confirm(msg)) return
    start(async () => {
      const r = await deleteUser(u.id)
      if (r.message) setFeedback(r.message)
      router.refresh()
    })
  }

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Utilizadores</h1>
          <p className="text-zinc-500 text-sm">Gere quem tem acesso à oficina.</p>
        </div>
        <button onClick={openNew} className="btn-primary">
          <Plus className="w-4 h-4" />
          <span>Novo utilizador</span>
        </button>
      </div>

      {feedback && (
        <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 text-sm px-3 py-2 rounded-lg">
          {feedback}
        </div>
      )}

      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-zinc-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Utilizador</th>
                <th className="text-left px-4 py-3 font-medium">Papel</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
                <th className="text-left px-4 py-3 font-medium">Último login</th>
                <th className="text-right px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {users.map((u) => {
                const isMe = u.id === currentUserId
                return (
                  <tr key={u.id} className={u.active ? '' : 'opacity-60'}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white text-xs font-bold flex items-center justify-center">
                          {u.nome.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-zinc-900">
                            {u.nome} {isMe && <span className="text-xs text-emerald-600 ml-1">(tu)</span>}
                          </div>
                          <div className="text-xs text-zinc-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${
                        u.role === 'OWNER'
                          ? 'bg-violet-50 text-violet-700'
                          : 'bg-zinc-100 text-zinc-700'
                      }`}>
                        {u.role === 'OWNER' ? <Shield className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                        {u.role === 'OWNER' ? 'Proprietário' : 'Colaborador'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${
                        u.active ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'
                      }`}>
                        {u.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{formatDate(u.lastLoginAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(u)}
                          title="Editar"
                          className="p-2 text-zinc-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggle(u)}
                          disabled={isMe || pending}
                          title={u.active ? 'Desativar' : 'Ativar'}
                          className="p-2 text-zinc-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-500"
                        >
                          <Power className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => remove(u)}
                          disabled={isMe || pending}
                          title="Eliminar"
                          className="p-2 text-zinc-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <UserModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        onSaved={onSaved}
      />
    </>
  )
}
